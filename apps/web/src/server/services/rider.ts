import "server-only";
import { applyCommand, firstNameOf, haversineMeters, type OrderCommand } from "@dimsum/domain";
import type { RiderActionKey, RiderDeliveryDTO, RiderHomeDTO } from "@dimsum/types";
import type { RiderDeliveryAction, riderLocationInput } from "@dimsum/validation";
import type { z } from "zod";
import { runAfter } from "../background";
import { db, type Prisma } from "../db";
import { AppError } from "../errors";
import { publish } from "../realtime/bus";
import { dayStart } from "./admin/time";
import { notifyCustomer } from "./notifications";
import { refreshOrderEta } from "./orders/eta";
import { runOrderCommand } from "./orders/commands";
import { addressLine, etaOf, stateOf } from "./orders/queries";
import { getRestaurantConfig } from "./restaurant";

const ACTIVE = ["ASSIGNED", "TO_RESTAURANT", "AT_RESTAURANT", "PICKED_UP", "ON_THE_WAY"] as const;
/** Distance at which the customer gets "il rider sta arrivando". */
const NEARBY_METERS = 350;

const deliveryInclude = {
  order: { include: { items: { orderBy: { position: "asc" }, select: { name: true, quantity: true } } } },
} satisfies Prisma.DeliveryInclude;

type DeliveryRow = Prisma.DeliveryGetPayload<{ include: typeof deliveryInclude }>;

export async function riderOf(userId: string) {
  const rider = await db.rider.findUnique({ where: { userId } });
  if (!rider || !rider.isActive)
    throw new AppError("FORBIDDEN", "Il tuo profilo rider non è attivo. Contatta il ristorante.");
  return rider;
}

function actionsFor(d: DeliveryRow, now: Date): RiderActionKey[] {
  const state = stateOf(d.order);
  const can = (c: OrderCommand) => applyCommand(state, c, "rider", now).ok;
  const actions: RiderActionKey[] = [];
  if (can({ type: "RIDER_TO_RESTAURANT" })) actions.push("TO_RESTAURANT");
  if (d.status === "ASSIGNED" || d.status === "TO_RESTAURANT") actions.push("ARRIVED");
  if (can({ type: "PICK_UP" })) actions.push("PICKED_UP");
  if (can({ type: "START_DELIVERY" })) actions.push("START_DELIVERY");
  if (d.order.pickedUpAt && can({ type: "DELIVER" })) actions.push("DELIVERED");
  return actions;
}

function toRiderDelivery(d: DeliveryRow, now: Date): RiderDeliveryDTO {
  const o = d.order;
  const readyBy =
    o.confirmedAt && o.prepMinutes ? new Date(o.confirmedAt.getTime() + o.prepMinutes * 60_000) : null;
  return {
    orderId: o.id,
    deliveryId: d.id,
    number: o.displayNumber,
    status: d.status,
    orderStatus: o.status,
    assignedAt: d.assignedAt?.toISOString() ?? null,
    readyBy: readyBy?.toISOString() ?? null,
    readyAt: o.readyAt?.toISOString() ?? null,
    customer: { firstName: firstNameOf(o.customerName), phone: o.customerPhone },
    destination: {
      addressLine: addressLine(o),
      location:
        o.addressLat !== null && o.addressLng !== null ? { lat: o.addressLat, lng: o.addressLng } : null,
      staircase: o.staircase,
      floor: o.floor,
      apartment: o.apartment,
      intercom: o.intercom,
      notes: o.riderNotes,
    },
    items: o.items,
    itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
    collectCents: o.paymentMethod === "CASH_ON_DELIVERY" ? o.totalCents : null,
    tipCents: o.tipCents,
    eta: etaOf(o, now),
    actions: actionsFor(d, now),
  };
}

export async function getRiderHome(userId: string, now = new Date()): Promise<RiderHomeDTO> {
  const [rider, config] = await Promise.all([riderOf(userId), getRestaurantConfig()]);
  const since = dayStart(now, config.timezone);
  const [active, delivered] = await Promise.all([
    db.delivery.findMany({
      where: { riderId: rider.id, status: { in: [...ACTIVE] } },
      include: deliveryInclude,
      orderBy: { assignedAt: "asc" },
    }),
    db.delivery.findMany({
      where: { riderId: rider.id, status: "DELIVERED", deliveredAt: { gte: since } },
      select: {
        cashCollectedCents: true,
        order: { select: { tipCents: true, paymentMethod: true, totalCents: true } },
      },
    }),
  ]);
  return {
    rider: {
      id: rider.id,
      name: rider.displayName,
      vehicle: rider.vehicle,
      availability: rider.availability,
    },
    restaurant: {
      name: config.name,
      addressLine: config.address.formatted,
      location: config.location,
      phone: config.phone,
      timezone: config.timezone,
    },
    deliveries: active.map((d) => toRiderDelivery(d, now)),
    today: {
      delivered: delivered.length,
      tipsCents: delivered.reduce((s, d) => s + d.order.tipCents, 0),
      cashCollectedCents: delivered
        .filter((d) => d.order.paymentMethod === "CASH_ON_DELIVERY")
        .reduce((s, d) => s + (d.cashCollectedCents ?? d.order.totalCents), 0),
    },
    shareLocation: rider.availability !== "OFFLINE" && active.some((d) => d.status !== "ASSIGNED"),
  };
}

/** Start/end of shift. A rider with deliveries in progress cannot go offline. */
export async function setRiderOnline(userId: string, online: boolean): Promise<RiderHomeDTO> {
  const rider = await riderOf(userId);
  const active = await db.delivery.count({ where: { riderId: rider.id, status: { in: [...ACTIVE] } } });
  if (!online && active > 0)
    throw new AppError("CONFLICT", "Hai consegne in corso: completale prima di chiudere il turno.");
  const availability = online ? (active > 0 ? "BUSY" : "AVAILABLE") : "OFFLINE";
  await db.rider.update({
    where: { id: rider.id },
    // Off shift the last position is forgotten: nobody needs to know where the rider is.
    data: {
      availability,
      lastSeenAt: new Date(),
      ...(online ? {} : { lastLat: null, lastLng: null, lastHeading: null, lastLocationAt: null }),
    },
  });
  await publish(["riders", "kitchen", `rider:${rider.id}`], {
    type: "rider.status",
    riderId: rider.id,
    availability,
  });
  return getRiderHome(userId);
}

const COMMAND: Record<Exclude<RiderActionKey, "ARRIVED">, OrderCommand["type"]> = {
  TO_RESTAURANT: "RIDER_TO_RESTAURANT",
  PICKED_UP: "PICK_UP",
  START_DELIVERY: "START_DELIVERY",
  DELIVERED: "DELIVER",
};

export async function riderDeliveryAction(
  userId: string,
  orderId: string,
  input: RiderDeliveryAction,
): Promise<RiderHomeDTO> {
  const rider = await riderOf(userId);
  const delivery = await db.delivery.findUnique({
    where: { orderId },
    include: { order: { select: { publicId: true, status: true, paymentMethod: true, totalCents: true } } },
  });
  if (!delivery || delivery.riderId !== rider.id) throw new AppError("NOT_FOUND", "Consegna non trovata.");

  if (input.action === "ARRIVED") {
    if (delivery.status !== "ASSIGNED" && delivery.status !== "TO_RESTAURANT")
      throw new AppError("INVALID_TRANSITION", "Hai già ritirato l'ordine.");
    await db.delivery.update({
      where: { id: delivery.id },
      data: {
        status: "AT_RESTAURANT",
        arrivedAtRestaurantAt: new Date(),
        toRestaurantAt: delivery.toRestaurantAt ?? new Date(),
      },
    });
    await publish(["kitchen", "riders", `rider:${rider.id}`], {
      type: "order.updated",
      orderId,
      publicId: delivery.order.publicId,
      status: delivery.order.status,
      updatedAt: new Date().toISOString(),
    });
    return getRiderHome(userId);
  }

  if (input.action === "DELIVERED" && delivery.order.paymentMethod === "CASH_ON_DELIVERY") {
    await db.delivery.update({
      where: { id: delivery.id },
      data: { cashCollectedCents: input.cashCollectedCents ?? delivery.order.totalCents },
    });
  }
  await runOrderCommand(orderId, { type: COMMAND[input.action] } as OrderCommand, {
    actor: "rider",
    userId,
    role: "RIDER",
  });
  return getRiderHome(userId);
}

/**
 * Positions sent by the rider app during a delivery only. Stored for the live map and the ETA,
 * shown to the customer only after pickup, purged by the retention job.
 */
export async function recordRiderLocation(
  userId: string,
  input: z.output<typeof riderLocationInput>,
): Promise<{ tracking: boolean }> {
  const rider = await riderOf(userId);
  if (rider.availability === "OFFLINE") return { tracking: false };
  const active = await db.delivery.findMany({
    where: { riderId: rider.id, status: { in: [...ACTIVE] } },
    include: {
      order: { select: { id: true, publicId: true, addressLat: true, addressLng: true, pickedUpAt: true } },
    },
  });
  // No delivery in progress: tell the app to stop sharing the position.
  if (active.length === 0) return { tracking: false };

  const points = input.points.toSorted((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const now = Date.now();
  // Ignore clock-skewed or stale points (older than 10 minutes or in the future).
  const valid = points.filter((p) => {
    const t = new Date(p.recordedAt).getTime();
    return t > now - 10 * 60_000 && t < now + 60_000;
  });
  const latest = valid.at(-1);
  if (!latest) return { tracking: true };
  const deliveryId =
    input.deliveryId && active.some((d) => d.id === input.deliveryId)
      ? input.deliveryId
      : (active[0]?.id ?? null);

  await db.$transaction([
    db.riderLocation.createMany({
      data: valid.map((p) => ({
        riderId: rider.id,
        deliveryId,
        lat: p.lat,
        lng: p.lng,
        accuracy: p.accuracy,
        heading: p.heading,
        speed: p.speed,
        recordedAt: new Date(p.recordedAt),
      })),
    }),
    db.rider.update({
      where: { id: rider.id },
      data: {
        lastLat: latest.lat,
        lastLng: latest.lng,
        lastHeading: latest.heading,
        lastLocationAt: new Date(latest.recordedAt),
        lastSeenAt: new Date(),
      },
    }),
  ]);

  const location = {
    lat: Math.round(latest.lat * 1e5) / 1e5,
    lng: Math.round(latest.lng * 1e5) / 1e5,
    heading: latest.heading,
    speed: latest.speed,
    accuracy: latest.accuracy,
    recordedAt: latest.recordedAt,
  };
  for (const d of active) {
    // Customers see the rider only once their order has been picked up.
    if (d.order.pickedUpAt) {
      await publish([`order:${d.order.publicId}`], {
        type: "rider.location",
        orderId: d.order.id,
        publicId: d.order.publicId,
        location,
      });
    }
  }
  await publish(["riders"], {
    type: "rider.location",
    orderId: active[0]!.order.id,
    publicId: active[0]!.order.publicId,
    location,
  });

  runAfter(async () => {
    for (const d of active) {
      await refreshOrderEta(d.order.id);
      const dest =
        d.order.addressLat !== null && d.order.addressLng !== null
          ? { lat: d.order.addressLat, lng: d.order.addressLng }
          : null;
      if (
        dest &&
        d.order.pickedUpAt &&
        !d.nearbyNotifiedAt &&
        haversineMeters(latest, dest) <= NEARBY_METERS
      ) {
        const claimed = await db.delivery.updateMany({
          where: { id: d.id, nearbyNotifiedAt: null },
          data: { nearbyNotifiedAt: new Date() },
        });
        if (claimed.count === 1) await notifyCustomer(d.order.id, "RIDER_NEARBY");
      }
    }
  });
  return { tracking: true };
}
