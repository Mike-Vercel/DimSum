import "server-only";
import { applyCommand, type Actor, type OrderCommand } from "@dimsum/domain";
import type { NotificationType, OrderStatus, Role } from "@dimsum/types";
import { audit } from "../../audit";
import { runAfter } from "../../background";
import { db, type Prisma } from "../../db";
import { AppError } from "../../errors";
import { publish, type Channel } from "../../realtime/bus";
import { refreshCustomerStats } from "../customers";
import { awardOrderPoints } from "../loyalty";
import { notifyCustomer, notifyRiderAssigned, notifyStaff } from "../notifications";
import { getRestaurantConfig } from "../restaurant";
import { refreshOrderEta } from "./eta";
import { stateOf } from "./queries";

export interface CommandContext {
  actor: Actor;
  userId: string | null;
  /** Role of the signed-in person, recorded in the audit log for staff actions. */
  role?: Role;
  note?: string | null;
}

type Tx = Prisma.TransactionClient;

async function lockOrder(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId}::uuid FOR UPDATE`;
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { delivery: true } });
  if (!order) throw new AppError("NOT_FOUND", "Ordine non trovato.");
  return order;
}

async function syncRiderAvailability(tx: Tx, riderId: string) {
  const rider = await tx.rider.findUnique({ where: { id: riderId } });
  if (!rider || rider.availability === "OFFLINE") return;
  const active = await tx.delivery.count({
    where: {
      riderId,
      status: { in: ["ASSIGNED", "TO_RESTAURANT", "AT_RESTAURANT", "PICKED_UP", "ON_THE_WAY"] },
    },
  });
  await tx.rider.update({
    where: { id: riderId },
    data: { availability: active > 0 ? "BUSY" : "AVAILABLE" },
  });
}

const NOTIFY: Partial<Record<OrderCommand["type"], NotificationType>> = {
  CONFIRM: "ORDER_CONFIRMED",
  START_PREPARING: "ORDER_PREPARING",
  MARK_READY: "ORDER_READY",
  ASSIGN_RIDER: "RIDER_ASSIGNED",
  PICK_UP: "ORDER_PICKED_UP",
  DELIVER: "ORDER_DELIVERED",
  CANCEL: "ORDER_CANCELLED",
  REJECT: "ORDER_CANCELLED",
};

const ETA_COMMANDS = new Set<OrderCommand["type"]>([
  "RECEIVE",
  "CONFIRM",
  "START_PREPARING",
  "MARK_READY",
  "ASSIGN_RIDER",
  "UNASSIGN_RIDER",
  "RIDER_TO_RESTAURANT",
  "PICK_UP",
  "START_DELIVERY",
]);

/**
 * Applies an order command: validated by the domain state machine inside a row-locked
 * transaction, recorded in the status history, then broadcast and notified after commit.
 */
export async function runOrderCommand(orderId: string, command: OrderCommand, ctx: CommandContext) {
  const now = new Date();
  const previousRiderIds: string[] = [];

  const result = await db.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    const transition = applyCommand(stateOf(order), command, ctx.actor, now);
    if (!transition.ok)
      throw new AppError("INVALID_TRANSITION", transition.message, { details: { code: transition.error } });

    const data: Prisma.OrderUpdateInput = { ...transition.milestones, status: transition.status };
    const metadata: Record<string, unknown> = {};

    switch (command.type) {
      case "CONFIRM":
        data.prepMinutes = command.prepMinutes;
        metadata.prepMinutes = command.prepMinutes;
        break;
      case "REJECT":
      case "CANCEL":
        data.cancellationReason = command.reason;
        data.cancelledBy = ctx.actor;
        break;
      default:
        break;
    }

    if (order.fulfillmentType === "DELIVERY") {
      const delivery = order.delivery ?? (await tx.delivery.create({ data: { orderId: order.id } }));
      if (delivery.riderId) previousRiderIds.push(delivery.riderId);
      const d: Prisma.DeliveryUpdateInput = {};
      switch (command.type) {
        case "ASSIGN_RIDER": {
          const rider = await tx.rider.findUnique({ where: { id: command.riderId } });
          if (!rider || !rider.isActive) throw new AppError("NOT_FOUND", "Rider non trovato o non attivo.");
          d.rider = { connect: { id: rider.id } };
          d.status = "ASSIGNED";
          d.assignedAt = now;
          d.toRestaurantAt = null;
          d.arrivedAtRestaurantAt = null;
          metadata.riderId = rider.id;
          break;
        }
        case "UNASSIGN_RIDER":
          d.rider = { disconnect: true };
          d.status = "UNASSIGNED";
          break;
        case "RIDER_TO_RESTAURANT":
          d.status = "TO_RESTAURANT";
          d.toRestaurantAt = now;
          break;
        case "PICK_UP":
          d.status = "PICKED_UP";
          d.pickedUpAt = now;
          break;
        case "START_DELIVERY":
          d.status = "ON_THE_WAY";
          d.onTheWayAt = now;
          break;
        case "DELIVER":
          d.status = "DELIVERED";
          d.deliveredAt = now;
          d.onTheWayAt = delivery.onTheWayAt ?? now;
          break;
        case "CANCEL":
        case "REJECT":
          d.status = "CANCELLED";
          d.cancelledAt = now;
          break;
        default:
          break;
      }
      if (Object.keys(d).length) await tx.delivery.update({ where: { id: delivery.id }, data: d });
    }

    const updated = await tx.order.update({ where: { id: order.id }, data, include: { delivery: true } });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: transition.recordedStatus,
        command: command.type,
        actorType: ctx.actor,
        actorUserId: ctx.userId,
        note: ctx.note ?? ("reason" in command ? command.reason : null),
        metadata: Object.keys(metadata).length ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });

    if (ctx.actor === "staff" && ctx.userId) {
      await audit(
        {
          actor: { userId: ctx.userId, role: ctx.role ?? "STAFF" },
          action: `order.${command.type.toLowerCase()}`,
          entityType: "Order",
          entityId: order.id,
          before: { status: order.status },
          after: { status: transition.status, ...metadata },
        },
        tx,
      );
    }

    const riderIds = new Set([
      ...previousRiderIds,
      ...(updated.delivery?.riderId ? [updated.delivery.riderId] : []),
    ]);
    for (const id of riderIds) await syncRiderAvailability(tx, id);

    return { order: updated, previousStatus: order.status as OrderStatus };
  });

  const { order } = result;
  const riderId = order.delivery?.riderId ?? null;
  const channels: Channel[] = [`order:${order.publicId}`, "kitchen", "riders"];
  for (const id of new Set([...previousRiderIds, ...(riderId ? [riderId] : [])]))
    channels.push(`rider:${id}`);
  await publish(channels, {
    type: "order.updated",
    orderId: order.id,
    publicId: order.publicId,
    status: order.status,
    updatedAt: order.updatedAt.toISOString(),
  });
  if (command.type === "ASSIGN_RIDER" && riderId) {
    await publish([`rider:${riderId}`, "riders"], { type: "delivery.assigned", orderId: order.id, riderId });
  }

  runAfter(async () => {
    if (ETA_COMMANDS.has(command.type)) await refreshOrderEta(order.id, { force: true });
    if (command.type === "RECEIVE") await afterReceived(order.id);
    const type = NOTIFY[command.type];
    if (type) await notifyCustomer(order.id, type, "reason" in command ? { reason: command.reason } : {});
    if (command.type === "ASSIGN_RIDER" && riderId) {
      const rider = await db.rider.findUnique({ where: { id: riderId }, select: { userId: true } });
      if (rider) await notifyRiderAssigned(order.id, rider.userId);
    }
    if (command.type === "DELIVER") await afterDelivered(order.id);
    if (command.type === "CANCEL" || command.type === "REJECT") {
      const { handleOrderCancelled } = await import("../payments");
      await handleOrderCancelled(order.id);
    }
  });

  return order;
}

async function afterReceived(orderId: string) {
  await publishCreated(orderId);
  await notifyStaff(orderId, "NEW_ORDER");
  await notifyCustomer(orderId, "ORDER_RECEIVED");
  const config = await getRestaurantConfig();
  if (config.autoAcceptOrders) {
    await runOrderCommand(
      orderId,
      { type: "CONFIRM", prepMinutes: config.defaultPrepMinutes },
      { actor: "system", userId: null, note: "Accettazione automatica" },
    );
  }
}

async function publishCreated(orderId: string) {
  const o = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, displayNumber: true, fulfillmentType: true, placedAt: true },
  });
  if (o)
    await publish(["kitchen"], {
      type: "order.created",
      orderId: o.id,
      number: o.displayNumber,
      fulfillmentType: o.fulfillmentType,
      placedAt: o.placedAt.toISOString(),
    });
}

async function afterDelivered(orderId: string) {
  const o = await db.order.findUnique({
    where: { id: orderId },
    include: { payments: true, delivery: true },
  });
  if (!o) return;
  // Cash is collected on delivery/pickup.
  for (const p of o.payments.filter((x) => x.provider === "CASH" && x.status === "PENDING")) {
    await db.payment.update({ where: { id: p.id }, data: { status: "SUCCEEDED", succeededAt: new Date() } });
  }
  await db.couponRedemption.updateMany({
    where: { orderId, status: "PENDING" },
    data: { status: "CONFIRMED" },
  });
  await awardOrderPoints(orderId);
  if (o.userId) await refreshCustomerStats(o.userId);
}

/** Kitchen changes the promised preparation time after acceptance ("+5 min"). */
export async function updatePrepTime(orderId: string, prepMinutes: number, ctx: CommandContext) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("NOT_FOUND", "Ordine non trovato.");
  if (!order.confirmedAt || order.readyAt || order.cancelledAt)
    throw new AppError(
      "INVALID_TRANSITION",
      "Il tempo di preparazione si può cambiare solo per ordini in preparazione.",
    );
  await db.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { prepMinutes } });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: order.status,
        command: "UPDATE_PREP_TIME",
        actorType: ctx.actor,
        actorUserId: ctx.userId,
        metadata: { prepMinutes },
      },
    });
    if (ctx.actor === "staff" && ctx.userId) {
      await audit(
        {
          actor: { userId: ctx.userId, role: ctx.role ?? "STAFF" },
          action: "order.update_prep_time",
          entityType: "Order",
          entityId: orderId,
          before: { prepMinutes: order.prepMinutes },
          after: { prepMinutes },
        },
        tx,
      );
    }
  });
  await publish(["kitchen"], {
    type: "order.updated",
    orderId,
    publicId: order.publicId,
    status: order.status,
    updatedAt: new Date().toISOString(),
  });
  await refreshOrderEta(orderId, { force: true });
  return order;
}
