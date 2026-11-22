import { describe, expect, it } from "vitest";
import { acceptableFrom, isAcceptableNow, scheduledReadyAt } from "../src/scheduling";

const at = (hhmm: string) => new Date(`2026-11-22T${hhmm}:00+01:00`);

describe("scheduled orders acceptance window", () => {
  it("ASAP orders are acceptable at once", () => {
    const o = {
      isScheduled: false,
      scheduledFor: null,
      fulfillmentType: "DELIVERY" as const,
      routeDurationSeconds: 600,
    };
    expect(acceptableFrom(o)).toBeNull();
    expect(isAcceptableNow(o, at("12:00"))).toBe(true);
  });

  it("a delivery for 18:30 with a 10-minute ride: ready by 18:20, acceptable from 17:50", () => {
    const o = {
      isScheduled: true,
      scheduledFor: at("18:30"),
      fulfillmentType: "DELIVERY" as const,
      routeDurationSeconds: 600,
    };
    expect(scheduledReadyAt(o)).toEqual(at("18:20"));
    expect(acceptableFrom(o)).toEqual(at("17:50"));
    expect(isAcceptableNow(o, at("17:49"))).toBe(false);
    expect(isAcceptableNow(o, at("17:50"))).toBe(true);
  });

  it("a pickup for 18:30 is acceptable from 18:00", () => {
    const o = {
      isScheduled: true,
      scheduledFor: at("18:30"),
      fulfillmentType: "PICKUP" as const,
      routeDurationSeconds: null,
    };
    expect(acceptableFrom(o)).toEqual(at("18:00"));
  });
});
