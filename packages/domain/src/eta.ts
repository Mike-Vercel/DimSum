/**
 * ETA engine.
 *
 * Phases overlap: the rider drives to the restaurant while the kitchen cooks, so the pickup
 * happens at max(food ready, rider at restaurant) — never at the sum of the two. Every input is
 * optional-friendly: missing routing data degrades to explicit defaults and lowers confidence.
 */
import type { FulfillmentType } from "@dimsum/types";
import type { OrderMilestones } from "./order-state";

const MIN = 60_000;

export interface EtaSettings {
  defaultPrepMinutes: number;
  /** Orders the kitchen can cook in parallel without slowing down. */
  kitchenParallelCapacity: number;
  /** Extra minutes per order queued beyond the parallel capacity. */
  minutesPerQueuedOrder: number;
  /** Typical time for staff to accept a new order. */
  acceptanceMinutes: number;
  /** Time to assign a rider when one is free. */
  dispatchMinutes: number;
  /** Fallback rider → restaurant time when no location is known. */
  defaultRiderToRestaurantMinutes: number;
  /** Fallback when no rider is free and nobody is about to finish. */
  noRiderWaitMinutes: number;
  /** Handover at the counter. */
  handoffMinutes: number;
  /** Parking, stairs, intercom. */
  dropoffMinutes: number;
}

export const DEFAULT_ETA_SETTINGS: EtaSettings = {
  defaultPrepMinutes: 15,
  kitchenParallelCapacity: 4,
  minutesPerQueuedOrder: 3,
  acceptanceMinutes: 3,
  dispatchMinutes: 3,
  defaultRiderToRestaurantMinutes: 6,
  noRiderWaitMinutes: 15,
  handoffMinutes: 2,
  dropoffMinutes: 3,
};

export interface EtaInput {
  now: Date;
  fulfillmentType: FulfillmentType;
  placedAt: Date;
  scheduledFor: Date | null;
  milestones: OrderMilestones;
  /** Set by the kitchen when accepting the order. */
  prepMinutes: number | null;
  /** Active kitchen orders ahead of this one (received/confirmed/preparing, not ready). */
  kitchenQueue: number;
  riders: {
    available: number;
    /** Minutes until the first busy rider is expected to be free, if known. */
    minutesUntilNextFree: number | null;
  };
  /** Route restaurant → customer (seconds). Null only when routing and estimate both failed. */
  restaurantToCustomerSeconds: number | null;
  /** Live: assigned rider → restaurant (seconds). */
  riderToRestaurantSeconds: number | null;
  /** Live: rider (on the way) → customer (seconds). */
  riderToCustomerSeconds: number | null;
  zoneAdjustmentMinutes: number;
  settings?: Partial<EtaSettings>;
}

export interface EtaResult {
  readyAt: Date;
  pickupAt: Date | null;
  arrivalAt: Date;
  windowStart: Date;
  windowEnd: Date;
  minutes: number;
  confidence: "low" | "medium" | "high";
}

const max = (a: Date, b: Date) => (a > b ? a : b);
const plus = (d: Date, minutes: number) => new Date(d.getTime() + minutes * MIN);

function floorTo5(d: Date): Date {
  const t = d.getTime();
  return new Date(t - (t % (5 * MIN)));
}
function ceilTo5(d: Date): Date {
  const t = d.getTime();
  const r = t % (5 * MIN);
  return r === 0 ? d : new Date(t - r + 5 * MIN);
}

export function kitchenReadyAt(input: EtaInput, s: EtaSettings): Date {
  const m = input.milestones;
  if (m.readyAt) return m.readyAt;
  if (m.confirmedAt && input.prepMinutes) {
    const promised = plus(m.confirmedAt, input.prepMinutes);
    // A late kitchen never produces an ETA in the past: assume it is about to finish.
    return promised > input.now ? promised : plus(input.now, 2);
  }
  const queuePenalty =
    Math.max(0, input.kitchenQueue - (s.kitchenParallelCapacity - 1)) * s.minutesPerQueuedOrder;
  const start = max(input.now, m.receivedAt ?? input.placedAt);
  return plus(start, s.acceptanceMinutes + s.defaultPrepMinutes + queuePenalty);
}

export function computeEta(input: EtaInput): EtaResult | null {
  const s: EtaSettings = { ...DEFAULT_ETA_SETTINGS, ...input.settings };
  const m = input.milestones;
  if (m.cancelledAt || m.refundedAt || m.deliveredAt) return null;

  const travelMinutes =
    input.restaurantToCustomerSeconds !== null ? Math.ceil(input.restaurantToCustomerSeconds / 60) : null;
  let readyAt = kitchenReadyAt(input, s);
  let pickupAt: Date | null = null;
  let arrivalAt: Date;
  let confidence: EtaResult["confidence"] = m.confirmedAt ? "medium" : "low";

  if (input.fulfillmentType === "PICKUP") {
    if (input.scheduledFor && !m.confirmedAt) readyAt = max(readyAt, input.scheduledFor);
    arrivalAt = readyAt;
    if (m.readyAt) confidence = "high";
  } else if (m.pickedUpAt) {
    const remaining =
      input.riderToCustomerSeconds !== null
        ? Math.ceil(input.riderToCustomerSeconds / 60)
        : Math.max(
            1,
            (travelMinutes ?? 10) - Math.floor((input.now.getTime() - m.pickedUpAt.getTime()) / MIN),
          );
    pickupAt = m.pickedUpAt;
    arrivalAt = plus(input.now, remaining + s.dropoffMinutes);
    confidence = input.riderToCustomerSeconds !== null ? "high" : "medium";
  } else {
    let riderAtRestaurant: Date;
    if (m.riderAssignedAt) {
      const toRestaurant =
        input.riderToRestaurantSeconds !== null
          ? Math.ceil(input.riderToRestaurantSeconds / 60)
          : s.defaultRiderToRestaurantMinutes;
      riderAtRestaurant = plus(input.now, toRestaurant);
    } else if (input.riders.available > 0) {
      riderAtRestaurant = plus(input.now, s.dispatchMinutes + s.defaultRiderToRestaurantMinutes);
    } else {
      riderAtRestaurant = plus(
        input.now,
        (input.riders.minutesUntilNextFree ?? s.noRiderWaitMinutes) + s.defaultRiderToRestaurantMinutes,
      );
    }
    pickupAt = plus(max(readyAt, riderAtRestaurant), s.handoffMinutes);
    arrivalAt = plus(pickupAt, (travelMinutes ?? 12) + s.dropoffMinutes + input.zoneAdjustmentMinutes);
    if (input.scheduledFor && !m.confirmedAt) arrivalAt = max(arrivalAt, input.scheduledFor);
    if (travelMinutes === null) confidence = "low";
  }

  // The window narrows as uncertainty drops: 10 minutes until pickup, 5 once on the way.
  const width = confidence === "high" ? 5 : 10;
  let windowStart = floorTo5(plus(arrivalAt, -width / 2));
  if (windowStart < input.now) windowStart = ceilTo5(input.now);
  const windowEnd = plus(windowStart, width);
  if (arrivalAt > windowEnd) arrivalAt = windowEnd;

  const minutes = Math.max(1, Math.round((arrivalAt.getTime() - input.now.getTime()) / MIN));
  return { readyAt, pickupAt, arrivalAt, windowStart, windowEnd, minutes, confidence };
}

/** "Consegna stimata 25–35 min" shown before ordering (ASAP, nothing confirmed yet). */
export function estimateAsapRange(input: {
  now: Date;
  fulfillmentType: FulfillmentType;
  kitchenQueue: number;
  ridersAvailable: number;
  minutesUntilNextFree: number | null;
  restaurantToCustomerSeconds: number | null;
  /** When no address is known yet, a typical route of the delivery area (seconds). */
  typicalTravelSeconds: number;
  zoneAdjustmentMinutes: number;
  settings?: Partial<EtaSettings>;
}): { minMinutes: number; maxMinutes: number } {
  const eta = computeEta({
    now: input.now,
    fulfillmentType: input.fulfillmentType,
    placedAt: input.now,
    scheduledFor: null,
    milestones: {
      paidAt: null,
      receivedAt: input.now,
      confirmedAt: null,
      preparingAt: null,
      readyAt: null,
      riderAssignedAt: null,
      riderToRestaurantAt: null,
      pickedUpAt: null,
      onTheWayAt: null,
      deliveredAt: null,
      cancelledAt: null,
      refundedAt: null,
    },
    prepMinutes: null,
    kitchenQueue: input.kitchenQueue,
    riders: { available: input.ridersAvailable, minutesUntilNextFree: input.minutesUntilNextFree },
    restaurantToCustomerSeconds: input.restaurantToCustomerSeconds ?? input.typicalTravelSeconds,
    riderToRestaurantSeconds: null,
    riderToCustomerSeconds: null,
    zoneAdjustmentMinutes: input.zoneAdjustmentMinutes,
    ...(input.settings ? { settings: input.settings } : {}),
  });
  const minutes = eta ? Math.round((eta.arrivalAt.getTime() - input.now.getTime()) / MIN) : 30;
  const minMinutes = Math.max(5, Math.floor((minutes - 5) / 5) * 5);
  return { minMinutes, maxMinutes: minMinutes + 10 };
}
