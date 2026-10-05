import "server-only";
import { formatEuro, formatOrderNumber } from "@dimsum/domain";
import type { CheckoutBlocker, CheckoutResultDTO } from "@dimsum/types";
import type { CheckoutRequest } from "@dimsum/validation";
import type { Viewer } from "../auth/session";
import { db, Prisma } from "../db";
import { AppError } from "../errors";
import { appUrl, env, features } from "../env";
import { newPublicId } from "../ids";
import { logger } from "../logger";
import { gatewayFor, onlineGateway } from "../payments";
import { recordConsents } from "./consents";
import { runOrderCommand } from "./orders/commands";
import { quoteCart } from "./quote";
import { loadRestaurantConfig, type RestaurantConfig } from "./restaurant";

const BLOCKER_ERRORS: [CheckoutBlocker, AppError["code"], string][] = [
  ["EMPTY_CART", "CART_INVALID", "Il carrello è vuoto."],
  ["CART_ISSUES", "PRODUCT_UNAVAILABLE", "Alcuni prodotti non sono più disponibili: controlla il carrello."],
  ["ORDERS_PAUSED", "ORDERS_PAUSED", "In questo momento non accettiamo nuovi ordini. Riprova tra poco."],
  [
    "RESTAURANT_CLOSED",
    "RESTAURANT_CLOSED",
    "Al momento siamo chiusi: programma l'ordine per un orario di apertura.",
  ],
  ["FULFILLMENT_UNAVAILABLE", "RESTAURANT_CLOSED", "Questa modalità al momento non è disponibile."],
  ["SLOT_UNAVAILABLE", "SLOT_UNAVAILABLE", "L'orario scelto non è più disponibile: scegline un altro."],
  ["ADDRESS_REQUIRED", "VALIDATION_FAILED", "Inserisci l'indirizzo di consegna."],
  ["OUT_OF_ZONE", "OUT_OF_ZONE", "Questo indirizzo è fuori dalla nostra zona di consegna."],
  ["BELOW_MINIMUM", "BELOW_MINIMUM", "Non hai ancora raggiunto il minimo d'ordine per la tua zona."],
];

async function paymentResult(orderId: string): Promise<CheckoutResultDTO["payment"]> {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const payment = order.payments[0];
  if (!payment || payment.provider === "CASH")
    return { provider: "CASH", clientSecret: null, publishableKey: null, amountCents: order.totalCents };
  const gateway = gatewayFor(payment.provider);
  const open = order.status === "PENDING_PAYMENT" && payment.status !== "SUCCEEDED";
  let clientSecret: string | null = null;
  if (open && gateway) {
    if (!payment.providerPaymentId) {
      // A previous attempt failed to create the intent: create it now (same idempotency key).
      const created = await gateway.createIntent({
        amountCents: payment.amountCents,
        currency: "eur",
        idempotencyKey: payment.idempotencyKey,
        orderId: order.id,
        publicId: order.publicId,
        orderNumber: order.displayNumber,
        email: order.customerEmail,
        description: `Ordine #${order.displayNumber} · DIMSUM`,
      });
      await db.payment.update({
        where: { id: payment.id },
        data: { providerPaymentId: created.providerPaymentId },
      });
      clientSecret = created.clientSecret;
    } else {
      clientSecret = await gateway.clientSecret(payment.providerPaymentId);
    }
  }
  return {
    provider: payment.provider,
    clientSecret,
    publishableKey: payment.provider === "STRIPE" ? (env().NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null) : null,
    amountCents: payment.amountCents,
  };
}

async function resultFor(orderId: string): Promise<CheckoutResultDTO> {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  return {
    orderId: order.id,
    publicId: order.publicId,
    number: order.displayNumber,
    status: order.status,
    payment: await paymentResult(order.id),
    trackingUrl: appUrl(`/order/${order.publicId}`),
  };
}

function assertPaymentMethod(input: CheckoutRequest, config: RestaurantConfig) {
  if (input.paymentMethod === "ONLINE") {
    if (!config.onlinePaymentsEnabled || !features().paymentProvider) {
      throw new AppError("PAYMENT_UNAVAILABLE", "Il pagamento online non è disponibile in questo momento.");
    }
    return;
  }
  const allowed =
    input.fulfillmentType === "DELIVERY" ? config.cashOnDeliveryEnabled : config.cashOnPickupEnabled;
  if (!allowed)
    throw new AppError("VALIDATION_FAILED", "Il pagamento in contanti non è disponibile per questo ordine.");
}

/**
 * Creates an order from a checkout request. Everything is recomputed server-side; the client
 * total is only used to detect changes the customer has not seen yet.
 */
export async function placeOrder(
  input: CheckoutRequest,
  ctx: { viewer: Viewer | null; userAgent: string | null },
): Promise<CheckoutResultDTO> {
  const existing = await db.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true, customerEmail: true },
  });
  if (existing) {
    if (existing.customerEmail !== input.customer.email)
      throw new AppError("CONFLICT", "Richiesta duplicata non valida. Ricarica la pagina.");
    return resultFor(existing.id);
  }

  const config = await loadRestaurantConfig();
  const now = new Date();
  const needsPhone =
    input.fulfillmentType === "DELIVERY" ? config.phoneRequiredForDelivery : config.phoneRequiredForPickup;
  if (needsPhone && !input.customer.phone) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Inserisci un numero di telefono: serve in caso di problemi con l'ordine.",
      {
        fieldErrors: { "customer.phone": ["Numero di telefono obbligatorio."] },
      },
    );
  }
  assertPaymentMethod(input, config);

  const customer = { userId: ctx.viewer?.userId ?? null, email: input.customer.email };
  const quote = await quoteCart(
    {
      lines: input.lines,
      fulfillmentType: input.fulfillmentType,
      delivery: input.address
        ? {
            location: input.address.location,
            precision: input.address.streetNumber ? "rooftop" : input.address.precision,
          }
        : null,
      couponCode: input.couponCode,
      tipCents: input.tipCents,
      scheduledFor: input.scheduledFor,
    },
    { config, now, customer },
  );

  for (const [blocker, code, message] of BLOCKER_ERRORS) {
    if (quote.dto.blockers.includes(blocker)) {
      if (blocker === "BELOW_MINIMUM") {
        throw new AppError(
          code,
          `Aggiungi ancora ${formatEuro(quote.dto.minimumOrderShortfallCents)} per raggiungere il minimo d'ordine.`,
          { details: { quote: quote.dto } },
        );
      }
      throw new AppError(code, message, { details: { quote: quote.dto } });
    }
  }
  const alcoholic = await db.product.count({
    where: { id: { in: quote.lines.map((l) => l.productId) }, tags: { has: "ALCOHOLIC" } },
  });
  if (alcoholic > 0 && !input.ageConfirmed) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Il carrello contiene alcolici: conferma di avere almeno 18 anni.",
      { fieldErrors: { ageConfirmed: ["Conferma richiesta."] } },
    );
  }
  if (quote.dto.totals.totalCents !== input.expectedTotalCents) {
    // Say what actually changed: a promotion the customer can no longer use (e.g. one per person,
    // checked against their e-mail only now) is not a price change.
    const priceChanged = quote.dto.issues.some((i) => i.code === "PRICE_CHANGED");
    const discountChanged =
      input.expectedDiscountCents !== undefined &&
      input.expectedDiscountCents !== quote.dto.totals.discountCents;
    if (discountChanged && !priceChanged) {
      throw new AppError(
        "COUPON_INVALID",
        quote.dto.couponError ??
          "La promozione non è più applicabile al tuo ordine (ad esempio perché l'hai già usata). Controlla il nuovo totale.",
        {
          details: { quote: quote.dto },
        },
      );
    }
    throw new AppError(
      "PRICE_CHANGED",
      "Il prezzo di un prodotto è stato aggiornato. Controlla il nuovo totale prima di confermare.",
      {
        details: { quote: quote.dto },
      },
    );
  }

  const publicId = newPublicId();
  const provider = input.paymentMethod === "ONLINE" ? onlineGateway().name : "CASH";
  const coupon = quote.coupon;
  const t = quote.totals;
  const lineDiscounts = new Map<string, number>();
  if (coupon && coupon.evaluation.itemsDiscountCents > 0) {
    // Persist the per-line share of the discount (VAT reports, partial refunds).
    const eligible = quote.lines.filter((l) => !l.excludedFromDiscounts);
    const base = eligible.reduce((s, l) => s + l.lineTotalCents, 0);
    let left = Math.min(coupon.evaluation.itemsDiscountCents, base);
    eligible.forEach((l, i) => {
      const share =
        i === eligible.length - 1
          ? left
          : Math.floor((coupon.evaluation.itemsDiscountCents * l.lineTotalCents) / base);
      lineDiscounts.set(l.lineId, share);
      left -= share;
    });
  }

  const order = await db
    .$transaction(async (tx) => {
      const [{ nextval }] = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('orders_number_seq')`;
      const number = Number(nextval);

      if (coupon) {
        const updated = await tx.$queryRaw<{ id: string }[]>`
          UPDATE "coupons" SET "redemptionsCount" = "redemptionsCount" + 1
          WHERE "id" = ${coupon.rule.id}::uuid AND "isActive" = true
            AND ("maxRedemptions" IS NULL OR "redemptionsCount" < "maxRedemptions")
          RETURNING "id"`;
        if (updated.length === 0)
          throw new AppError("COUPON_INVALID", "La promozione ha appena raggiunto il limite di utilizzi.", {
            details: { quote: quote.dto },
          });
        if (coupon.rule.perCustomerLimit !== null) {
          const used = await tx.couponRedemption.count({
            where: {
              couponId: coupon.rule.id,
              status: { not: "RELEASED" },
              OR: [
                ...(customer.userId ? [{ userId: customer.userId }] : []),
                { customerEmail: customer.email },
              ],
            },
          });
          if (used >= coupon.rule.perCustomerLimit)
            throw new AppError("COUPON_INVALID", "Hai già utilizzato questa promozione.", {
              details: { quote: quote.dto },
            });
        }
      }

      const a = input.address;
      const created = await tx.order.create({
        data: {
          publicId,
          number,
          displayNumber: formatOrderNumber(config.orderNumberPrefix, number),
          userId: customer.userId,
          status: "PENDING_PAYMENT",
          fulfillmentType: input.fulfillmentType,
          paymentMethod: input.paymentMethod,
          source: input.source,
          customerName: input.customer.name,
          customerEmail: customer.email,
          customerPhone: input.customer.phone,
          ...(input.fulfillmentType === "DELIVERY" && a
            ? {
                addressStreet: a.street,
                addressStreetNumber: a.streetNumber,
                addressPostalCode: a.postalCode,
                addressCity: a.city,
                addressProvince: a.province,
                addressFormatted: a.formatted,
                addressLat: a.location.lat,
                addressLng: a.location.lng,
                staircase: a.staircase,
                floor: a.floor,
                apartment: a.apartment,
                intercom: a.intercom,
                riderNotes: a.riderNotes,
                deliveryZoneId: quote.zone?.id ?? null,
                routeDistanceMeters: quote.route?.distanceMeters ?? null,
                routeDurationSeconds: quote.route?.durationSeconds ?? null,
              }
            : {}),
          isScheduled: !!quote.scheduledFor,
          scheduledFor: quote.scheduledFor,
          kitchenNotes: input.kitchenNotes,
          ageVerified: alcoholic > 0 && input.ageConfirmed,
          subtotalCents: t.subtotalCents,
          discountCents: t.discountCents,
          deliveryFeeCents: t.deliveryFeeCents,
          serviceFeeCents: t.serviceFeeCents,
          tipCents: t.tipCents,
          taxCents: t.taxCents,
          totalCents: t.totalCents,
          vatBreakdown: t.vatBreakdown as unknown as Prisma.InputJsonValue,
          couponId: coupon?.rule.id ?? null,
          couponCode: coupon && !coupon.rule.autoApply ? coupon.rule.code : null,
          placedAt: now,
          idempotencyKey: input.idempotencyKey,
          items: {
            create: quote.lines.map((l, position) => ({
              productId: l.productId,
              variantId: l.variantId,
              name: l.name,
              nameZh: l.nameZh,
              posCode: l.posCode,
              variantName: l.variantName,
              quantity: l.quantity,
              unitPriceCents: l.unitPriceCents,
              lineTotalCents: l.lineTotalCents,
              vatRateBps: l.vatRateBps,
              discountCents: lineDiscounts.get(l.lineId) ?? 0,
              excludedFromDiscounts: l.excludedFromDiscounts,
              notes: l.notes,
              allergens: l.allergens,
              position,
              modifiers: {
                create: l.modifiers.map((m) => ({
                  modifierId: m.modifierId,
                  groupName: m.groupName,
                  name: m.name,
                  quantity: m.quantity,
                  unitPriceCents: m.unitPriceCents,
                })),
              },
            })),
          },
          ...(input.fulfillmentType === "DELIVERY" ? { delivery: { create: {} } } : {}),
          statusHistory: {
            create: {
              status: "PENDING_PAYMENT",
              command: "PLACE",
              actorType: "customer",
              actorUserId: customer.userId,
            },
          },
          payments: {
            create: {
              provider,
              method: input.paymentMethod,
              amountCents: t.totalCents,
              idempotencyKey: `pay_${input.idempotencyKey}`,
            },
          },
        },
      });

      if (coupon) {
        await tx.couponRedemption.create({
          data: {
            couponId: coupon.rule.id,
            orderId: created.id,
            userId: customer.userId,
            customerEmail: customer.email,
            discountCents: t.discountCents,
          },
        });
      }

      if (customer.userId) {
        if (input.saveAddress && input.fulfillmentType === "DELIVERY" && a) {
          const same = await tx.address.findFirst({
            where: { userId: customer.userId, street: a.street, streetNumber: a.streetNumber, city: a.city },
          });
          const fields = {
            postalCode: a.postalCode,
            province: a.province,
            formatted: a.formatted,
            lat: a.location.lat,
            lng: a.location.lng,
            placeId: a.placeId,
            precision: a.precision,
            staircase: a.staircase,
            floor: a.floor,
            apartment: a.apartment,
            intercom: a.intercom,
            riderNotes: a.riderNotes,
            lastUsedAt: now,
          };
          if (same) await tx.address.update({ where: { id: same.id }, data: fields });
          else {
            const count = await tx.address.count({ where: { userId: customer.userId } });
            await tx.address.create({
              data: {
                userId: customer.userId,
                street: a.street,
                streetNumber: a.streetNumber,
                city: a.city,
                country: a.country,
                isDefault: count === 0,
                ...fields,
              },
            });
          }
        }
        if (input.customer.phone) {
          await tx.user.updateMany({
            where: { id: customer.userId, phone: null },
            data: { phone: input.customer.phone },
          });
        }
      }

      if (input.marketingConsent) {
        await recordConsents(
          [{ type: "MARKETING_EMAIL", granted: true }],
          { userId: customer.userId, email: customer.email, source: "checkout", userAgent: ctx.userAgent },
          tx,
        );
      }
      return created;
    })
    .catch((error: unknown) => {
      // Two identical submissions raced: return the order created by the other one.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
      throw error;
    });

  if (!order) {
    const winner = await db.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true },
    });
    if (!winner) throw new AppError("CONFLICT", "Ordine in elaborazione, riprova tra un istante.");
    return resultFor(winner.id);
  }

  logger.info("order placed", {
    orderId: order.id,
    number: order.displayNumber,
    total: order.totalCents,
    method: input.paymentMethod,
  });

  if (input.paymentMethod === "CASH_ON_DELIVERY") {
    await runOrderCommand(order.id, { type: "RECEIVE" }, { actor: "system", userId: null });
    return resultFor(order.id);
  }

  try {
    return await resultFor(order.id);
  } catch (error) {
    logger.error("payment intent creation failed", { error, orderId: order.id });
    throw new AppError(
      "PAYMENT_UNAVAILABLE",
      "Non riusciamo a contattare il sistema di pagamento. Riprova: il tuo ordine non è stato addebitato.",
    );
  }
}
