import type Stripe from "stripe";
import { db, Prisma } from "@/server/db";
import { env } from "@/server/env";
import { logger } from "@/server/logger";
import { stripeClient } from "@/server/payments/stripe";
import {
  handlePaymentCanceled,
  handlePaymentFailed,
  handlePaymentProcessing,
  handlePaymentSucceeded,
  handleRefundUpdated,
} from "@/server/services/payments";

/**
 * Stripe webhook: the source of truth for payment state. Signature verified, events deduplicated
 * (Stripe retries and may deliver twice), handlers idempotent.
 */
export async function POST(req: Request) {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Webhook not configured", { status: 400 });

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripeClient().webhooks.constructEventAsync(payload, signature, secret);
  } catch (error) {
    logger.warn("stripe webhook signature rejected", { error: String(error) });
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    await db.webhookEvent.create({ data: { id: event.id, provider: "stripe", type: event.type } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const seen = await db.webhookEvent.findUnique({ where: { id: event.id } });
      if (seen?.processedAt) return Response.json({ received: true, duplicate: true });
    } else {
      throw error;
    }
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object;
        const full = await stripeClient().paymentIntents.retrieve(intent.id, { expand: ["latest_charge"] });
        const charge = typeof full.latest_charge === "object" ? full.latest_charge : null;
        const card = charge?.payment_method_details?.card;
        await handlePaymentSucceeded({
          providerPaymentId: intent.id,
          cardBrand: card?.brand ?? null,
          cardLast4: card?.last4 ?? null,
          wallet: card?.wallet?.type ?? null,
        });
        break;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object;
        await handlePaymentFailed(intent.id, {
          code: intent.last_payment_error?.code ?? null,
          message: intent.last_payment_error?.message ?? null,
        });
        break;
      }
      case "payment_intent.processing":
        await handlePaymentProcessing(event.data.object.id);
        break;
      case "payment_intent.canceled":
        await handlePaymentCanceled(event.data.object.id);
        break;
      case "refund.updated":
      case "refund.created": {
        const refund = event.data.object;
        const status =
          refund.status === "succeeded"
            ? "SUCCEEDED"
            : refund.status === "failed" || refund.status === "canceled"
              ? "FAILED"
              : "PENDING";
        await handleRefundUpdated(refund.id, status);
        break;
      }
      default:
        break;
    }
    await db.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), error: null } });
    return Response.json({ received: true });
  } catch (error) {
    logger.error("stripe webhook handler failed", { error, type: event.type, id: event.id });
    await db.webhookEvent
      .update({ where: { id: event.id }, data: { error: String(error).slice(0, 500) } })
      .catch(() => {});
    // 500 makes Stripe retry later.
    return new Response("Handler error", { status: 500 });
  }
}
