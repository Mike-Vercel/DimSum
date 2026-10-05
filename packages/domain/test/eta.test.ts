import { describe, expect, it } from "vitest";
import { EMPTY_MILESTONES, computeEta, estimateAsapRange, type EtaInput } from "../src";

const now = new Date("2026-10-05T18:30:00Z");
const min = (m: number) => new Date(now.getTime() + m * 60_000);

const base: EtaInput = {
  now,
  fulfillmentType: "DELIVERY",
  placedAt: now,
  scheduledFor: null,
  milestones: { ...EMPTY_MILESTONES, paidAt: now, receivedAt: now },
  prepMinutes: null,
  kitchenQueue: 0,
  riders: { available: 2, minutesUntilNextFree: null },
  restaurantToCustomerSeconds: 10 * 60,
  riderToRestaurantSeconds: null,
  riderToCustomerSeconds: null,
  zoneAdjustmentMinutes: 0,
};

describe("computeEta", () => {
  it("overlaps kitchen and rider phases instead of summing them", () => {
    const confirmed = {
      ...base,
      milestones: { ...base.milestones, confirmedAt: now, riderAssignedAt: now },
      prepMinutes: 20,
      riderToRestaurantSeconds: 8 * 60,
    };
    const eta = computeEta(confirmed)!;
    // pickup = max(ready 20, rider 8) + handoff 2 = 22; arrival = 22 + travel 10 + dropoff 3 = 35
    expect(eta.pickupAt).toEqual(min(22));
    expect(eta.arrivalAt.getTime()).toBeLessThanOrEqual(min(35).getTime());
    expect(eta.arrivalAt.getTime()).toBeGreaterThan(min(30).getTime());
  });

  it("waits for the rider when the rider is the bottleneck", () => {
    const eta = computeEta({
      ...base,
      milestones: { ...base.milestones, confirmedAt: now, riderAssignedAt: now },
      prepMinutes: 5,
      riderToRestaurantSeconds: 15 * 60,
    })!;
    expect(eta.pickupAt).toEqual(min(17));
  });

  it("adds backlog and missing riders before confirmation, with a wide window", () => {
    const quiet = computeEta(base)!;
    const busy = computeEta({
      ...base,
      kitchenQueue: 8,
      riders: { available: 0, minutesUntilNextFree: 20 },
    })!;
    expect(busy.arrivalAt.getTime()).toBeGreaterThan(quiet.arrivalAt.getTime());
    expect(quiet.confidence).toBe("low");
    expect(quiet.windowEnd.getTime() - quiet.windowStart.getTime()).toBe(10 * 60_000);
  });

  it("narrows to a 5-minute window once the rider is on the way with live routing", () => {
    const eta = computeEta({
      ...base,
      milestones: {
        ...base.milestones,
        confirmedAt: min(-25),
        readyAt: min(-5),
        riderAssignedAt: min(-15),
        pickedUpAt: min(-3),
        onTheWayAt: min(-3),
      },
      prepMinutes: 20,
      riderToCustomerSeconds: 6 * 60,
    })!;
    expect(eta.confidence).toBe("high");
    expect(eta.windowEnd.getTime() - eta.windowStart.getTime()).toBe(5 * 60_000);
    expect(eta.minutes).toBeLessThanOrEqual(9);
  });

  it("never estimates in the past when the kitchen is late", () => {
    const eta = computeEta({
      ...base,
      milestones: { ...base.milestones, confirmedAt: min(-40) },
      prepMinutes: 15,
    })!;
    expect(eta.readyAt.getTime()).toBeGreaterThan(now.getTime());
    expect(eta.windowStart.getTime()).toBeGreaterThanOrEqual(now.getTime());
  });

  it("estimates pickup orders on kitchen time only", () => {
    const eta = computeEta({
      ...base,
      fulfillmentType: "PICKUP",
      milestones: { ...base.milestones, confirmedAt: now },
      prepMinutes: 15,
    })!;
    expect(eta.arrivalAt).toEqual(min(15));
    expect(eta.pickupAt).toBeNull();
  });

  it("returns null for closed orders", () => {
    expect(computeEta({ ...base, milestones: { ...base.milestones, deliveredAt: now } })).toBeNull();
    expect(computeEta({ ...base, milestones: { ...base.milestones, cancelledAt: now } })).toBeNull();
  });
});

describe("estimateAsapRange", () => {
  it("returns a 10-minute range rounded to 5 minutes", () => {
    const r = estimateAsapRange({
      now,
      fulfillmentType: "DELIVERY",
      kitchenQueue: 0,
      ridersAvailable: 1,
      minutesUntilNextFree: null,
      restaurantToCustomerSeconds: null,
      typicalTravelSeconds: 8 * 60,
      zoneAdjustmentMinutes: 0,
    });
    expect(r.maxMinutes - r.minMinutes).toBe(10);
    expect(r.minMinutes % 5).toBe(0);
    expect(r.minMinutes).toBeGreaterThanOrEqual(20);
  });
});
