import "server-only";
import { expireTags } from "../cache";
import { db } from "../db";
import { purgeGeoCache } from "../maps";
import { logger } from "../logger";
import { publish } from "../realtime/bus";
import { notifyStaff } from "./notifications";
import { SETTINGS_TAG, loadRestaurantConfig } from "./restaurant";

/** Orders nobody accepted in time: flagged once and pushed to every staff device. */
export async function escalateWaitingOrders(now = new Date()): Promise<number> {
  const config = await loadRestaurantConfig();
  const limit = new Date(now.getTime() - config.acceptanceEscalationMinutes * 60_000);
  const waiting = await db.order.findMany({
    where: { status: "RECEIVED", escalatedAt: null, receivedAt: { lt: limit } },
    select: { id: true, publicId: true, status: true },
    take: 50,
  });
  for (const o of waiting) {
    const claimed = await db.order.updateMany({
      where: { id: o.id, escalatedAt: null },
      data: { escalatedAt: now },
    });
    if (claimed.count === 0) continue;
    await notifyStaff(o.id, "ORDER_ESCALATION");
    await publish(["kitchen"], {
      type: "order.updated",
      orderId: o.id,
      publicId: o.publicId,
      status: o.status,
      updatedAt: now.toISOString(),
    });
  }
  return waiting.length;
}

/** "Blocca ordini per 30 minuti": reopen automatically when the time is up. */
export async function endExpiredPauses(now = new Date()): Promise<boolean> {
  const { count } = await db.restaurantSettings.updateMany({
    where: { id: "default", ordersPaused: true, pausedUntil: { lte: now } },
    data: { ordersPaused: false, pausedUntil: null, pauseReason: null },
  });
  if (count === 0) return false;
  expireTags(SETTINGS_TAG);
  await publish(["catalog", "kitchen"], {
    type: "restaurant.status",
    acceptingOrders: true,
    isPaused: false,
  });
  return true;
}

const DAY = 86_400_000;

/**
 * Retention as stated in the privacy policy: rider positions 30 days, technical records 12 months,
 * closed support requests 24 months. Orders are kept (accounting obligations).
 */
export async function purgeExpiredData(now = new Date()): Promise<Record<string, number>> {
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  const [riderLocations, idempotency, notifications, emails, tickets, verifications, pushSubs, geo] =
    await Promise.all([
      db.riderLocation.deleteMany({ where: { recordedAt: { lt: ago(30) } } }),
      db.idempotencyRecord.deleteMany({ where: { expiresAt: { lt: now } } }),
      db.notification.deleteMany({ where: { createdAt: { lt: ago(365) } } }),
      db.emailLog.deleteMany({ where: { createdAt: { lt: ago(365) } } }),
      db.supportTicket.deleteMany({
        where: { status: { in: ["RESOLVED", "CLOSED"] }, updatedAt: { lt: ago(730) } },
      }),
      db.verification.deleteMany({ where: { expiresAt: { lt: now } } }),
      db.pushSubscription.deleteMany({
        where: { OR: [{ failedAt: { not: null } }, { orderId: { not: null }, createdAt: { lt: ago(30) } }] },
      }),
      purgeGeoCache(),
    ]);
  // Rate-limit windows are minutes long: anything older than a day is dead weight.
  const rateLimits =
    await db.$executeRaw`DELETE FROM "rate_limits" WHERE "lastRequest" < ${now.getTime() - DAY}`;
  const result = {
    riderLocations: riderLocations.count,
    idempotency: idempotency.count,
    notifications: notifications.count,
    emails: emails.count,
    supportTickets: tickets.count,
    verifications: verifications.count,
    pushSubscriptions: pushSubs.count,
    geoCache: geo,
    rateLimits,
  };
  logger.info("retention purge", result);
  return result;
}
