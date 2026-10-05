import "server-only";
import { TZDate } from "@date-fns/tz";

/** Midnight of the local day containing `at`, in the restaurant's time zone (DST-safe). */
export function dayStart(at: Date, timeZone: string, offsetDays = 0): Date {
  const local = new TZDate(at.getTime(), timeZone);
  return new Date(
    new TZDate(local.getFullYear(), local.getMonth(), local.getDate() + offsetDays, timeZone).getTime(),
  );
}

export type RangeKey = "today" | "7d" | "30d" | "custom";

/** Reporting window: whole local days, "7d" = today and the 6 days before. */
export function reportRange(
  range: RangeKey,
  now: Date,
  timeZone: string,
  custom?: { from?: string; to?: string },
): { from: Date; to: Date } {
  const tomorrow = dayStart(now, timeZone, 1);
  switch (range) {
    case "today":
      return { from: dayStart(now, timeZone), to: tomorrow };
    case "30d":
      return { from: dayStart(now, timeZone, -29), to: tomorrow };
    case "custom": {
      const from = custom?.from ? dayStart(new Date(custom.from), timeZone) : dayStart(now, timeZone, -6);
      const to = custom?.to ? dayStart(new Date(custom.to), timeZone, 1) : tomorrow;
      return to > from ? { from, to } : { from, to: dayStart(from, timeZone, 1) };
    }
    default:
      return { from: dayStart(now, timeZone, -6), to: tomorrow };
  }
}
