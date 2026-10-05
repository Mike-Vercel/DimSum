import "server-only";
import { db } from "../db";
import { logger } from "../logger";

/** Creates the profile rows every customer account needs. Idempotent. */
export async function ensureCustomerRecords(userId: string): Promise<void> {
  await db.customerProfile.upsert({ where: { userId }, create: { userId }, update: {} });
  await db.loyaltyAccount.upsert({ where: { userId }, create: { userId }, update: {} });
}

/**
 * Attaches past guest orders placed with the same e-mail. Only called once the e-mail address
 * is proven (Google sign-in or verified e-mail), so nobody can claim someone else's orders by
 * registering with their address.
 */
export async function linkGuestOrders(userId: string, email: string): Promise<number> {
  const { count } = await db.order.updateMany({
    where: { userId: null, customerEmail: email.trim().toLowerCase() },
    data: { userId, claimedAt: new Date() },
  });
  if (count > 0) logger.info("guest orders linked to account", { userId, count });
  await refreshCustomerStats(userId);
  return count;
}

export async function refreshCustomerStats(userId: string): Promise<void> {
  const delivered = await db.order.aggregate({
    where: { userId, status: "DELIVERED" },
    _count: { _all: true },
    _sum: { totalCents: true },
    _max: { deliveredAt: true },
  });
  await db.customerProfile.upsert({
    where: { userId },
    create: {
      userId,
      ordersCount: delivered._count._all,
      totalSpentCents: delivered._sum.totalCents ?? 0,
      lastOrderAt: delivered._max.deliveredAt,
    },
    update: {
      ordersCount: delivered._count._all,
      totalSpentCents: delivered._sum.totalCents ?? 0,
      lastOrderAt: delivered._max.deliveredAt,
    },
  });
}
