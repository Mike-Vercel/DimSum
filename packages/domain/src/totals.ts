/**
 * Order totals. Italian consumer prices are VAT inclusive: the tax line is the VAT contained in
 * the amounts (scorporo), split per rate after allocating discounts proportionally.
 * Tips are passed through to the rider and are outside the VAT scope.
 */
import { allocateProportionally, includedVat, type Cents } from "./money";

export interface TotalsLine {
  lineTotalCents: Cents;
  vatRateBps: number;
  /** Lines excluded from discounts (e.g. products flagged "no discount"). */
  discountEligible: boolean;
}

export interface TotalsInput {
  lines: readonly TotalsLine[];
  /** Discount on items, already capped by the coupon engine. */
  itemsDiscountCents: Cents;
  deliveryFeeCents: Cents;
  /** Free-delivery promotions: discount applied to the delivery fee. */
  deliveryDiscountCents: Cents;
  deliveryVatRateBps: number;
  serviceFeeCents: Cents;
  serviceFeeVatRateBps: number;
  tipCents: Cents;
}

export interface VatBreakdownRow {
  rateBps: number;
  grossCents: Cents;
  netCents: Cents;
  vatCents: Cents;
}

export interface Totals {
  subtotalCents: Cents;
  discountCents: Cents;
  deliveryFeeCents: Cents;
  serviceFeeCents: Cents;
  tipCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
  vatBreakdown: VatBreakdownRow[];
}

export function subtotalOf(lines: readonly Pick<TotalsLine, "lineTotalCents">[]): Cents {
  return lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
}

export function eligibleSubtotalOf(lines: readonly TotalsLine[]): Cents {
  return lines.reduce((sum, l) => sum + (l.discountEligible ? l.lineTotalCents : 0), 0);
}

export function computeTotals(input: TotalsInput): Totals {
  for (const [label, value] of Object.entries({
    itemsDiscountCents: input.itemsDiscountCents,
    deliveryFeeCents: input.deliveryFeeCents,
    deliveryDiscountCents: input.deliveryDiscountCents,
    serviceFeeCents: input.serviceFeeCents,
    tipCents: input.tipCents,
  })) {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new RangeError(`${label} must be a non-negative integer`);
  }

  const subtotal = subtotalOf(input.lines);
  const eligible = eligibleSubtotalOf(input.lines);
  const itemsDiscount = Math.min(input.itemsDiscountCents, eligible);
  const deliveryDiscount = Math.min(input.deliveryDiscountCents, input.deliveryFeeCents);

  // Spread the items discount over eligible lines to know how much each VAT rate is reduced.
  const eligibleLines = input.lines.map((l) => (l.discountEligible ? l.lineTotalCents : 0));
  const lineDiscounts = allocateProportionally(itemsDiscount, eligibleLines);

  const grossByRate = new Map<number, Cents>();
  const add = (rate: number, amount: Cents) => {
    if (amount === 0) return;
    grossByRate.set(rate, (grossByRate.get(rate) ?? 0) + amount);
  };
  input.lines.forEach((l, i) => add(l.vatRateBps, l.lineTotalCents - (lineDiscounts[i] ?? 0)));
  add(input.deliveryVatRateBps, input.deliveryFeeCents - deliveryDiscount);
  add(input.serviceFeeVatRateBps, input.serviceFeeCents);

  const vatBreakdown: VatBreakdownRow[] = [...grossByRate.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rateBps, grossCents]) => {
      const vatCents = includedVat(grossCents, rateBps);
      return { rateBps, grossCents, netCents: grossCents - vatCents, vatCents };
    });

  const discountCents = itemsDiscount + deliveryDiscount;
  const totalCents =
    subtotal -
    itemsDiscount +
    input.deliveryFeeCents -
    deliveryDiscount +
    input.serviceFeeCents +
    input.tipCents;

  return {
    subtotalCents: subtotal,
    discountCents,
    deliveryFeeCents: input.deliveryFeeCents,
    serviceFeeCents: input.serviceFeeCents,
    tipCents: input.tipCents,
    taxCents: vatBreakdown.reduce((sum, r) => sum + r.vatCents, 0),
    totalCents: Math.max(0, totalCents),
    vatBreakdown,
  };
}
