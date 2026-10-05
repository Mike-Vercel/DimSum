import "server-only";
import { firstNameOf, formatEuro, formatTime } from "@dimsum/domain";
import type { NotificationType } from "@dimsum/types";
import { db } from "../db";
import {
  brandContext,
  deliveredEmail,
  orderCancelledEmail,
  orderConfirmedEmail,
  orderReceivedEmail,
  outForDeliveryEmail,
  paymentConfirmedEmail,
  readyForPickupEmail,
  refundEmail,
  sendEmail,
  type OrderEmailData,
  type RenderedEmail,
} from "../email";
import { appUrl } from "../env";
import { logger } from "../logger";
import { publish } from "../realtime/bus";
import { pushTo } from "./push";
import { getRestaurantConfig } from "./restaurant";

type Order = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

async function loadOrder(orderId: string) {
  return db.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { modifiers: true }, orderBy: { position: "asc" } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      delivery: { include: { rider: true } },
    },
  });
}

function paymentLabel(o: Order): string {
  if (o.paymentMethod === "CASH_ON_DELIVERY")
    return o.fulfillmentType === "DELIVERY" ? "Contanti alla consegna" : "Contanti al ritiro";
  const p = o.payments[0];
  if (p?.wallet === "apple_pay") return "Apple Pay";
  if (p?.wallet === "google_pay") return "Google Pay";
  if (p?.cardBrand && p.cardLast4) return `${p.cardBrand.toUpperCase()} •••• ${p.cardLast4}`;
  return p?.provider === "DEV" ? "Pagamento di prova" : "Carta";
}

async function emailData(
  o: Order,
  extra: { reason?: string | null; refundCents?: number },
): Promise<OrderEmailData> {
  const config = await getRestaurantConfig();
  const tz = config.timezone;
  const when =
    o.etaFrom && o.etaTo
      ? `${formatTime(o.etaFrom, tz)}–${formatTime(o.etaTo, tz)}`
      : o.scheduledFor
        ? formatTime(o.scheduledFor, tz)
        : null;
  return {
    number: o.displayNumber,
    trackingUrl: appUrl(`/order/${o.publicId}`),
    customerFirstName: firstNameOf(o.customerName) || "ciao",
    fulfillmentType: o.fulfillmentType,
    placedAtLabel: formatTime(o.placedAt, tz),
    whenLabel: when,
    addressLine:
      o.fulfillmentType === "DELIVERY"
        ? `${o.addressStreet} ${o.addressStreetNumber}, ${o.addressCity}`
        : null,
    paymentLabel: paymentLabel(o),
    lines: o.items.map((i) => ({
      quantity: i.quantity,
      name: i.variantName ? `${i.name} (${i.variantName})` : i.name,
      details: [
        ...i.modifiers.map((m) => `${m.quantity > 1 ? `${m.quantity}× ` : ""}${m.name}`),
        ...(i.notes ? [`“${i.notes}”`] : []),
      ],
      totalCents: i.lineTotalCents,
    })),
    totals: {
      subtotalCents: o.subtotalCents,
      discountCents: o.discountCents,
      deliveryFeeCents: o.deliveryFeeCents,
      serviceFeeCents: o.serviceFeeCents,
      tipCents: o.tipCents,
      taxCents: o.taxCents,
      totalCents: o.totalCents,
    },
    isGuest: !o.userId,
    signupUrl: appUrl(`/registrati?email=${encodeURIComponent(o.customerEmail)}&ordine=${o.publicId}`),
    riderName: o.delivery?.rider?.displayName ?? null,
    cancellationReason: extra.reason ?? o.cancellationReason,
    refundCents: extra.refundCents ?? 0,
    reviewUrl: config.googleReviewUrl,
  };
}

interface CustomerMessage {
  title: string;
  body: string;
  email?: (brand: Awaited<ReturnType<typeof brandContext>>, data: OrderEmailData) => RenderedEmail;
}

function customerMessage(
  type: NotificationType,
  o: Order,
  extra: { refundCents?: number },
): CustomerMessage | null {
  const n = `#${o.displayNumber}`;
  const rider = o.delivery?.rider?.displayName;
  switch (type) {
    case "ORDER_RECEIVED":
      return {
        title: "Ordine ricevuto",
        body: `Abbiamo ricevuto l'ordine ${n}. Ti avvisiamo appena la cucina lo conferma.`,
        ...(o.paymentMethod === "CASH_ON_DELIVERY" ? { email: orderReceivedEmail } : {}),
      };
    case "PAYMENT_CONFIRMED":
      return {
        title: "Pagamento confermato",
        body: `Pagamento di ${formatEuro(o.totalCents)} ricevuto per l'ordine ${n}.`,
        email: paymentConfirmedEmail,
      };
    case "ORDER_CONFIRMED":
      return {
        title: "Ordine confermato",
        body: `La cucina ha confermato l'ordine ${n}.`,
        email: orderConfirmedEmail,
      };
    case "ORDER_PREPARING":
      return { title: "In preparazione", body: `Stiamo preparando il tuo ordine ${n}.` };
    case "ORDER_READY":
      return o.fulfillmentType === "PICKUP"
        ? {
            title: "Pronto per il ritiro",
            body: `L'ordine ${n} ti aspetta al banco.`,
            email: readyForPickupEmail,
          }
        : { title: "Ordine pronto", body: `L'ordine ${n} è pronto: il rider sta per ritirarlo.` };
    case "RIDER_ASSIGNED":
      return {
        title: "Rider assegnato",
        body: rider ? `${rider} consegnerà il tuo ordine ${n}.` : `Un rider consegnerà il tuo ordine ${n}.`,
      };
    case "ORDER_PICKED_UP":
      return {
        title: "In consegna",
        body: rider
          ? `${rider} ha ritirato l'ordine ed è in viaggio verso di te.`
          : `Il tuo ordine ${n} è in viaggio.`,
        email: outForDeliveryEmail,
      };
    case "RIDER_NEARBY":
      return {
        title: "Il rider sta arrivando",
        body: rider ? `${rider} è quasi da te: tieni d'occhio il citofono.` : "Il rider è quasi da te.",
      };
    case "ORDER_DELIVERED":
      return {
        title:
          o.fulfillmentType === "DELIVERY" ? "Consegnato. Buon appetito!" : "Ordine ritirato. Buon appetito!",
        body: `Grazie per aver ordinato da DIMSUM.`,
        email: deliveredEmail,
      };
    case "ORDER_CANCELLED":
      return {
        title: "Ordine annullato",
        body: `L'ordine ${n} è stato annullato.`,
        email: orderCancelledEmail,
      };
    case "REFUND_ISSUED":
      return {
        title: "Rimborso in arrivo",
        body: `Rimborso di ${formatEuro(extra.refundCents ?? 0)} per l'ordine ${n}.`,
        email: refundEmail,
      };
    default:
      return null;
  }
}

/**
 * Customer notifications for an order event, on every channel the customer can receive:
 * in-app (accounts), Web Push (accounts and guest subscriptions of this order) and e-mail for
 * the relevant steps. Transactional only — no consent needed, never promotional content.
 */
export async function notifyCustomer(
  orderId: string,
  type: NotificationType,
  extra: { reason?: string | null; refundCents?: number } = {},
): Promise<void> {
  try {
    const o = await loadOrder(orderId);
    if (!o) return;
    const msg = customerMessage(type, o, extra);
    if (!msg) return;
    const url = `/order/${o.publicId}`;

    if (o.userId) {
      const notification = await db.notification.create({
        data: {
          userId: o.userId,
          orderId: o.id,
          type,
          category: "TRANSACTIONAL",
          title: msg.title,
          body: msg.body,
          url,
        },
      });
      await publish([`user:${o.userId}`], {
        type: "notification",
        notification: {
          id: notification.id,
          type,
          title: msg.title,
          body: msg.body,
          url,
          readAt: null,
          createdAt: notification.createdAt.toISOString(),
        },
      });
    }

    await pushTo(
      { topic: "customer", OR: [{ orderId: o.id }, ...(o.userId ? [{ userId: o.userId }] : [])] },
      { title: msg.title, body: msg.body, url, tag: `order-${o.publicId}`, kind: "order" },
    );

    if (msg.email) {
      const [brand, data] = await Promise.all([brandContext(), emailData(o, extra)]);
      await sendEmail({ to: o.customerEmail, email: msg.email(brand, data), orderId: o.id });
    }
  } catch (error) {
    logger.error("customer notification failed", { error, orderId, type });
  }
}

/** New order alert for the kitchen (push on staff devices; the board also gets a realtime event). */
export async function notifyStaff(orderId: string, type: "NEW_ORDER" | "ORDER_ESCALATION"): Promise<void> {
  try {
    const o = await db.order.findUnique({
      where: { id: orderId },
      select: { displayNumber: true, totalCents: true, fulfillmentType: true, receivedAt: true },
    });
    if (!o) return;
    const title =
      type === "NEW_ORDER" ? `Nuovo ordine #${o.displayNumber}` : `Ordine #${o.displayNumber} in attesa`;
    const minutes = o.receivedAt ? Math.round((Date.now() - o.receivedAt.getTime()) / 60_000) : 0;
    const body =
      type === "NEW_ORDER"
        ? `${o.fulfillmentType === "DELIVERY" ? "Consegna" : "Ritiro"} · ${formatEuro(o.totalCents)} — da accettare`
        : `Nessuno lo ha ancora accettato (da ${minutes} min).`;
    await db.notification.create({
      data: { audience: "STAFF", orderId, type, category: "OPERATIONAL", title, body, url: `/admin/cucina` },
    });
    await pushTo(
      { topic: "staff" },
      {
        title,
        body,
        url: "/admin/cucina",
        tag: `staff-${orderId}`,
        requireInteraction: true,
        kind: "staff-new-order",
      },
    );
  } catch (error) {
    logger.error("staff notification failed", { error, orderId, type });
  }
}

export async function notifyRiderAssigned(orderId: string, riderUserId: string): Promise<void> {
  try {
    const o = await db.order.findUnique({
      where: { id: orderId },
      select: { displayNumber: true, addressStreet: true, addressStreetNumber: true },
    });
    if (!o) return;
    const title = `Nuova consegna #${o.displayNumber}`;
    const body = `Destinazione: ${o.addressStreet ?? ""} ${o.addressStreetNumber ?? ""}`.trim();
    await db.notification.create({
      data: {
        audience: "RIDER",
        userId: riderUserId,
        orderId,
        type: "DELIVERY_ASSIGNED",
        category: "OPERATIONAL",
        title,
        body,
        url: "/rider",
      },
    });
    await pushTo(
      { userId: riderUserId, topic: "rider" },
      {
        title,
        body,
        url: "/rider",
        tag: `rider-${orderId}`,
        requireInteraction: true,
        kind: "rider-assignment",
      },
    );
  } catch (error) {
    logger.error("rider notification failed", { error, orderId });
  }
}
