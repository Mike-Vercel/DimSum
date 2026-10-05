import "server-only";
import { couponValueLabel, normalizeCouponCode, type LoyaltyConfig } from "@dimsum/domain";
import type { AdminCouponDTO, LoyaltyRewardDTO } from "@dimsum/types";
import type {
  couponInput,
  loyaltyAdjustInput,
  loyaltyConfigInput,
  loyaltyRewardInput,
} from "@dimsum/validation";
import type { z } from "zod";
import type { Viewer } from "../../auth/session";
import { audit } from "../../audit";
import { expireTags } from "../../cache";
import { db, type Prisma } from "../../db";
import { AppError } from "../../errors";
import { COUPONS_TAG } from "../offers";
import { SETTINGS_TAG, loadRestaurantConfig } from "../restaurant";

type CouponRow = Prisma.CouponGetPayload<object>;

function toAdminCoupon(c: CouponRow): AdminCouponDTO {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    description: c.description,
    type: c.type,
    percentBps: c.percentBps,
    amountCents: c.amountCents,
    maxDiscountCents: c.maxDiscountCents,
    minSubtotalCents: c.minSubtotalCents,
    startsAt: c.startsAt?.toISOString() ?? null,
    endsAt: c.endsAt?.toISOString() ?? null,
    isActive: c.isActive,
    autoApply: c.autoApply,
    isPublic: c.isPublic,
    maxRedemptions: c.maxRedemptions,
    perCustomerLimit: c.perCustomerLimit,
    fulfillmentTypes: c.fulfillmentTypes,
    newCustomersOnly: c.newCustomersOnly,
    includedProductIds: c.includedProductIds,
    includedCategoryIds: c.includedCategoryIds,
    redemptionsCount: c.redemptionsCount,
    personal: c.userId !== null,
    valueLabel: couponValueLabel(c),
    createdAt: c.createdAt.toISOString(),
  };
}

/** Campaign coupons (personal reward coupons are listed per customer). */
export async function listCoupons(): Promise<AdminCouponDTO[]> {
  const rows = await db.coupon.findMany({
    where: { userId: null },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toAdminCoupon);
}

export async function saveCoupon(
  input: z.output<typeof couponInput>,
  actor: Viewer,
  couponId?: string,
): Promise<AdminCouponDTO> {
  const code = input.code ? normalizeCouponCode(input.code) : null;
  const data = {
    code: input.autoApply ? null : code,
    name: input.name,
    description: input.description,
    type: input.type,
    percentBps: input.type === "PERCENTAGE" ? input.percentBps : null,
    amountCents: input.type === "FIXED_AMOUNT" ? input.amountCents : null,
    maxDiscountCents: input.type === "PERCENTAGE" ? input.maxDiscountCents : null,
    minSubtotalCents: input.minSubtotalCents,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    isActive: input.isActive,
    autoApply: input.autoApply,
    isPublic: input.isPublic,
    maxRedemptions: input.maxRedemptions,
    perCustomerLimit: input.perCustomerLimit,
    fulfillmentTypes: input.fulfillmentTypes,
    newCustomersOnly: input.newCustomersOnly,
    includedProductIds: input.includedProductIds,
    includedCategoryIds: input.includedCategoryIds,
  };
  const saved = await db.$transaction(async (tx) => {
    if (data.code) {
      const clash = await tx.coupon.findFirst({
        where: { code: data.code, ...(couponId ? { id: { not: couponId } } : {}) },
        select: { id: true },
      });
      if (clash)
        throw new AppError("CONFLICT", "Esiste già un coupon con questo codice.", {
          fieldErrors: { code: ["Codice già in uso."] },
        });
    }
    if (couponId) {
      const before = await tx.coupon.findFirst({ where: { id: couponId, userId: null } });
      if (!before) throw new AppError("NOT_FOUND", "Coupon non trovato.");
      const c = await tx.coupon.update({ where: { id: couponId }, data });
      await audit(
        {
          actor,
          action: "coupon.updated",
          entityType: "Coupon",
          entityId: couponId,
          before: toAdminCoupon(before),
          after: input,
        },
        tx,
      );
      return c;
    }
    const c = await tx.coupon.create({ data });
    await audit({ actor, action: "coupon.created", entityType: "Coupon", entityId: c.id, after: input }, tx);
    return c;
  });
  expireTags(COUPONS_TAG);
  return toAdminCoupon(saved);
}

/** Coupons already used stay for the records: they are switched off, not deleted. */
export async function archiveCoupon(couponId: string, actor: Viewer): Promise<void> {
  await db.$transaction(async (tx) => {
    const c = await tx.coupon.findFirst({ where: { id: couponId, userId: null } });
    if (!c) throw new AppError("NOT_FOUND", "Coupon non trovato.");
    if (c.redemptionsCount === 0) await tx.coupon.delete({ where: { id: couponId } });
    else await tx.coupon.update({ where: { id: couponId }, data: { isActive: false, isPublic: false } });
    await audit(
      {
        actor,
        action: c.redemptionsCount === 0 ? "coupon.deleted" : "coupon.archived",
        entityType: "Coupon",
        entityId: couponId,
        before: toAdminCoupon(c),
      },
      tx,
    );
  });
  expireTags(COUPONS_TAG);
}

/* ---------------------------------------------------------------- Dimsum Club */

export async function getLoyaltyAdmin(): Promise<{
  config: LoyaltyConfig;
  rewards: (LoyaltyRewardDTO & {
    couponType: string;
    percentBps: number | null;
    amountCents: number | null;
    validDays: number;
    isActive: boolean;
  })[];
  members: number;
}> {
  const [config, rewards, members] = await Promise.all([
    loadRestaurantConfig(),
    db.loyaltyReward.findMany({ orderBy: [{ position: "asc" }, { pointsCost: "asc" }] }),
    db.loyaltyAccount.count({ where: { lifetimePoints: { gt: 0 } } }),
  ]);
  return {
    config: config.loyalty,
    rewards: rewards.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      pointsCost: r.pointsCost,
      canRedeem: false,
      couponType: r.couponType,
      percentBps: r.percentBps,
      amountCents: r.amountCents,
      validDays: r.validDays,
      isActive: r.isActive,
    })),
    members,
  };
}

export async function updateLoyaltyConfig(
  input: z.output<typeof loyaltyConfigInput>,
  actor: Viewer,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const before = await tx.restaurantSettings.findUniqueOrThrow({
      where: { id: "default" },
      select: { loyalty: true },
    });
    await tx.restaurantSettings.update({
      where: { id: "default" },
      data: { loyalty: input as unknown as Prisma.InputJsonValue },
    });
    await audit(
      {
        actor,
        action: input.enabled ? "loyalty.updated" : "loyalty.disabled",
        entityType: "Loyalty",
        before: before.loyalty,
        after: input,
      },
      tx,
    );
  });
  expireTags(SETTINGS_TAG);
}

export async function saveReward(
  input: z.output<typeof loyaltyRewardInput>,
  actor: Viewer,
  rewardId?: string,
): Promise<void> {
  const data = {
    name: input.name,
    description: input.description,
    pointsCost: input.pointsCost,
    couponType: input.couponType,
    percentBps: input.couponType === "PERCENTAGE" ? input.percentBps : null,
    amountCents: input.couponType === "FIXED_AMOUNT" ? input.amountCents : null,
    validDays: input.validDays,
    isActive: input.isActive,
  };
  await db.$transaction(async (tx) => {
    if (rewardId) {
      const before = await tx.loyaltyReward.update({ where: { id: rewardId }, data });
      await audit(
        {
          actor,
          action: "loyalty.reward_updated",
          entityType: "LoyaltyReward",
          entityId: rewardId,
          before,
          after: input,
        },
        tx,
      );
    } else {
      const r = await tx.loyaltyReward.create({ data });
      await audit(
        {
          actor,
          action: "loyalty.reward_created",
          entityType: "LoyaltyReward",
          entityId: r.id,
          after: input,
        },
        tx,
      );
    }
  });
}

/** Manual correction (goodwill gesture, mistake): always written to the member's history. */
export async function adjustPoints(input: z.output<typeof loyaltyAdjustInput>, actor: Viewer): Promise<void> {
  await db.$transaction(async (tx) => {
    const account = await tx.loyaltyAccount.upsert({
      where: { userId: input.userId },
      create: { userId: input.userId },
      update: {},
    });
    if (account.points + input.points < 0)
      throw new AppError("VALIDATION_FAILED", `Il cliente ha solo ${account.points} punti.`);
    await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        points: { increment: input.points },
        ...(input.points > 0 ? { lifetimePoints: { increment: input.points } } : {}),
      },
    });
    await tx.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        type: input.points > 0 ? "BONUS" : "ADJUST",
        points: input.points,
        description: input.description,
      },
    });
    await audit(
      { actor, action: "loyalty.points_adjusted", entityType: "User", entityId: input.userId, after: input },
      tx,
    );
  });
}
