import "server-only";
import { computeEta, isTerminal, type LatLng } from "@dimsum/domain";
import type { EtaDTO } from "@dimsum/types";
import { db } from "../../db";
import { routeBetween } from "../../maps";
import { publish } from "../../realtime/bus";
import { getRestaurantConfig } from "../restaurant";
import { milestonesOf } from "./queries";

const FRESH_LOCATION_MS = 3 * 60_000;

/**
 * Recomputes and stores the delivery/pickup window of an order, publishing it when it moves.
 * Called on every relevant change: acceptance, preparation time, rider assignment and movement.
 */
export async function refreshOrderEta(
  orderId: string,
  options: { force?: boolean } = {},
): Promise<EtaDTO | null> {
  const o = await db.order.findUnique({
    where: { id: orderId },
    include: {
      delivery: { include: { rider: true } },
      deliveryZone: { select: { etaAdjustmentMinutes: true } },
    },
  });
  if (!o || isTerminal(o.status) || o.status === "PENDING_PAYMENT") return null;
  const now = new Date();
  if (!options.force && o.etaUpdatedAt && now.getTime() - o.etaUpdatedAt.getTime() < 20_000) return null;

  const config = await getRestaurantConfig();
  const [kitchenQueue, ridersAvailable] = await Promise.all([
    db.order.count({
      where: {
        id: { not: o.id },
        status: { in: ["RECEIVED", "CONFIRMED", "PREPARING"] },
        placedAt: { lt: o.placedAt },
      },
    }),
    db.rider.count({ where: { isActive: true, availability: "AVAILABLE" } }),
  ]);

  const destination: LatLng | null =
    o.addressLat !== null && o.addressLng !== null ? { lat: o.addressLat, lng: o.addressLng } : null;
  const rider = o.delivery?.rider;
  const riderPos: LatLng | null =
    rider?.lastLat != null &&
    rider.lastLng != null &&
    rider.lastLocationAt &&
    now.getTime() - rider.lastLocationAt.getTime() < FRESH_LOCATION_MS
      ? { lat: rider.lastLat, lng: rider.lastLng }
      : null;

  let riderToRestaurantSeconds: number | null = null;
  let riderToCustomerSeconds: number | null = null;
  if (riderPos && destination) {
    if (o.pickedUpAt) riderToCustomerSeconds = (await routeBetween(riderPos, destination)).durationSeconds;
    else if (o.riderAssignedAt)
      riderToRestaurantSeconds = (await routeBetween(riderPos, config.location)).durationSeconds;
  }

  const eta = computeEta({
    now,
    fulfillmentType: o.fulfillmentType,
    placedAt: o.placedAt,
    scheduledFor: o.scheduledFor,
    milestones: milestonesOf(o),
    prepMinutes: o.prepMinutes,
    kitchenQueue,
    riders: { available: Math.max(ridersAvailable, o.riderAssignedAt ? 0 : 1), minutesUntilNextFree: null },
    restaurantToCustomerSeconds: o.routeDurationSeconds,
    riderToRestaurantSeconds,
    riderToCustomerSeconds,
    zoneAdjustmentMinutes: o.deliveryZone?.etaAdjustmentMinutes ?? 0,
    settings: config.eta,
  });
  if (!eta) return null;

  const changed =
    !o.etaFrom ||
    Math.abs(o.etaFrom.getTime() - eta.windowStart.getTime()) >= 60_000 ||
    Math.abs((o.etaTo?.getTime() ?? 0) - eta.windowEnd.getTime()) >= 60_000;
  await db.order.update({
    where: { id: o.id },
    data: { etaFrom: eta.windowStart, etaTo: eta.windowEnd, etaUpdatedAt: now },
  });
  const dto: EtaDTO = {
    from: eta.windowStart.toISOString(),
    to: eta.windowEnd.toISOString(),
    minutes: eta.minutes,
    confidence: eta.confidence,
  };
  if (changed || options.force) {
    await publish([`order:${o.publicId}`, "kitchen"], {
      type: "order.eta",
      orderId: o.id,
      publicId: o.publicId,
      eta: dto,
    });
  }
  return dto;
}
