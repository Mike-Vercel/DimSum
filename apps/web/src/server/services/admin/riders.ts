import "server-only";
import type { AdminRiderDTO } from "@dimsum/types";
import type { riderInput } from "@dimsum/validation";
import type { z } from "zod";
import type { Viewer } from "../../auth/session";
import { audit } from "../../audit";
import { db } from "../../db";
import { notFound } from "../../errors";
import { publish } from "../../realtime/bus";
import { getRestaurantConfig } from "../restaurant";
import { dayStart } from "./time";
import { createTeamAccount, sendTeamInvite, setAccountDisabled } from "./people";

const STALE_MS = 3 * 60_000;
const ACTIVE_DELIVERY = ["ASSIGNED", "TO_RESTAURANT", "AT_RESTAURANT", "PICKED_UP", "ON_THE_WAY"] as const;

/** Riders with live state for dispatch: who is free, who is busy and where (only during deliveries). */
export async function listRiders(now = new Date()): Promise<AdminRiderDTO[]> {
  const config = await getRestaurantConfig();
  const since = dayStart(now, config.timezone);
  const riders = await db.rider.findMany({
    include: {
      user: { select: { email: true, disabledAt: true } },
      deliveries: {
        where: { OR: [{ status: { in: [...ACTIVE_DELIVERY] } }, { deliveredAt: { gte: since } }] },
        include: {
          order: {
            select: { id: true, displayNumber: true, tipCents: true, totalCents: true, paymentMethod: true },
          },
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
  });
  return riders.map((r) => {
    const delivered = r.deliveries.filter((d) => d.status === "DELIVERED");
    const active = r.deliveries.filter((d) => (ACTIVE_DELIVERY as readonly string[]).includes(d.status));
    return {
      id: r.id,
      userId: r.userId,
      name: r.displayName,
      email: r.user.email,
      phone: r.phone,
      vehicle: r.vehicle,
      isActive: r.isActive && !r.user.disabledAt,
      availability: r.availability,
      activeDeliveries: active.map((d) => ({
        orderId: d.order.id,
        number: d.order.displayNumber,
        status: d.status,
      })),
      deliveredToday: delivered.length,
      tipsTodayCents: delivered.reduce((s, d) => s + d.order.tipCents, 0),
      cashToReturnCents: delivered
        .filter((d) => d.order.paymentMethod === "CASH_ON_DELIVERY")
        .reduce((s, d) => s + (d.cashCollectedCents ?? d.order.totalCents), 0),
      lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
      location:
        r.lastLat !== null && r.lastLng !== null && r.lastLocationAt
          ? {
              lat: r.lastLat,
              lng: r.lastLng,
              at: r.lastLocationAt.toISOString(),
              stale: now.getTime() - r.lastLocationAt.getTime() > STALE_MS,
            }
          : null,
    };
  });
}

export async function createRider(
  input: z.output<typeof riderInput>,
  actor: Viewer,
): Promise<{ riderId: string; invited: boolean }> {
  const result = await db.$transaction(async (tx) => {
    const account = await createTeamAccount(
      { name: input.name, email: input.email, role: "RIDER", password: input.password },
      tx,
    );
    await tx.user.update({ where: { id: account.userId }, data: { phone: input.phone } });
    const rider = await tx.rider.create({
      data: {
        userId: account.userId,
        displayName: input.name.split(/\s+/)[0] ?? input.name,
        phone: input.phone,
        vehicle: input.vehicle,
      },
    });
    await audit(
      {
        actor,
        action: "rider.created",
        entityType: "Rider",
        entityId: rider.id,
        after: { name: input.name, email: input.email, vehicle: input.vehicle },
      },
      tx,
    );
    return { riderId: rider.id, invited: account.invited, email: input.email };
  });
  if (result.invited) await sendTeamInvite(result.email);
  return { riderId: result.riderId, invited: result.invited };
}

export async function updateRider(
  riderId: string,
  input: { displayName?: string; phone?: string | null; vehicle?: string | null; isActive?: boolean },
  actor: Viewer,
): Promise<void> {
  const rider = await db.rider.findUnique({ where: { id: riderId } });
  if (!rider) throw notFound("Rider");
  await db.$transaction(async (tx) => {
    await tx.rider.update({
      where: { id: riderId },
      data: {
        ...(input.displayName ? { displayName: input.displayName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.vehicle !== undefined ? { vehicle: input.vehicle } : {}),
        ...(input.isActive !== undefined
          ? { isActive: input.isActive, ...(input.isActive ? {} : { availability: "OFFLINE" as const }) }
          : {}),
      },
    });
    if (input.isActive !== undefined) await setAccountDisabled(rider.userId, !input.isActive, tx);
    await audit(
      {
        actor,
        action: "rider.updated",
        entityType: "Rider",
        entityId: riderId,
        before: {
          displayName: rider.displayName,
          phone: rider.phone,
          vehicle: rider.vehicle,
          isActive: rider.isActive,
        },
        after: input,
      },
      tx,
    );
  });
  if (input.isActive === false)
    await publish(["riders", `rider:${riderId}`], { type: "rider.status", riderId, availability: "OFFLINE" });
}

export async function resendRiderInvite(riderId: string): Promise<void> {
  const rider = await db.rider.findUnique({
    where: { id: riderId },
    include: { user: { select: { email: true } } },
  });
  if (!rider) throw notFound("Rider");
  await sendTeamInvite(rider.user.email);
}
