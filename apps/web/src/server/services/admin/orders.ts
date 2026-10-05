import "server-only";
import { availableCommands, isTerminal, kitchenColumn, type VatBreakdownRow } from "@dimsum/domain";
import type {
  AdminOrderDetailDTO,
  AdminOrderListItemDTO,
  CollectionState,
  KitchenBoardDTO,
  KitchenItemDTO,
  KitchenOrderDTO,
  OrderStatus,
  Paginated,
  StaffOrderCommand,
} from "@dimsum/types";
import type { adminOrdersQuery } from "@dimsum/validation";
import type { z } from "zod";
import { db, type Prisma } from "../../db";
import { notFound } from "../../errors";
import { addressLine, etaOf, stateOf } from "../orders/queries";
import { computeServiceStatus, loadLiveLoad, loadRestaurantConfig } from "../restaurant";
import { listRiders } from "./riders";

export const adminOrderInclude = {
  items: { orderBy: { position: "asc" }, include: { modifiers: true } },
  payments: { orderBy: { createdAt: "desc" } },
  delivery: { include: { rider: true } },
  deliveryZone: { select: { name: true } },
} satisfies Prisma.OrderInclude;

type AdminOrderRow = Prisma.OrderGetPayload<{ include: typeof adminOrderInclude }>;

export const KITCHEN_STATUSES: OrderStatus[] = [
  "RECEIVED",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "RIDER_ASSIGNED",
  "RIDER_TO_RESTAURANT",
  "PICKED_UP",
  "ON_THE_WAY",
];

/** Orders that never reached the kitchen (abandoned online payments) are not real orders. */
export const REAL_ORDER: Prisma.OrderWhereInput = {
  NOT: [{ status: "PENDING_PAYMENT" }, { status: "CANCELLED", receivedAt: null }],
};

function collectionOf(o: AdminOrderRow): CollectionState {
  if (o.refundedAt) return "REFUNDED";
  if (o.paymentMethod === "CASH_ON_DELIVERY")
    return o.payments.some((p) => p.provider === "CASH" && p.status === "SUCCEEDED") ? "PAID" : "TO_COLLECT";
  return o.paidAt ? "PAID" : "PENDING";
}

function itemsOf(o: AdminOrderRow): KitchenItemDTO[] {
  return o.items.map((i) => ({
    id: i.id,
    name: i.name,
    nameZh: i.nameZh,
    posCode: i.posCode,
    variantName: i.variantName,
    quantity: i.quantity,
    notes: i.notes,
    modifiers: i.modifiers.map((m) => ({ name: m.name, quantity: m.quantity })),
    allergens: i.allergens,
  }));
}

/** When the food must be ready: the scheduled slot (minus the ride) or acceptance + prep time. */
function dueAtOf(o: AdminOrderRow): Date | null {
  if (o.isScheduled && o.scheduledFor) {
    const ride = o.fulfillmentType === "DELIVERY" ? (o.routeDurationSeconds ?? 600) * 1000 : 0;
    return new Date(o.scheduledFor.getTime() - ride);
  }
  if (o.confirmedAt && o.prepMinutes) return new Date(o.confirmedAt.getTime() + o.prepMinutes * 60_000);
  return null;
}

export function staffCommands(o: AdminOrderRow): StaffOrderCommand[] {
  // Full refunds go through the refund flow (payment gateway), never as a bare status change.
  return availableCommands(stateOf(o), "staff").filter((c): c is StaffOrderCommand => c !== "REFUND_FULL");
}

export function toKitchenOrder(
  o: AdminOrderRow,
  ctx: { escalationMinutes: number; now: Date },
): KitchenOrderDTO {
  const dueAt = dueAtOf(o);
  return {
    id: o.id,
    publicId: o.publicId,
    number: o.displayNumber,
    status: o.status,
    column: kitchenColumn(o.status),
    fulfillmentType: o.fulfillmentType,
    paymentMethod: o.paymentMethod,
    collection: collectionOf(o),
    totalCents: o.totalCents,
    placedAt: o.placedAt.toISOString(),
    receivedAt: o.receivedAt?.toISOString() ?? null,
    confirmedAt: o.confirmedAt?.toISOString() ?? null,
    readyAt: o.readyAt?.toISOString() ?? null,
    scheduledFor: o.isScheduled ? (o.scheduledFor?.toISOString() ?? null) : null,
    prepMinutes: o.prepMinutes,
    dueAt: dueAt?.toISOString() ?? null,
    eta: etaOf(o, ctx.now),
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    addressLine: o.fulfillmentType === "DELIVERY" ? addressLine(o) : null,
    zoneName: o.deliveryZone?.name ?? null,
    kitchenNotes: o.kitchenNotes,
    items: itemsOf(o),
    itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
    rider: o.delivery?.rider ? { id: o.delivery.rider.id, name: o.delivery.rider.displayName } : null,
    deliveryStatus: o.delivery?.status ?? null,
    escalated:
      o.status === "RECEIVED" &&
      !!o.receivedAt &&
      ctx.now.getTime() - o.receivedAt.getTime() > ctx.escalationMinutes * 60_000,
    commands: staffCommands(o),
  };
}

export function toAdminListItem(o: AdminOrderRow): AdminOrderListItemDTO {
  return {
    id: o.id,
    publicId: o.publicId,
    number: o.displayNumber,
    status: o.status,
    fulfillmentType: o.fulfillmentType,
    paymentMethod: o.paymentMethod,
    collection: collectionOf(o),
    placedAt: o.placedAt.toISOString(),
    scheduledFor: o.isScheduled ? (o.scheduledFor?.toISOString() ?? null) : null,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    totalCents: o.totalCents,
    itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
    riderName: o.delivery?.rider?.displayName ?? null,
    zoneName: o.deliveryZone?.name ?? null,
  };
}

/** Live kitchen display: every order the kitchen or the riders still have to work on. */
export async function getKitchenBoard(now = new Date()): Promise<KitchenBoardDTO> {
  // Fresh (uncached) configuration: a pause or a new prep time must show up immediately.
  const [config, load, rows, riders] = await Promise.all([
    loadRestaurantConfig(),
    loadLiveLoad(),
    db.order.findMany({
      where: { status: { in: KITCHEN_STATUSES } },
      include: adminOrderInclude,
      orderBy: [{ receivedAt: "asc" }, { placedAt: "asc" }],
    }),
    listRiders(now),
  ]);
  return {
    orders: rows.map((o) =>
      toKitchenOrder(o, { escalationMinutes: config.acceptanceEscalationMinutes, now }),
    ),
    riders,
    settings: {
      prepTimeOptions: config.prepTimeOptions,
      defaultPrepMinutes: config.defaultPrepMinutes,
      acceptanceEscalationMinutes: config.acceptanceEscalationMinutes,
      newOrderSoundEnabled: config.newOrderSoundEnabled,
      newOrderSound: config.newOrderSound,
      autoAcceptOrders: config.autoAcceptOrders,
    },
    status: computeServiceStatus(config, load, now),
    serverTime: now.toISOString(),
  };
}

const STATUS_GROUPS: Record<string, OrderStatus[]> = {
  active: KITCHEN_STATUSES,
  done: ["DELIVERED"],
  cancelled: ["CANCELLED", "REFUNDED"],
};

export async function listAdminOrders(
  query: z.output<typeof adminOrdersQuery>,
): Promise<Paginated<AdminOrderListItemDTO>> {
  const statuses = query.status
    ? query.status.split(",").flatMap((s) => STATUS_GROUPS[s] ?? (s ? [s as OrderStatus] : []))
    : null;
  const q = query.q?.trim();
  const numeric = q?.replace(/^[A-Za-z]+/, "");
  const where: Prisma.OrderWhereInput = {
    AND: [
      REAL_ORDER,
      statuses ? { status: { in: statuses } } : {},
      query.fulfillmentType ? { fulfillmentType: query.fulfillmentType } : {},
      query.from || query.to
        ? {
            placedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: new Date(query.to) } : {}),
            },
          }
        : {},
      q
        ? {
            OR: [
              ...(numeric && /^\d+$/.test(numeric) ? [{ number: Number(numeric) }] : []),
              { customerName: { contains: q, mode: "insensitive" as const } },
              { customerEmail: { contains: q, mode: "insensitive" as const } },
              { customerPhone: { contains: q.replace(/\s+/g, "") } },
            ],
          }
        : {},
    ],
  };
  const rows = await db.order.findMany({
    where,
    include: adminOrderInclude,
    orderBy: [{ placedAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, query.limit);
  return {
    items: page.map(toAdminListItem),
    nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function getAdminOrder(orderId: string, now = new Date()): Promise<AdminOrderDetailDTO> {
  const [o, config] = await Promise.all([
    db.order.findUnique({
      where: { id: orderId },
      include: {
        ...adminOrderInclude,
        refunds: { orderBy: { createdAt: "desc" }, include: { createdBy: { select: { name: true } } } },
        statusHistory: { orderBy: { createdAt: "asc" } },
        coupon: { select: { code: true, name: true } },
        emails: {
          orderBy: { createdAt: "asc" },
          select: { template: true, subject: true, status: true, createdAt: true },
        },
        supportTickets: { select: { id: true, reference: true, status: true, subject: true } },
      },
    }),
    loadRestaurantConfig(),
  ]);
  if (!o) throw notFound("Ordine");

  const actorIds = [...new Set(o.statusHistory.flatMap((h) => (h.actorUserId ? [h.actorUserId] : [])))];
  const actors = actorIds.length
    ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const actorName = new Map(actors.map((a) => [a.id, a.name]));

  const onlinePayment = o.payments.find(
    (p) => p.provider !== "CASH" && (p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED"),
  );
  const rider = o.delivery?.rider;
  const live =
    rider &&
    o.delivery &&
    !isTerminal(o.status) &&
    rider.lastLat !== null &&
    rider.lastLng !== null &&
    rider.lastLocationAt;

  return {
    ...toKitchenOrder(o, { escalationMinutes: config.acceptanceEscalationMinutes, now }),
    customerEmail: o.customerEmail,
    customerUserId: o.userId,
    address:
      o.fulfillmentType === "DELIVERY"
        ? {
            line: addressLine(o),
            formatted: o.addressFormatted,
            location:
              o.addressLat !== null && o.addressLng !== null
                ? { lat: o.addressLat, lng: o.addressLng }
                : null,
            staircase: o.staircase,
            floor: o.floor,
            apartment: o.apartment,
            intercom: o.intercom,
            riderNotes: o.riderNotes,
          }
        : null,
    routeDistanceMeters: o.routeDistanceMeters,
    routeDurationSeconds: o.routeDurationSeconds,
    lines: o.items.map((i) => ({
      id: i.id,
      name: i.name,
      nameZh: i.nameZh,
      posCode: i.posCode,
      variantName: i.variantName,
      quantity: i.quantity,
      notes: i.notes,
      allergens: i.allergens,
      unitPriceCents: i.unitPriceCents,
      lineTotalCents: i.lineTotalCents,
      vatRateBps: i.vatRateBps,
      modifiers: i.modifiers.map((m) => ({
        name: m.name,
        quantity: m.quantity,
        unitPriceCents: m.unitPriceCents,
      })),
    })),
    totals: {
      subtotalCents: o.subtotalCents,
      discountCents: o.discountCents,
      deliveryFeeCents: o.deliveryFeeCents,
      serviceFeeCents: o.serviceFeeCents,
      tipCents: o.tipCents,
      taxCents: o.taxCents,
      totalCents: o.totalCents,
      vatBreakdown: (o.vatBreakdown as unknown as VatBreakdownRow[] | null) ?? [],
    },
    coupon: o.coupon
      ? { code: o.coupon.code, name: o.coupon.name }
      : o.couponCode
        ? { code: o.couponCode, name: o.couponCode }
        : null,
    payments: o.payments.map((p) => ({
      id: p.id,
      provider: p.provider,
      status: p.status,
      amountCents: p.amountCents,
      refundedCents: p.refundedCents,
      cardBrand: p.cardBrand,
      cardLast4: p.cardLast4,
      wallet: p.wallet,
      providerPaymentId: p.providerPaymentId,
      failureMessage: p.failureMessage,
      createdAt: p.createdAt.toISOString(),
    })),
    refunds: o.refunds.map((r) => ({
      id: r.id,
      amountCents: r.amountCents,
      reason: r.reason,
      status: r.status,
      createdBy: r.createdBy?.name ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    refundableCents: onlinePayment ? onlinePayment.amountCents - onlinePayment.refundedCents : 0,
    history: o.statusHistory.map((h) => ({
      id: h.id,
      status: h.status,
      command: h.command,
      actorType: h.actorType,
      actorName: h.actorUserId ? (actorName.get(h.actorUserId) ?? null) : null,
      note: h.note,
      createdAt: h.createdAt.toISOString(),
    })),
    riderLocation: live
      ? {
          lat: rider.lastLat!,
          lng: rider.lastLng!,
          heading: rider.lastHeading,
          speed: null,
          accuracy: null,
          recordedAt: rider.lastLocationAt!.toISOString(),
        }
      : null,
    cancellationReason: o.cancellationReason,
    cancelledBy: o.cancelledBy,
    emails: o.emails.map((e) => ({
      template: e.template,
      subject: e.subject,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
    })),
    supportTickets: o.supportTickets,
  };
}
