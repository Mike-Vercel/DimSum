/**
 * Coupon & promotion engine. Pure evaluation: persistence, redemption locking and usage counters
 * live in the server service, which re-runs this evaluation inside the checkout transaction.
 */
import type { CouponType, FulfillmentType } from "@dimsum/types";
import { applyBps, formatEuro, type Cents } from "./money";

export interface CouponRule {
  id: string;
  code: string | null;
  name: string;
  type: CouponType;
  /** PERCENTAGE: value in basis points (2000 = 20%). */
  percentBps: number | null;
  /** FIXED_AMOUNT: value in cents. */
  amountCents: Cents | null;
  /** Upper bound for percentage discounts. */
  maxDiscountCents: Cents | null;
  minSubtotalCents: Cents | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  autoApply: boolean;
  maxRedemptions: number | null;
  redemptionsCount: number;
  perCustomerLimit: number | null;
  /** null = both delivery and pickup. */
  fulfillmentTypes: FulfillmentType[] | null;
  newCustomersOnly: boolean;
  /** Empty = whole menu. */
  includedProductIds: string[];
  includedCategoryIds: string[];
  /** Personal coupons (loyalty rewards, apologies) are bound to one account. */
  userId: string | null;
}

export interface CouponLine {
  productId: string;
  categoryId: string;
  lineTotalCents: Cents;
  excludedFromDiscounts: boolean;
}

export interface CouponContext {
  now: Date;
  lines: readonly CouponLine[];
  fulfillmentType: FulfillmentType;
  deliveryFeeCents: Cents;
  customer: {
    userId: string | null;
    /** Completed (non cancelled) orders of this customer, by account or e-mail. */
    previousOrders: number;
    /** Times this customer already used this coupon. */
    redemptionsOfCoupon: number;
  };
}

export type CouponRejection =
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "USAGE_LIMIT_REACHED"
  | "CUSTOMER_LIMIT_REACHED"
  | "BELOW_MIN_SUBTOTAL"
  | "WRONG_FULFILLMENT"
  | "NEW_CUSTOMERS_ONLY"
  | "NO_ELIGIBLE_ITEMS"
  | "NOT_YOUR_COUPON"
  | "NOTHING_TO_DISCOUNT";

export type CouponEvaluation =
  | {
      ok: true;
      itemsDiscountCents: Cents;
      deliveryDiscountCents: Cents;
      eligibleSubtotalCents: Cents;
    }
  | { ok: false; reason: CouponRejection; message: string; shortfallCents?: Cents };

function lineIsEligible(rule: CouponRule, line: CouponLine): boolean {
  if (line.excludedFromDiscounts) return false;
  const scoped = rule.includedProductIds.length > 0 || rule.includedCategoryIds.length > 0;
  if (!scoped) return true;
  return (
    rule.includedProductIds.includes(line.productId) || rule.includedCategoryIds.includes(line.categoryId)
  );
}

export function evaluateCoupon(rule: CouponRule, ctx: CouponContext): CouponEvaluation {
  const reject = (reason: CouponRejection, message: string, shortfallCents?: Cents): CouponEvaluation =>
    shortfallCents === undefined
      ? { ok: false, reason, message }
      : { ok: false, reason, message, shortfallCents };

  if (!rule.isActive) return reject("INACTIVE", "Questo codice non è attivo.");
  if (rule.startsAt && ctx.now < rule.startsAt)
    return reject("NOT_STARTED", "Questa promozione non è ancora iniziata.");
  if (rule.endsAt && ctx.now > rule.endsAt) return reject("EXPIRED", "Questa promozione è scaduta.");
  if (rule.userId && rule.userId !== ctx.customer.userId) {
    return reject("NOT_YOUR_COUPON", "Questo coupon è personale: accedi con l'account che lo ha ricevuto.");
  }
  if (rule.maxRedemptions !== null && rule.redemptionsCount >= rule.maxRedemptions) {
    return reject("USAGE_LIMIT_REACHED", "Questo codice ha raggiunto il numero massimo di utilizzi.");
  }
  if (rule.perCustomerLimit !== null && ctx.customer.redemptionsOfCoupon >= rule.perCustomerLimit) {
    return reject("CUSTOMER_LIMIT_REACHED", "Hai già utilizzato questo codice.");
  }
  if (rule.fulfillmentTypes && !rule.fulfillmentTypes.includes(ctx.fulfillmentType)) {
    return reject(
      "WRONG_FULFILLMENT",
      ctx.fulfillmentType === "DELIVERY"
        ? "Questo codice è valido solo per il ritiro."
        : "Questo codice è valido solo per la consegna.",
    );
  }
  if (rule.newCustomersOnly && ctx.customer.previousOrders > 0) {
    return reject("NEW_CUSTOMERS_ONLY", "Questo codice è riservato al primo ordine.");
  }

  const subtotal = ctx.lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  if (rule.minSubtotalCents !== null && subtotal < rule.minSubtotalCents) {
    const shortfall = rule.minSubtotalCents - subtotal;
    return reject(
      "BELOW_MIN_SUBTOTAL",
      `Aggiungi ancora ${formatEuro(shortfall)} per usare questa promozione (minimo ${formatEuro(rule.minSubtotalCents)}).`,
      shortfall,
    );
  }

  const eligibleSubtotal = ctx.lines.reduce(
    (sum, l) => sum + (lineIsEligible(rule, l) ? l.lineTotalCents : 0),
    0,
  );

  if (rule.type === "FREE_DELIVERY") {
    if (ctx.fulfillmentType !== "DELIVERY")
      return reject("WRONG_FULFILLMENT", "Questo codice è valido solo per la consegna.");
    if (ctx.deliveryFeeCents <= 0) return reject("NOTHING_TO_DISCOUNT", "La consegna è già gratuita.");
    return {
      ok: true,
      itemsDiscountCents: 0,
      deliveryDiscountCents: ctx.deliveryFeeCents,
      eligibleSubtotalCents: eligibleSubtotal,
    };
  }

  if (eligibleSubtotal <= 0)
    return reject("NO_ELIGIBLE_ITEMS", "Nessun prodotto nel carrello è incluso in questa promozione.");

  let discount = 0;
  if (rule.type === "PERCENTAGE") {
    discount = applyBps(eligibleSubtotal, rule.percentBps ?? 0);
    if (rule.maxDiscountCents !== null) discount = Math.min(discount, rule.maxDiscountCents);
  } else {
    discount = Math.min(rule.amountCents ?? 0, eligibleSubtotal);
  }
  if (discount <= 0)
    return reject("NOTHING_TO_DISCOUNT", "Questa promozione non genera alcuno sconto su questo carrello.");

  return {
    ok: true,
    itemsDiscountCents: discount,
    deliveryDiscountCents: 0,
    eligibleSubtotalCents: eligibleSubtotal,
  };
}

export function couponValueLabel(rule: Pick<CouponRule, "type" | "percentBps" | "amountCents">): string {
  switch (rule.type) {
    case "PERCENTAGE":
      return `-${((rule.percentBps ?? 0) / 100).toLocaleString("it-IT")}%`;
    case "FIXED_AMOUNT":
      return `-${formatEuro(rule.amountCents ?? 0, { compact: true })}`;
    case "FREE_DELIVERY":
      return "Consegna gratuita";
  }
}

export interface CouponChoice {
  rule: CouponRule;
  evaluation: Extract<CouponEvaluation, { ok: true }>;
}

/**
 * Picks the coupon to apply: the code typed by the customer when valid, unless an automatic
 * promotion is strictly more convenient (the customer always gets the best price, and is told so).
 */
export function chooseCoupon(
  manual: CouponChoice | null,
  automatic: readonly CouponChoice[],
): { choice: CouponChoice | null; replacedManual: boolean } {
  const value = (c: CouponChoice) => c.evaluation.itemsDiscountCents + c.evaluation.deliveryDiscountCents;
  const bestAuto = [...automatic].sort((a, b) => value(b) - value(a))[0] ?? null;
  if (manual && bestAuto && value(bestAuto) > value(manual))
    return { choice: bestAuto, replacedManual: true };
  return { choice: manual ?? bestAuto, replacedManual: false };
}

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}
