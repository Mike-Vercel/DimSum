import { describe, expect, it } from "vitest";
import { dayStart, reportRange } from "./time";

const TZ = "Europe/Rome";

describe("dayStart", () => {
  it("returns local midnight in the restaurant time zone", () => {
    // 00:30 in Rome on 5 October (CEST, UTC+2) is still 4 October in UTC.
    const at = new Date("2026-10-04T22:30:00Z");
    expect(dayStart(at, TZ).toISOString()).toBe("2026-10-04T22:00:00.000Z");
    expect(dayStart(at, TZ, 1).toISOString()).toBe("2026-10-05T22:00:00.000Z");
  });

  it("handles the switch to winter time (25 October 2026 is 25 hours long)", () => {
    const at = new Date("2026-10-25T12:00:00Z");
    const start = dayStart(at, TZ);
    const next = dayStart(at, TZ, 1);
    expect(start.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(next.toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect((next.getTime() - start.getTime()) / 3_600_000).toBe(25);
  });
});

describe("reportRange", () => {
  const now = new Date("2026-10-05T10:00:00Z");

  it("covers whole local days", () => {
    const today = reportRange("today", now, TZ);
    expect(today.from.toISOString()).toBe("2026-10-04T22:00:00.000Z");
    expect(today.to.toISOString()).toBe("2026-10-05T22:00:00.000Z");
    const week = reportRange("7d", now, TZ);
    expect((week.to.getTime() - week.from.getTime()) / 86_400_000).toBe(7);
  });

  it("never returns an empty custom range", () => {
    const r = reportRange("custom", now, TZ, { from: "2026-10-05T00:00:00Z", to: "2026-10-01T00:00:00Z" });
    expect(r.to.getTime()).toBeGreaterThan(r.from.getTime());
  });
});
