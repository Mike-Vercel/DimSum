import { describe, expect, it } from "vitest";
import {
  chooseCoupon,
  evaluateCoupon,
  normalizeCouponCode,
  type CouponContext,
  type CouponRule,
} from "../src";

/** The live promotion imported from the previous platform: 20% on orders above € 30. */
const brenvoPromo: CouponRule = {
  id: "promo-20",
  code: null,
  name: "Sconto 20% per ordini sopra i 30€",
  type: "PERCENTAGE",
  percentBps: 2000,
  amountCents: null,
  maxDiscountCents: null,
  minSubtotalCents: 3000,
  startsAt: null,
  endsAt: null,
  isActive: true,
  autoApply: true,
  maxRedemptions: null,
  redemptionsCount: 43,
  perCustomerLimit: 1,
  fulfillmentTypes: null,
  newCustomersOnly: false,
  includedProductIds: [],
  includedCategoryIds: [],
  userId: null,
};

const ctx = (over: Partial<CouponContext> & { subtotal?: number } = {}): CouponContext => ({
  now: new Date("2026-10-04T18:00:00Z"),
  fulfillmentType: "DELIVERY",
  deliveryFeeCents: 300,
  customer: { userId: null, previousOrders: 0, redemptionsOfCoupon: 0 },
  lines: [
    {
      productId: "p1",
      categoryId: "ravioli",
      lineTotalCents: over.subtotal ?? 3500,
      excludedFromDiscounts: false,
    },
  ],
  ...over,
});

describe("evaluateCoupon", () => {
  it("applies 20% above the minimum subtotal", () => {
    const r = evaluateCoupon(brenvoPromo, ctx({ subtotal: 3500 }));
    expect(r).toMatchObject({ ok: true, itemsDiscountCents: 700, deliveryDiscountCents: 0 });
  });

  it("explains how much is missing below the minimum", () => {
    const r = evaluateCoupon(brenvoPromo, ctx({ subtotal: 2990 }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("BELOW_MIN_SUBTOTAL");
      expect(r.shortfallCents).toBe(10);
      expect(r.message).toContain("€ 0,10");
    }
  });

  it("enforces per-customer and global limits", () => {
    expect(
      evaluateCoupon(
        brenvoPromo,
        ctx({ customer: { userId: "u", previousOrders: 3, redemptionsOfCoupon: 1 } }),
      ),
    ).toMatchObject({
      ok: false,
      reason: "CUSTOMER_LIMIT_REACHED",
    });
    expect(evaluateCoupon({ ...brenvoPromo, maxRedemptions: 43 }, ctx())).toMatchObject({
      ok: false,
      reason: "USAGE_LIMIT_REACHED",
    });
  });

  it("respects validity dates and activation", () => {
    expect(evaluateCoupon({ ...brenvoPromo, isActive: false }, ctx())).toMatchObject({
      ok: false,
      reason: "INACTIVE",
    });
    expect(evaluateCoupon({ ...brenvoPromo, startsAt: new Date("2026-11-01") }, ctx())).toMatchObject({
      ok: false,
      reason: "NOT_STARTED",
    });
    expect(evaluateCoupon({ ...brenvoPromo, endsAt: new Date("2026-10-01") }, ctx())).toMatchObject({
      ok: false,
      reason: "EXPIRED",
    });
  });

  it("restricts by fulfillment type and new customers", () => {
    expect(evaluateCoupon({ ...brenvoPromo, fulfillmentTypes: ["PICKUP"] }, ctx())).toMatchObject({
      ok: false,
      reason: "WRONG_FULFILLMENT",
    });
    expect(
      evaluateCoupon(
        { ...brenvoPromo, newCustomersOnly: true },
        ctx({ customer: { userId: null, previousOrders: 2, redemptionsOfCoupon: 0 } }),
      ),
    ).toMatchObject({ ok: false, reason: "NEW_CUSTOMERS_ONLY" });
  });

  it("discounts only included categories and never excluded products", () => {
    const rule: CouponRule = { ...brenvoPromo, minSubtotalCents: null, includedCategoryIds: ["bao"] };
    const r = evaluateCoupon(rule, {
      ...ctx(),
      lines: [
        { productId: "a", categoryId: "bao", lineTotalCents: 1000, excludedFromDiscounts: false },
        { productId: "b", categoryId: "bao", lineTotalCents: 1000, excludedFromDiscounts: true },
        { productId: "c", categoryId: "vini", lineTotalCents: 1800, excludedFromDiscounts: false },
      ],
    });
    expect(r).toMatchObject({ ok: true, itemsDiscountCents: 200, eligibleSubtotalCents: 1000 });
  });

  it("caps fixed amounts to the eligible subtotal and percentages to the max discount", () => {
    expect(
      evaluateCoupon(
        { ...brenvoPromo, type: "FIXED_AMOUNT", amountCents: 5000, percentBps: null, minSubtotalCents: null },
        ctx({ subtotal: 1200 }),
      ),
    ).toMatchObject({ ok: true, itemsDiscountCents: 1200 });
    expect(evaluateCoupon({ ...brenvoPromo, maxDiscountCents: 500 }, ctx({ subtotal: 5000 }))).toMatchObject({
      ok: true,
      itemsDiscountCents: 500,
    });
  });

  it("handles free delivery", () => {
    const free: CouponRule = {
      ...brenvoPromo,
      type: "FREE_DELIVERY",
      percentBps: null,
      minSubtotalCents: null,
    };
    expect(evaluateCoupon(free, ctx())).toMatchObject({
      ok: true,
      itemsDiscountCents: 0,
      deliveryDiscountCents: 300,
    });
    expect(evaluateCoupon(free, ctx({ deliveryFeeCents: 0 }))).toMatchObject({
      ok: false,
      reason: "NOTHING_TO_DISCOUNT",
    });
    expect(evaluateCoupon(free, ctx({ fulfillmentType: "PICKUP" }))).toMatchObject({
      ok: false,
      reason: "WRONG_FULFILLMENT",
    });
  });

  it("refuses personal coupons to other customers", () => {
    expect(
      evaluateCoupon(
        { ...brenvoPromo, userId: "owner" },
        ctx({ customer: { userId: "someone", previousOrders: 0, redemptionsOfCoupon: 0 } }),
      ),
    ).toMatchObject({
      ok: false,
      reason: "NOT_YOUR_COUPON",
    });
  });
});

describe("chooseCoupon", () => {
  const ok = (rule: CouponRule, discount: number) => ({
    rule,
    evaluation: {
      ok: true as const,
      itemsDiscountCents: discount,
      deliveryDiscountCents: 0,
      eligibleSubtotalCents: 5000,
    },
  });

  it("keeps the manual code unless an automatic promo is strictly better", () => {
    const manual = ok({ ...brenvoPromo, id: "m", code: "BENVENUTO", autoApply: false }, 500);
    expect(chooseCoupon(manual, [ok(brenvoPromo, 500)]).choice?.rule.id).toBe("m");
    const better = chooseCoupon(manual, [ok(brenvoPromo, 700)]);
    expect(better.choice?.rule.id).toBe("promo-20");
    expect(better.replacedManual).toBe(true);
    expect(chooseCoupon(null, []).choice).toBeNull();
  });

  it("normalizes codes", () => {
    expect(normalizeCouponCode("  benvenuto 10 ")).toBe("BENVENUTO10");
  });
});
