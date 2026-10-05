import { describe, expect, it } from "vitest";
import catalog from "../../db/data/brenvo/catalog.json" with { type: "json" };
import {
  describeNextOpening,
  formatTime,
  getAvailability,
  listSlots,
  localDateKey,
  validateRequestedSlot,
  windowsForDate,
  type ScheduleConfig,
} from "../src";

const TZ = "Europe/Rome";

/** Real DIMSUM ordering windows: every day 11:30–14:30 and 18:30–22:30. */
const config: ScheduleConfig = {
  timezone: TZ,
  delivery: catalog.restaurant.deliveryHours,
  pickup: catalog.restaurant.pickupHours,
  closures: [],
  ordersPaused: false,
  pausedUntil: null,
  slotIntervalMinutes: 15,
  deliveryLeadMinutes: 20,
  pickupLeadMinutes: 15,
  maxScheduleDays: 1,
  schedulingEnabled: true,
  lastOrderBufferMinutes: 0,
};

/** Wall-clock time in Rome → UTC instant (October 2026 is CEST, UTC+2, until the 25th). */
const rome = (iso: string) => new Date(`${iso}+02:00`);

describe("service windows", () => {
  it("builds the two daily windows in local time", () => {
    const w = windowsForDate(config.delivery, "2026-10-05", TZ);
    expect(w.map((x) => [formatTime(x.start, TZ), formatTime(x.end, TZ)])).toEqual([
      ["11:30", "14:30"],
      ["18:30", "22:30"],
    ]);
  });

  it("keeps local times across the DST change (25 Oct 2026, back to UTC+1)", () => {
    const w = windowsForDate(config.delivery, "2026-10-25", TZ);
    expect(formatTime(w[1]!.start, TZ)).toBe("18:30");
    expect(w[1]!.start.toISOString()).toBe("2026-10-25T17:30:00.000Z");
  });

  it("is open during service and closed in between, with the next opening", () => {
    expect(getAvailability(config, "DELIVERY", rome("2026-10-05T12:00:00")).available).toBe(true);
    const afternoon = getAvailability(config, "DELIVERY", rome("2026-10-05T16:00:00"));
    expect(afternoon).toMatchObject({ available: false, reason: "OUTSIDE_HOURS" });
    expect(formatTime(afternoon.nextOpeningAt!, TZ)).toBe("18:30");
    expect(describeNextOpening(afternoon.nextOpeningAt, rome("2026-10-05T16:00:00"), TZ)).toBe(
      "Apriamo alle 18:30",
    );
    const night = getAvailability(config, "PICKUP", rome("2026-10-05T23:30:00"));
    expect(describeNextOpening(night.nextOpeningAt, rome("2026-10-05T23:30:00"), TZ)).toBe(
      "Apriamo domani alle 11:30",
    );
  });

  it("stops ASAP orders before closing when a buffer is configured", () => {
    const buffered = { ...config, lastOrderBufferMinutes: 15 };
    expect(getAvailability(buffered, "DELIVERY", rome("2026-10-05T22:20:00")).available).toBe(false);
    expect(getAvailability(buffered, "DELIVERY", rome("2026-10-05T22:10:00")).available).toBe(true);
  });

  it("honours extraordinary closures for one service only", () => {
    const closed = {
      ...config,
      closures: [
        {
          startsAt: rome("2026-10-05T00:00:00"),
          endsAt: rome("2026-10-06T00:00:00"),
          reason: "Inventario",
          appliesTo: ["DELIVERY" as const],
        },
      ],
    };
    expect(getAvailability(closed, "DELIVERY", rome("2026-10-05T12:00:00"))).toMatchObject({
      available: false,
      reason: "CLOSURE",
      closureReason: "Inventario",
    });
    expect(getAvailability(closed, "PICKUP", rome("2026-10-05T12:00:00")).available).toBe(true);
  });

  it("blocks new orders while paused without closing the site", () => {
    const paused = { ...config, ordersPaused: true, pausedUntil: rome("2026-10-05T19:30:00") };
    const r = getAvailability(paused, "DELIVERY", rome("2026-10-05T19:00:00"));
    expect(r).toMatchObject({ available: false, reason: "PAUSED" });
    expect(formatTime(r.nextOpeningAt!, TZ)).toBe("19:30");
    expect(getAvailability(paused, "DELIVERY", rome("2026-10-05T19:31:00")).available).toBe(true);
  });
});

describe("scheduled slots", () => {
  it("lists 15-minute slots after the lead time, today and tomorrow only", () => {
    const now = rome("2026-10-05T19:02:00");
    const days = listSlots(config, "DELIVERY", now);
    expect(days.map((d) => d.dateKey)).toEqual(["2026-10-05", "2026-10-06"]);
    expect(formatTime(days[0]!.slots[0]!.start, TZ)).toBe("19:30");
    expect(formatTime(days[0]!.slots.at(-1)!.end, TZ)).toBe("22:30");
    expect(formatTime(days[1]!.slots[0]!.start, TZ)).toBe("11:30");
  });

  it("validates requested slots server-side", () => {
    const now = rome("2026-10-05T19:02:00");
    expect(validateRequestedSlot(config, "PICKUP", rome("2026-10-05T19:30:00"), now).ok).toBe(true);
    expect(validateRequestedSlot(config, "PICKUP", rome("2026-10-05T19:05:00"), now)).toMatchObject({
      ok: false,
      reason: "TOO_SOON",
    });
    expect(validateRequestedSlot(config, "PICKUP", rome("2026-10-06T16:00:00"), now)).toMatchObject({
      ok: false,
      reason: "OUTSIDE_HOURS",
    });
    expect(validateRequestedSlot(config, "PICKUP", rome("2026-10-07T12:00:00"), now)).toMatchObject({
      ok: false,
      reason: "TOO_FAR",
    });
    expect(
      validateRequestedSlot(
        { ...config, schedulingEnabled: false },
        "PICKUP",
        rome("2026-10-05T20:00:00"),
        now,
      ),
    ).toMatchObject({
      ok: false,
      reason: "SCHEDULING_DISABLED",
    });
  });

  it("computes local dates in the restaurant timezone", () => {
    expect(localDateKey(new Date("2026-10-05T22:30:00Z"), TZ)).toBe("2026-10-06");
  });
});
