import "server-only";
import {
  chooseCoupon,
  evaluateCoupon,
  normalizeCouponCode,
  type CouponChoice,
  type CouponContext,
  type CouponRule,
} from "@dimsum/domain";
import type { AppliedCouponDTO } from "@dimsum/types";
import { db, type Prisma } from "../db";

type CouponRow = Prisma.CouponGetPayload<object>;

export function toRule(c: CouponRow): CouponRule {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    type: c.type,
    percentBps: c.percentBps,
    amountCents: c.amountCents,
    maxDiscountCents: c.maxDiscountCents,
    minSubtotalCents: c.minSubtotalCents,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    isActive: c.isActive,
    autoApply: c.autoApply,
    maxRedemptions: c.maxRedemptions,
    redemptionsCount: c.redemptionsCount,
    perCustomerLimit: c.perCustomerLimit,
    fulfillmentTypes: c.fulfillmentTypes.length ? c.fulfillmentTypes : null,
    newCustomersOnly: c.newCustomersOnly,
    includedProductIds: c.includedProductIds,
    includedCategoryIds: c.includedCategoryIds,
    userId: c.userId,
  };
}

export interface CouponCustomer {
  userId: string | null;
  email: string | null;
}

/** Completed orders and redemptions per coupon, by account or (for guests) by e-mail. */
async function customerHistory(customer: CouponCustomer, couponIds: string[]) {
  const who: Prisma.OrderWhereInput[] = [];
  if (customer.userId) who.push({ userId: customer.userId });
  if (customer.email) who.push({ customerEmail: customer.email.toLowerCase() });
  if (who.length === 0) return { previousOrders: 0, redemptions: new Map<string, number>() };
  const [previousOrders, redemptions] = await Promise.all([
    db.order.count({ where: { OR: who, status: { notIn: ["PENDING_PAYMENT", "CANCELLED", "REFUNDED"] } } }),
    couponIds.length
      ? db.couponRedemption.groupBy({
          by: ["couponId"],
          where: {
            couponId: { in: couponIds },
            status: { not: "RELEASED" },
            OR: [
              ...(customer.userId ? [{ userId: customer.userId }] : []),
              ...(customer.email ? [{ customerEmail: customer.email.toLowerCase() }] : []),
            ],
          },
          _count: { _all: true },
        })
      : Promise.resolve([] as { couponId: string; _count: { _all: number } }[]),
  ]);
  return { previousOrders, redemptions: new Map(redemptions.map((r) => [r.couponId, r._count._all])) };
}

export interface CouponDecision {
  choice: CouponChoice | null;
  applied: AppliedCouponDTO | null;
  error: string | null;
  replacedManual: boolean;
}

/**
 * Finds the best applicable promotion: the typed code (if valid) or an automatic promotion,
 * whichever saves the customer more. Always evaluated server-side.
 */
export async function decideCoupon(input: {
  code: string | null;
  customer: CouponCustomer;
  context: Omit<CouponContext, "customer">;
  db?: Prisma.TransactionClient;
}): Promise<CouponDecision> {
  const client = input.db ?? db;
  const code = input.code ? normalizeCouponCode(input.code) : null;
  const [manualRow, autoRows] = await Promise.all([
    code ? client.coupon.findUnique({ where: { code } }) : Promise.resolve(null),
    client.coupon.findMany({ where: { autoApply: true, isActive: true } }),
  ]);
  const rows = [...(manualRow ? [manualRow] : []), ...autoRows.filter((r) => r.id !== manualRow?.id)];
  const history = await customerHistory(
    input.customer,
    rows.map((r) => r.id),
  );
  const ctx = (rule: CouponRule): CouponContext => ({
    ...input.context,
    customer: {
      userId: input.customer.userId,
      previousOrders: history.previousOrders,
      redemptionsOfCoupon: history.redemptions.get(rule.id) ?? 0,
    },
  });

  let error: string | null = null;
  let manual: CouponChoice | null = null;
  if (code && !manualRow) error = "Codice non valido. Controlla di averlo scritto correttamente.";
  if (manualRow) {
    const rule = toRule(manualRow);
    const evaluation = evaluateCoupon(rule, ctx(rule));
    if (evaluation.ok) manual = { rule, evaluation };
    else error = evaluation.message;
  }
  const automatic: CouponChoice[] = [];
  for (const row of autoRows) {
    const rule = toRule(row);
    const evaluation = evaluateCoupon(rule, ctx(rule));
    if (evaluation.ok) automatic.push({ rule, evaluation });
  }
  const { choice, replacedManual } = chooseCoupon(manual, automatic);
  const applied: AppliedCouponDTO | null = choice
    ? {
        code: choice.rule.autoApply ? null : choice.rule.code,
        name: choice.rule.name,
        type: choice.rule.type,
        discountCents: choice.evaluation.itemsDiscountCents + choice.evaluation.deliveryDiscountCents,
        automatic: choice.rule.autoApply,
      }
    : null;
  return {
    choice,
    applied,
    error: replacedManual ? "Abbiamo applicato una promozione più conveniente del tuo codice." : error,
    replacedManual,
  };
}
