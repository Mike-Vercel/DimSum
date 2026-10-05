/**
 * Coarse customer segments for offers. Only order history is used (no tracking, no third-party
 * data); personalised offers are shown only to customers who consented to PERSONALIZATION.
 */
import type { CustomerSegment } from "@dimsum/types";

export interface SegmentInput {
  now: Date;
  completedOrders: number;
  lastOrderAt: Date | null;
  ordersLast90Days: number;
}

export const INACTIVE_AFTER_DAYS = 60;
export const REGULAR_MIN_ORDERS_90D = 3;

export function customerSegment(input: SegmentInput): CustomerSegment {
  if (input.completedOrders === 0 || !input.lastOrderAt) return "NEW";
  const daysSinceLast = (input.now.getTime() - input.lastOrderAt.getTime()) / 86_400_000;
  if (daysSinceLast > INACTIVE_AFTER_DAYS) return "INACTIVE";
  if (input.ordersLast90Days >= REGULAR_MIN_ORDERS_90D) return "REGULAR";
  return "OCCASIONAL";
}
