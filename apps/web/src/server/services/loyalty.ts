import "server-only";
import { nextTier, pointsForOrder, pointsToReverse, tierFor } from "@dimsum/domain";
import type { CouponPublicDTO, LoyaltySummaryDTO } from "@dimsum/types";
import { db } from "../db";
import { AppError } from "../errors";
import { newPublicId } from "../ids";
import { toCouponPublic } from "./offers";
import { getRestaurantConfig } from "./restaurant";

/** Points for a delivered order (accounts only, programme enabled). Idempotent per order. */
export async function awardOrderPoints(orderId: string): Promise<number> {
  const config = await getRestaurantConfig();
  if (!config.loyalty.enabled) return 0;
  const o = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      subtotalCents: true,
      discountCents: true,
      deliveryFeeCents: true,
      loyaltyPointsEarned: true,
      displayNumber: true,
    },
  });
  if (!o?.userId || o.loyaltyPointsEarned > 0) return 0;
  const account = await db.loyaltyAccount.upsert({
    where: { userId: o.userId },
    create: { userId: o.userId },
    update: {},
  });
  // Items after discount; delivery fee and tip never earn points.
  const eligible = Math.max(0, o.subtotalCents - Math.max(0, o.discountCents - o.deliveryFeeCents));
  const points = pointsForOrder(config.loyalty, eligible, account.lifetimePoints);
  if (points <= 0) return 0;
  const lifetime = account.lifetimePoints + points;
  await db.$transaction([
    db.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        type: "EARN",
        points,
        description: `Ordine #${o.displayNumber}`,
        orderId: o.id,
      },
    }),
    db.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        points: { increment: points },
        lifetimePoints: lifetime,
        tierKey: tierFor(config.loyalty, lifetime)?.key ?? null,
      },
    }),
    db.order.update({ where: { id: o.id }, data: { loyaltyPointsEarned: points } }),
  ]);
  return points;
}

/** Takes back points proportionally to a refund. */
export async function reverseOrderPoints(orderId: string, refundedCents: number): Promise<void> {
  const o = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, subtotalCents: true, loyaltyPointsEarned: true, displayNumber: true },
  });
  if (!o?.userId || o.loyaltyPointsEarned <= 0) return;
  const points = pointsToReverse(o.loyaltyPointsEarned, o.subtotalCents, refundedCents);
  if (points <= 0) return;
  const account = await db.loyaltyAccount.findUnique({ where: { userId: o.userId } });
  if (!account) return;
  await db.$transaction([
    db.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        type: "REVERSAL",
        points: -points,
        description: `Rimborso ordine #${o.displayNumber}`,
        orderId: o.id,
      },
    }),
    db.loyaltyAccount.update({
      where: { id: account.id },
      data: { points: { decrement: Math.min(points, account.points) } },
    }),
  ]);
}

export async function loyaltySummary(userId: string): Promise<LoyaltySummaryDTO> {
  const config = await getRestaurantConfig();
  const [account, rewards] = await Promise.all([
    db.loyaltyAccount.findUnique({
      where: { userId },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 30 } },
    }),
    db.loyaltyReward.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { pointsCost: "asc" }],
    }),
  ]);
  const points = account?.points ?? 0;
  const lifetime = account?.lifetimePoints ?? 0;
  const tier = tierFor(config.loyalty, lifetime);
  const upcoming = nextTier(config.loyalty, lifetime);
  const nextReward = rewards.find((r) => r.pointsCost > points) ?? null;
  return {
    enabled: config.loyalty.enabled,
    programName: config.loyalty.programName,
    points,
    lifetimePoints: lifetime,
    tier: tier ? { key: tier.key, name: tier.name } : null,
    nextTier: upcoming
      ? { key: upcoming.tier.key, name: upcoming.tier.name, pointsNeeded: upcoming.pointsNeeded }
      : null,
    nextReward: nextReward
      ? {
          id: nextReward.id,
          name: nextReward.name,
          pointsCost: nextReward.pointsCost,
          pointsNeeded: nextReward.pointsCost - points,
        }
      : null,
    rewards: rewards.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      pointsCost: r.pointsCost,
      canRedeem: config.loyalty.enabled && points >= r.pointsCost,
    })),
    history: (account?.transactions ?? []).map((t) => ({
      id: t.id,
      type: t.type,
      points: t.points,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

/** Turns points into a personal single-use coupon. The debit is atomic: points never go negative. */
export async function redeemReward(userId: string, rewardId: string): Promise<CouponPublicDTO> {
  const config = await getRestaurantConfig();
  if (!config.loyalty.enabled)
    throw new AppError("CONFLICT", `${config.loyalty.programName} non è ancora attivo.`);
  return db.$transaction(async (tx) => {
    const reward = await tx.loyaltyReward.findFirst({ where: { id: rewardId, isActive: true } });
    if (!reward) throw new AppError("NOT_FOUND", "Premio non disponibile.");
    const debited = await tx.loyaltyAccount.updateMany({
      where: { userId, points: { gte: reward.pointsCost } },
      data: { points: { decrement: reward.pointsCost } },
    });
    if (debited.count === 0)
      throw new AppError("CONFLICT", "Non hai ancora abbastanza punti per questo premio.");
    const account = await tx.loyaltyAccount.findUniqueOrThrow({ where: { userId }, select: { id: true } });
    const coupon = await tx.coupon.create({
      data: {
        code: `CLUB-${newPublicId(8).toUpperCase()}`,
        name: reward.name,
        description: reward.description,
        type: reward.couponType,
        percentBps: reward.percentBps,
        amountCents: reward.amountCents,
        endsAt: new Date(Date.now() + reward.validDays * 86_400_000),
        maxRedemptions: 1,
        perCustomerLimit: 1,
        userId,
        loyaltyRewardId: reward.id,
      },
    });
    await tx.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        type: "REDEEM",
        points: -reward.pointsCost,
        description: `Premio: ${reward.name}`,
        rewardId: reward.id,
      },
    });
    return toCouponPublic(coupon);
  });
}

async function creditBonus(userId: string, points: number, description: string): Promise<boolean> {
  const account = await db.loyaltyAccount.upsert({ where: { userId }, create: { userId }, update: {} });
  // One bonus per description (e.g. "Compleanno 2026"): safe to run the job twice.
  const already = await db.loyaltyTransaction.count({
    where: { accountId: account.id, type: "BONUS", description },
  });
  if (already > 0) return false;
  await db.$transaction([
    db.loyaltyTransaction.create({ data: { accountId: account.id, type: "BONUS", points, description } }),
    db.loyaltyAccount.update({
      where: { id: account.id },
      data: { points: { increment: points }, lifetimePoints: { increment: points } },
    }),
  ]);
  return true;
}

/** Welcome points for a new account, when the programme is live and offers them. */
export async function awardSignupBonus(userId: string): Promise<void> {
  const config = await getRestaurantConfig();
  if (!config.loyalty.enabled || config.loyalty.signupBonusPoints <= 0) return;
  await creditBonus(userId, config.loyalty.signupBonusPoints, "Benvenuto nel club");
}

/** Daily job: birthday gift for members who shared their birth date (once a year). */
export async function awardBirthdayBonuses(now = new Date()): Promise<number> {
  const config = await getRestaurantConfig();
  if (!config.loyalty.enabled || config.loyalty.birthdayBonusPoints <= 0) return 0;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const [year, month, day] = [get("year"), get("month"), get("day")];
  const birthdays = await db.$queryRaw<{ userId: string }[]>`
    SELECT p."userId" FROM customer_profiles p JOIN users u ON u.id = p."userId"
    WHERE p."birthDate" IS NOT NULL AND u."deletedAt" IS NULL
      AND EXTRACT(MONTH FROM p."birthDate") = ${month} AND EXTRACT(DAY FROM p."birthDate") = ${day}`;
  let credited = 0;
  for (const b of birthdays) {
    if (await creditBonus(b.userId, config.loyalty.birthdayBonusPoints, `Compleanno ${year}`)) credited++;
  }
  return credited;
}

/** Points expire after N months without any activity on the account (if configured). */
export async function expireInactivePoints(now = new Date()): Promise<number> {
  const config = await getRestaurantConfig();
  const months = config.loyalty.expiryMonths;
  if (!config.loyalty.enabled || !months) return 0;
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  const stale = await db.loyaltyAccount.findMany({
    where: { points: { gt: 0 }, transactions: { none: { createdAt: { gte: cutoff } } } },
    select: { id: true, points: true },
    take: 500,
  });
  for (const a of stale) {
    await db.$transaction([
      db.loyaltyTransaction.create({
        data: {
          accountId: a.id,
          type: "EXPIRE",
          points: -a.points,
          description: `Punti scaduti dopo ${months} mesi di inattività`,
        },
      }),
      db.loyaltyAccount.update({ where: { id: a.id }, data: { points: 0 } }),
    ]);
  }
  return stale.length;
}
