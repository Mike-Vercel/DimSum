import "server-only";
import { db } from "../db";
import { AppError, isAppError } from "../errors";
import { logger } from "../logger";
import { gatewayFor } from "../payments";
import { reverseOrderPoints } from "./loyalty";
import { notifyCustomer } from "./notifications";
import { runOrderCommand } from "./orders/commands";

export interface PaymentDetails {
  providerPaymentId: string;
  cardBrand?: string | null;
  cardLast4?: string | null;
  wallet?: string | null;
}

/** Runs an order command, treating "already done" as success (webhooks are retried and duplicated). */
async function idempotentCommand(orderId: string, command: Parameters<typeof runOrderCommand>[1]) {
  try {
    await runOrderCommand(orderId, command, { actor: "system", userId: null });
  } catch (error) {
    const code = isAppError(error) ? (error.details as { code?: string } | undefined)?.code : undefined;
    if (code === "ALREADY_DONE") return;
    throw error;
  }
}

/**
 * The ONLY place where an order becomes paid: called by the verified Stripe webhook (or the
 * development simulator). Never by the browser.
 */
export async function handlePaymentSucceeded(details: PaymentDetails): Promise<void> {
  const payment = await db.payment.findUnique({
    where: { providerPaymentId: details.providerPaymentId },
    include: { order: true },
  });
  if (!payment) {
    logger.warn("payment succeeded for unknown intent", { providerPaymentId: details.providerPaymentId });
    return;
  }
  if (payment.status !== "SUCCEEDED") {
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCEEDED",
        succeededAt: new Date(),
        cardBrand: details.cardBrand ?? payment.cardBrand,
        cardLast4: details.cardLast4 ?? payment.cardLast4,
        wallet: details.wallet ?? payment.wallet,
        failureCode: null,
        failureMessage: null,
      },
    });
  }

  const order = payment.order;
  if (order.cancelledAt) {
    // Paid after the order expired: give the money back immediately.
    logger.warn("payment succeeded on a cancelled order, refunding", { orderId: order.id });
    await db.order.update({ where: { id: order.id }, data: { paidAt: order.paidAt ?? new Date() } });
    await refundOrder(
      order.id,
      payment.amountCents - payment.refundedCents,
      "Pagamento ricevuto dopo l'annullamento dell'ordine",
      { actorUserId: null, idempotencyKey: `late-${payment.id}` },
    );
    return;
  }
  if (order.paidAt && order.receivedAt) return;
  await idempotentCommand(order.id, { type: "PAYMENT_SUCCEEDED" });
  await idempotentCommand(order.id, { type: "RECEIVE" });
  await notifyCustomer(order.id, "PAYMENT_CONFIRMED");
}

export async function handlePaymentFailed(
  providerPaymentId: string,
  failure: { code: string | null; message: string | null },
): Promise<void> {
  await db.payment.updateMany({
    where: { providerPaymentId, status: { notIn: ["SUCCEEDED", "REFUNDED", "PARTIALLY_REFUNDED"] } },
    data: {
      status: "FAILED",
      failureCode: failure.code,
      failureMessage: failure.message?.slice(0, 300) ?? null,
    },
  });
}

export async function handlePaymentProcessing(providerPaymentId: string): Promise<void> {
  await db.payment.updateMany({
    where: { providerPaymentId, status: { in: ["PENDING", "REQUIRES_ACTION", "FAILED"] } },
    data: { status: "PROCESSING" },
  });
}

export async function handlePaymentCanceled(providerPaymentId: string): Promise<void> {
  const payment = await db.payment.findUnique({ where: { providerPaymentId }, include: { order: true } });
  if (!payment) return;
  await db.payment.update({ where: { id: payment.id }, data: { status: "CANCELED" } });
  if (payment.order.status === "PENDING_PAYMENT") {
    await idempotentCommand(payment.order.id, { type: "CANCEL", reason: "Pagamento non completato" });
  }
}

/** Side effects of a cancellation: release the promotion, refund or void the payment. */
export async function handleOrderCancelled(orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { payments: true, couponRedemption: true },
  });
  if (!order) return;

  if (order.couponRedemption && order.couponRedemption.status !== "RELEASED") {
    await db.$transaction([
      db.couponRedemption.update({ where: { id: order.couponRedemption.id }, data: { status: "RELEASED" } }),
      db.coupon.update({
        where: { id: order.couponRedemption.couponId },
        data: { redemptionsCount: { decrement: 1 } },
      }),
    ]);
  }

  for (const p of order.payments) {
    if (p.provider === "CASH") {
      await db.payment.update({ where: { id: p.id }, data: { status: "CANCELED" } });
      continue;
    }
    const gateway = gatewayFor(p.provider);
    if (p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED") {
      const due = p.amountCents - p.refundedCents;
      if (due > 0)
        await refundOrder(order.id, due, order.cancellationReason ?? "Ordine annullato", {
          actorUserId: null,
          idempotencyKey: `cancel-${p.id}`,
        });
    } else if (
      p.providerPaymentId &&
      gateway &&
      ["PENDING", "REQUIRES_ACTION", "PROCESSING", "FAILED"].includes(p.status)
    ) {
      await gateway
        .cancelIntent(p.providerPaymentId)
        .catch((error: unknown) => logger.warn("cancel intent failed", { error, paymentId: p.id }));
      await db.payment.update({ where: { id: p.id }, data: { status: "CANCELED" } });
    }
  }
}

/**
 * Full or partial refund of the online payment of an order. Idempotent through the key; the
 * order turns REFUNDED only when the whole amount has been returned.
 */
export async function refundOrder(
  orderId: string,
  amountCents: number,
  reason: string,
  ctx: { actorUserId: string | null; idempotencyKey: string },
): Promise<{ refundedCents: number; fullyRefunded: boolean }> {
  const existing = await db.refund.findUnique({ where: { idempotencyKey: ctx.idempotencyKey } });
  if (existing) {
    const p = await db.payment.findUniqueOrThrow({ where: { id: existing.paymentId } });
    return { refundedCents: existing.amountCents, fullyRefunded: p.refundedCents >= p.amountCents };
  }
  const payment = await db.payment.findFirst({
    where: {
      orderId,
      provider: { in: ["STRIPE", "DEV"] },
      status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] },
    },
  });
  if (!payment?.providerPaymentId)
    throw new AppError("BAD_REQUEST", "Questo ordine non ha un pagamento online da rimborsare.");
  const refundable = payment.amountCents - payment.refundedCents;
  if (amountCents <= 0 || amountCents > refundable) {
    throw new AppError(
      "VALIDATION_FAILED",
      `Puoi rimborsare al massimo ${(refundable / 100).toFixed(2).replace(".", ",")} €.`,
    );
  }
  const gateway = gatewayFor(payment.provider);
  if (!gateway) throw new AppError("PAYMENT_UNAVAILABLE", "Il gateway di pagamento non è configurato.");

  const refund = await db.refund.create({
    data: {
      orderId,
      paymentId: payment.id,
      amountCents,
      reason,
      idempotencyKey: ctx.idempotencyKey,
      createdById: ctx.actorUserId,
    },
  });
  let result: Awaited<ReturnType<typeof gateway.refund>>;
  try {
    result = await gateway.refund({
      providerPaymentId: payment.providerPaymentId,
      amountCents,
      idempotencyKey: `refund_${ctx.idempotencyKey}`,
      reason,
    });
  } catch (error) {
    await db.refund.update({ where: { id: refund.id }, data: { status: "FAILED" } });
    logger.error("refund failed", { error, orderId });
    throw new AppError(
      "PAYMENT_FAILED",
      "Il rimborso non è andato a buon fine. Riprova o verifica sul pannello del gateway.",
    );
  }
  const refundedTotal = payment.refundedCents + amountCents;
  const full = refundedTotal >= payment.amountCents;
  await db.$transaction([
    db.refund.update({
      where: { id: refund.id },
      data: { status: result.status, providerRefundId: result.providerRefundId },
    }),
    db.payment.update({
      where: { id: payment.id },
      data: { refundedCents: refundedTotal, status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    }),
  ]);
  if (full) {
    const o = await db.order.findUnique({ where: { id: orderId }, select: { refundedAt: true } });
    if (!o?.refundedAt) await idempotentCommand(orderId, { type: "REFUND_FULL" });
  }
  await reverseOrderPoints(orderId, amountCents);
  await notifyCustomer(orderId, "REFUND_ISSUED", { refundCents: amountCents });
  return { refundedCents: amountCents, fullyRefunded: full };
}

export async function handleRefundUpdated(
  providerRefundId: string,
  status: "PENDING" | "SUCCEEDED" | "FAILED",
): Promise<void> {
  await db.refund.updateMany({ where: { providerRefundId }, data: { status } });
}

/** Cancels orders whose online payment was never completed (cron, every few minutes). */
export async function expireUnpaidOrders(maxAgeMinutes = 30): Promise<number> {
  const stale = await db.order.findMany({
    where: { status: "PENDING_PAYMENT", placedAt: { lt: new Date(Date.now() - maxAgeMinutes * 60_000) } },
    select: { id: true },
    take: 50,
  });
  for (const o of stale) {
    await idempotentCommand(o.id, { type: "CANCEL", reason: "Pagamento non completato" }).catch(
      (error: unknown) => logger.warn("expire order failed", { error, orderId: o.id }),
    );
  }
  return stale.length;
}
