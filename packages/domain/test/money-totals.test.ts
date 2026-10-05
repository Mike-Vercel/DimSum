import { describe, expect, it } from "vitest";
import {
  allocateProportionally,
  applyBps,
  computeTotals,
  eurosToCents,
  formatEuro,
  includedVat,
  splitVat,
} from "../src";

describe("money", () => {
  it("converts euro decimals without float drift", () => {
    expect(eurosToCents(3.9)).toBe(390);
    expect(eurosToCents(8.9)).toBe(890);
    expect(eurosToCents(9.99)).toBe(999);
    expect(eurosToCents("4,50")).toBe(450);
    expect(eurosToCents(0.1 + 0.2)).toBe(30);
    expect(eurosToCents(-2.5)).toBe(-250);
  });

  it("computes included VAT (scorporo) at 10% and 22%", () => {
    expect(includedVat(1100, 1000)).toBe(100);
    expect(includedVat(1220, 2200)).toBe(220);
    expect(splitVat(990, 1000)).toEqual({ net: 900, vat: 90 });
    expect(includedVat(500, 0)).toBe(0);
  });

  it("applies basis points with half-up rounding", () => {
    expect(applyBps(3500, 2000)).toBe(700);
    expect(applyBps(3345, 2000)).toBe(669);
    expect(applyBps(5, 1000)).toBe(1);
  });

  it("allocates amounts proportionally without losing cents", () => {
    const parts = allocateProportionally(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
    expect(allocateProportionally(50, [0, 0])).toEqual([0, 0]);
  });

  it("formats euros the way the brand prints them", () => {
    expect(formatEuro(990)).toBe("€ 9,90");
    expect(formatEuro(2320)).toBe("€ 23,20");
    expect(formatEuro(100000)).toBe("€ 1.000,00");
    expect(formatEuro(500, { compact: true })).toBe("€ 5");
    expect(formatEuro(-300)).toBe("−€ 3,00");
  });
});

describe("computeTotals", () => {
  const lines = [
    { lineTotalCents: 1980, vatRateBps: 1000, discountEligible: true },
    { lineTotalCents: 600, vatRateBps: 2200, discountEligible: true },
    { lineTotalCents: 500, vatRateBps: 1000, discountEligible: false },
  ];

  it("sums every component and keeps the tip outside VAT", () => {
    const t = computeTotals({
      lines,
      itemsDiscountCents: 0,
      deliveryFeeCents: 300,
      deliveryDiscountCents: 0,
      deliveryVatRateBps: 1000,
      serviceFeeCents: 0,
      serviceFeeVatRateBps: 2200,
      tipCents: 200,
    });
    expect(t.subtotalCents).toBe(3080);
    expect(t.totalCents).toBe(3080 + 300 + 200);
    // VAT: 10% on 1980+500+300 = 2780 → 253; 22% on 600 → 108
    expect(t.vatBreakdown).toEqual([
      { rateBps: 1000, grossCents: 2780, netCents: 2527, vatCents: 253 },
      { rateBps: 2200, grossCents: 600, netCents: 492, vatCents: 108 },
    ]);
    expect(t.taxCents).toBe(361);
  });

  it("spreads the discount over eligible lines only and caps it", () => {
    const t = computeTotals({
      lines,
      itemsDiscountCents: 99_999,
      deliveryFeeCents: 0,
      deliveryDiscountCents: 0,
      deliveryVatRateBps: 1000,
      serviceFeeCents: 0,
      serviceFeeVatRateBps: 2200,
      tipCents: 0,
    });
    // Capped to the eligible subtotal (1980 + 600); the excluded line is still due.
    expect(t.discountCents).toBe(2580);
    expect(t.totalCents).toBe(500);
  });

  it("applies free delivery as a delivery discount", () => {
    const t = computeTotals({
      lines: [lines[0]!],
      itemsDiscountCents: 0,
      deliveryFeeCents: 300,
      deliveryDiscountCents: 300,
      deliveryVatRateBps: 1000,
      serviceFeeCents: 0,
      serviceFeeVatRateBps: 2200,
      tipCents: 0,
    });
    expect(t.deliveryFeeCents).toBe(300);
    expect(t.discountCents).toBe(300);
    expect(t.totalCents).toBe(1980);
  });

  it("rejects negative or fractional amounts", () => {
    expect(() =>
      computeTotals({
        lines,
        itemsDiscountCents: -1,
        deliveryFeeCents: 0,
        deliveryDiscountCents: 0,
        deliveryVatRateBps: 1000,
        serviceFeeCents: 0,
        serviceFeeVatRateBps: 2200,
        tipCents: 0,
      }),
    ).toThrow(RangeError);
    expect(() =>
      computeTotals({
        lines,
        itemsDiscountCents: 0,
        deliveryFeeCents: 0,
        deliveryDiscountCents: 0,
        deliveryVatRateBps: 1000,
        serviceFeeCents: 0,
        serviceFeeVatRateBps: 2200,
        tipCents: 1.5,
      }),
    ).toThrow(RangeError);
  });
});
