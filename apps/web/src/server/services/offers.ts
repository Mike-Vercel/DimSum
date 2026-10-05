import "server-only";
import { couponValueLabel, normalizeCouponCode } from "@dimsum/domain";
import type { CouponPublicDTO } from "@dimsum/types";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "../db";

export const COUPONS_TAG = "coupons";

type CouponRow = Awaited<ReturnType<typeof db.coupon.findMany>>[number];

export function toCouponPublic(c: CouponRow): CouponPublicDTO {
  return {
    id: c.id,
    code: c.autoApply ? null : c.code,
    name: c.name,
    description: c.description,
    type: c.type,
    valueLabel: couponValueLabel(c),
    minSubtotalCents: c.minSubtotalCents,
    validUntil: c.endsAt?.toISOString() ?? null,
    automatic: c.autoApply,
    personal: c.userId !== null,
  };
}

/** Public promotions shown on the home page and in "Offerte" (no personal coupons). */
export async function getPublicOffers(): Promise<CouponPublicDTO[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(COUPONS_TAG);
  const rows = await db.coupon.findMany({
    where: { isActive: true, isPublic: true, userId: null },
    orderBy: [{ autoApply: "desc" }, { createdAt: "desc" }],
    take: 12,
  });
  // Validity windows are checked by the client against the current time (cached list).
  return rows.map(toCouponPublic);
}

/** Coupons the customer can use: personal ones (rewards, apologies) first, then public offers. */
export async function couponsForUser(userId: string): Promise<CouponPublicDTO[]> {
  const now = new Date();
  const personal = await db.coupon.findMany({
    where: { userId, isActive: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    include: { _count: { select: { redemptions: { where: { status: { not: "RELEASED" } } } } } },
    orderBy: { createdAt: "desc" },
  });
  const usable = personal.filter((c) => c.maxRedemptions === null || c._count.redemptions < c.maxRedemptions);
  return [...usable.map(toCouponPublic), ...(await getPublicOffers())];
}

/** Campaign code from a shared link (dimsum.it/promo/CODE). Personal coupons are never exposed. */
export async function findPromoByCode(raw: string, now = new Date()): Promise<CouponPublicDTO | null> {
  const code = normalizeCouponCode(raw);
  if (!/^[A-Z0-9-]{3,30}$/.test(code)) return null;
  const c = await db.coupon.findFirst({
    where: {
      code,
      userId: null,
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
  });
  return c ? toCouponPublic(c) : null;
}
