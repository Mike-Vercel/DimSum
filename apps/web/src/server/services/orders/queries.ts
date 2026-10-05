import "server-only";
import {
  buildTimeline,
  firstNameOf,
  formatOrderNumber,
  isTerminal,
  maskEmail,
  type OrderMilestones,
  type OrderState,
} from "@dimsum/domain";
import type { EtaDTO, OrderStatus, OrderSummaryDTO, OrderTrackingDTO } from "@dimsum/types";
import { db, type Prisma } from "../../db";

export const orderInclude = {
  items: {
    orderBy: { position: "asc" },
    include: { modifiers: true, product: { select: { images: { take: 1, orderBy: { position: "asc" } } } } },
  },
  payments: { orderBy: { createdAt: "desc" } },
  delivery: { include: { rider: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function milestonesOf(o: {
  paidAt: Date | null;
  receivedAt: Date | null;
  confirmedAt: Date | null;
  preparingAt: Date | null;
  readyAt: Date | null;
  riderAssignedAt: Date | null;
  riderToRestaurantAt: Date | null;
  pickedUpAt: Date | null;
  onTheWayAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  refundedAt: Date | null;
}): OrderMilestones {
  return {
    paidAt: o.paidAt,
    receivedAt: o.receivedAt,
    confirmedAt: o.confirmedAt,
    preparingAt: o.preparingAt,
    readyAt: o.readyAt,
    riderAssignedAt: o.riderAssignedAt,
    riderToRestaurantAt: o.riderToRestaurantAt,
    pickedUpAt: o.pickedUpAt,
    onTheWayAt: o.onTheWayAt,
    deliveredAt: o.deliveredAt,
    cancelledAt: o.cancelledAt,
    refundedAt: o.refundedAt,
  };
}

export function stateOf(
  o: {
    fulfillmentType: OrderState["fulfillmentType"];
    paymentMethod: OrderState["paymentMethod"];
  } & Parameters<typeof milestonesOf>[0],
): OrderState {
  return { fulfillmentType: o.fulfillmentType, paymentMethod: o.paymentMethod, milestones: milestonesOf(o) };
}

export function orderNumberLabel(prefix: string, number: number): string {
  return formatOrderNumber(prefix, number);
}

export async function findOrderByPublicId(publicId: string) {
  return db.order.findUnique({ where: { publicId }, include: orderInclude });
}

/** Stored delivery/pickup window as shown to customers and staff ("arriva tra circa N min"). */
export function etaOf(
  o: {
    etaFrom: Date | null;
    etaTo: Date | null;
    status: OrderStatus;
    pickedUpAt: Date | null;
    confirmedAt: Date | null;
  },
  now: Date,
): EtaDTO | null {
  if (!o.etaFrom || !o.etaTo || isTerminal(o.status)) return null;
  return {
    from: o.etaFrom.toISOString(),
    to: o.etaTo.toISOString(),
    minutes: Math.max(
      1,
      Math.round(((o.etaFrom.getTime() + o.etaTo.getTime()) / 2 - now.getTime()) / 60_000),
    ),
    confidence: o.pickedUpAt ? "high" : o.confirmedAt ? "medium" : "low",
  };
}

type AddressFieldsOfOrder = Pick<
  OrderWithRelations,
  "addressStreet" | "addressStreetNumber" | "addressPostalCode" | "addressCity"
>;

export function addressLine(o: AddressFieldsOfOrder): string {
  return [
    `${o.addressStreet ?? ""} ${o.addressStreetNumber ?? ""}`.trim(),
    [o.addressPostalCode, o.addressCity].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Public tracking payload. Contains only what the customer needs: no phone numbers, no rider
 * identity beyond the first name, and the destination only for the map of their own order.
 */
export function toTrackingDTO(
  o: OrderWithRelations,
  restaurant: {
    name: string;
    location: { lat: number; lng: number };
    addressLine: string;
    phone: string | null;
    customerCancelWindowMinutes: number;
  },
  now: Date,
): OrderTrackingDTO {
  const state = stateOf(o);
  const payment = o.payments[0];
  const delivery = o.delivery;
  const liveTracking = o.fulfillmentType === "DELIVERY" && !!o.pickedUpAt && !o.deliveredAt && !o.cancelledAt;
  const withinCancelWindow =
    (now.getTime() - o.placedAt.getTime()) / 60_000 <= restaurant.customerCancelWindowMinutes;
  return {
    publicId: o.publicId,
    number: o.displayNumber,
    status: o.status,
    fulfillmentType: o.fulfillmentType,
    placedAt: o.placedAt.toISOString(),
    scheduledFor: o.scheduledFor?.toISOString() ?? null,
    timeline: buildTimeline(state).map((s) => ({
      key: s.key,
      label: s.label,
      state: s.state,
      at: s.at?.toISOString() ?? null,
    })),
    eta: etaOf(o, now),
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      name: i.name,
      variantName: i.variantName,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      lineTotalCents: i.lineTotalCents,
      modifiers: i.modifiers.map((m) => ({
        name: m.name,
        groupName: m.groupName,
        quantity: m.quantity,
        unitPriceCents: m.unitPriceCents,
      })),
      notes: i.notes,
      allergens: i.allergens,
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
    payment: {
      method: o.paymentMethod,
      status: payment?.status ?? "PENDING",
      brand: payment?.cardBrand ?? null,
      last4: payment?.cardLast4 ?? null,
      wallet: payment?.wallet ?? null,
      refundedCents: payment?.refundedCents ?? 0,
    },
    customer: { firstName: firstNameOf(o.customerName), email: maskEmail(o.customerEmail) },
    delivery:
      o.fulfillmentType === "DELIVERY"
        ? {
            addressLine: addressLine(o),
            destination: {
              lat: o.addressLat ?? restaurant.location.lat,
              lng: o.addressLng ?? restaurant.location.lng,
            },
            status: delivery?.status ?? "UNASSIGNED",
            rider: delivery?.rider
              ? {
                  firstName: delivery.rider.displayName,
                  avatarUrl: delivery.rider.avatarUrl,
                  vehicle: delivery.rider.vehicle,
                }
              : null,
            liveTrackingActive: liveTracking,
          }
        : null,
    restaurant: {
      name: restaurant.name,
      location: restaurant.location,
      addressLine: restaurant.addressLine,
      phone: restaurant.phone,
    },
    cancellationReason: o.cancellationReason,
    canCancel:
      !o.confirmedAt &&
      !o.cancelledAt &&
      !o.deliveredAt &&
      withinCancelWindow &&
      o.status !== "PENDING_PAYMENT",
    isClaimable: !o.userId,
    updatedAt: o.updatedAt.toISOString(),
  };
}

export function toSummaryDTO(o: OrderWithRelations): OrderSummaryDTO {
  const first = o.items[0];
  const image = first?.product?.images[0];
  return {
    id: o.id,
    publicId: o.publicId,
    number: o.displayNumber,
    status: o.status,
    fulfillmentType: o.fulfillmentType,
    placedAt: o.placedAt.toISOString(),
    totalCents: o.totalCents,
    itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
    previewImage: image
      ? {
          url: image.url,
          width: image.width,
          height: image.height,
          alt: image.alt,
          blurDataUrl: image.blurDataUrl,
          dominantColor: image.dominantColor,
          backdrop: image.backdrop,
        }
      : null,
    itemsPreview: o.items
      .slice(0, 3)
      .map((i) => `${i.quantity}× ${i.name}`)
      .join(", "),
  };
}
