/**
 * Opening hours and scheduling engine. All wall-clock maths happens in the restaurant timezone
 * (Europe/Rome), so DST changes and server timezone never shift a service window.
 */
import { TZDate } from "@date-fns/tz";
import type { FulfillmentType } from "@dimsum/types";

export interface WeeklyRange {
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  weekday: number;
  /** "HH:mm". A closing time ≤ opening time means the window ends after midnight. */
  opensAt: string;
  closesAt: string;
}

export interface Closure {
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
  /** null = every service. */
  appliesTo: FulfillmentType[] | null;
}

export interface ScheduleConfig {
  timezone: string;
  delivery: WeeklyRange[];
  pickup: WeeklyRange[];
  closures: Closure[];
  /** "Blocca nuovi ordini": the site stays up, checkout is refused. */
  ordersPaused: boolean;
  pausedUntil: Date | null;
  slotIntervalMinutes: number;
  /** Minimum minutes between now and the start of a scheduled slot. */
  deliveryLeadMinutes: number;
  pickupLeadMinutes: number;
  /** How many days after today can be scheduled (0 = today only). */
  maxScheduleDays: number;
  schedulingEnabled: boolean;
  /** ASAP orders stop being accepted this many minutes before the window closes. */
  lastOrderBufferMinutes: number;
}

export interface TimeWindow {
  start: Date;
  end: Date;
}

export type ClosedReason = "PAUSED" | "CLOSURE" | "OUTSIDE_HOURS" | "NO_HOURS";

export interface FulfillmentAvailability {
  available: boolean;
  reason: ClosedReason | null;
  closureReason: string | null;
  currentWindow: TimeWindow | null;
  nextOpeningAt: Date | null;
}

const MINUTE = 60_000;

export function parseHHmm(value: string): { h: number; m: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new RangeError(`invalid time "${value}"`);
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || (h === 24 && m !== 0)) throw new RangeError(`invalid time "${value}"`);
  return { h, m };
}

/** ISO weekday (1–7) of an instant in the given timezone. */
export function isoWeekday(instant: Date, timezone: string): number {
  const d = new TZDate(instant.getTime(), timezone).getDay();
  return d === 0 ? 7 : d;
}

/** Calendar date ("YYYY-MM-DD") of an instant in the given timezone. */
export function localDateKey(instant: Date, timezone: string): string {
  const d = new TZDate(instant.getTime(), timezone);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localMidnight(dateKey: string, timezone: string): TZDate {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  return TZDate.tz(timezone, y, m - 1, d, 0, 0);
}

function addDaysKey(dateKey: string, days: number, timezone: string): string {
  const base = localMidnight(dateKey, timezone);
  const next = TZDate.tz(timezone, base.getFullYear(), base.getMonth(), base.getDate() + days, 12, 0);
  return localDateKey(next, timezone);
}

/** Absolute windows of one local calendar day. */
export function windowsForDate(
  ranges: readonly WeeklyRange[],
  dateKey: string,
  timezone: string,
): TimeWindow[] {
  const midnight = localMidnight(dateKey, timezone);
  const weekday = isoWeekday(new Date(midnight.getTime() + 12 * 3600_000), timezone);
  return ranges
    .filter((r) => r.weekday === weekday)
    .map((r) => {
      const open = parseHHmm(r.opensAt);
      const close = parseHHmm(r.closesAt);
      const start = TZDate.tz(
        timezone,
        midnight.getFullYear(),
        midnight.getMonth(),
        midnight.getDate(),
        open.h,
        open.m,
      );
      const overnight = close.h * 60 + close.m <= open.h * 60 + open.m;
      const end = TZDate.tz(
        timezone,
        midnight.getFullYear(),
        midnight.getMonth(),
        midnight.getDate() + (overnight ? 1 : 0),
        close.h,
        close.m,
      );
      return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function rangesFor(config: ScheduleConfig, kind: FulfillmentType) {
  return kind === "DELIVERY" ? config.delivery : config.pickup;
}

function closureAt(config: ScheduleConfig, instant: Date, kind: FulfillmentType): Closure | null {
  return (
    config.closures.find(
      (c) =>
        (c.appliesTo === null || c.appliesTo.includes(kind)) && instant >= c.startsAt && instant < c.endsAt,
    ) ?? null
  );
}

/** Windows (minus closures) covering [from, from + days]. Includes yesterday for overnight windows. */
export function upcomingWindows(
  config: ScheduleConfig,
  kind: FulfillmentType,
  from: Date,
  days: number,
): TimeWindow[] {
  const ranges = rangesFor(config, kind);
  const startKey = addDaysKey(localDateKey(from, config.timezone), -1, config.timezone);
  const windows: TimeWindow[] = [];
  for (let i = 0; i <= days + 1; i++) {
    windows.push(...windowsForDate(ranges, addDaysKey(startKey, i, config.timezone), config.timezone));
  }
  // Subtract closures.
  const relevant = config.closures.filter((c) => c.appliesTo === null || c.appliesTo.includes(kind));
  let result = windows;
  for (const c of relevant) {
    result = result.flatMap((w) => {
      if (c.endsAt <= w.start || c.startsAt >= w.end) return [w];
      const parts: TimeWindow[] = [];
      if (c.startsAt > w.start) parts.push({ start: w.start, end: c.startsAt });
      if (c.endsAt < w.end) parts.push({ start: c.endsAt, end: w.end });
      return parts;
    });
  }
  return result.filter((w) => w.end > from).sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function getAvailability(
  config: ScheduleConfig,
  kind: FulfillmentType,
  now: Date,
): FulfillmentAvailability {
  const ranges = rangesFor(config, kind);
  const windows = upcomingWindows(config, kind, now, 7);
  const bufferMs = config.lastOrderBufferMinutes * MINUTE;
  const current = windows.find((w) => now >= w.start && now.getTime() < w.end.getTime() - bufferMs) ?? null;
  const next = windows.find((w) => w.start > now) ?? null;
  const paused = config.ordersPaused && (config.pausedUntil === null || now < config.pausedUntil);

  if (ranges.length === 0) {
    return {
      available: false,
      reason: "NO_HOURS",
      closureReason: null,
      currentWindow: null,
      nextOpeningAt: null,
    };
  }
  if (paused) {
    const resume =
      config.pausedUntil && current && config.pausedUntil < current.end
        ? config.pausedUntil
        : (next?.start ?? null);
    return {
      available: false,
      reason: "PAUSED",
      closureReason: null,
      currentWindow: current,
      nextOpeningAt: resume,
    };
  }
  if (current) {
    return {
      available: true,
      reason: null,
      closureReason: null,
      currentWindow: current,
      nextOpeningAt: null,
    };
  }
  const closure = closureAt(config, now, kind);
  return {
    available: false,
    reason: closure ? "CLOSURE" : "OUTSIDE_HOURS",
    closureReason: closure?.reason ?? null,
    currentWindow: null,
    nextOpeningAt: next?.start ?? null,
  };
}

function ceilToInterval(instant: Date, intervalMinutes: number, timezone: string): Date {
  const d = new TZDate(instant.getTime(), timezone);
  const minutes =
    d.getHours() * 60 + d.getMinutes() + (d.getSeconds() > 0 || d.getMilliseconds() > 0 ? 1 : 0);
  const rounded = Math.ceil(minutes / intervalMinutes) * intervalMinutes;
  const res = TZDate.tz(timezone, d.getFullYear(), d.getMonth(), d.getDate(), 0, rounded);
  return new Date(res.getTime());
}

export interface Slot {
  start: Date;
  end: Date;
}

export interface DaySlots {
  dateKey: string;
  slots: Slot[];
}

/** Bookable slots for scheduled orders, grouped by local day. */
export function listSlots(config: ScheduleConfig, kind: FulfillmentType, now: Date): DaySlots[] {
  if (!config.schedulingEnabled) return [];
  const lead = (kind === "DELIVERY" ? config.deliveryLeadMinutes : config.pickupLeadMinutes) * MINUTE;
  const interval = config.slotIntervalMinutes;
  const earliest = ceilToInterval(new Date(now.getTime() + lead), interval, config.timezone);
  const todayKey = localDateKey(now, config.timezone);
  const lastKey = addDaysKey(todayKey, config.maxScheduleDays, config.timezone);
  const byDay = new Map<string, Slot[]>();

  for (const w of upcomingWindows(config, kind, now, config.maxScheduleDays)) {
    let cursor = w.start < earliest ? ceilToInterval(earliest, interval, config.timezone) : w.start;
    while (cursor.getTime() + interval * MINUTE <= w.end.getTime()) {
      const key = localDateKey(cursor, config.timezone);
      if (key > lastKey) break;
      if (key >= todayKey) {
        const slot = { start: cursor, end: new Date(cursor.getTime() + interval * MINUTE) };
        byDay.set(key, [...(byDay.get(key) ?? []), slot]);
      }
      cursor = new Date(cursor.getTime() + interval * MINUTE);
    }
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, slots]) => ({ dateKey, slots }));
}

export type SlotRejection = "SCHEDULING_DISABLED" | "TOO_SOON" | "TOO_FAR" | "OUTSIDE_HOURS" | "PAUSED";

export function validateRequestedSlot(
  config: ScheduleConfig,
  kind: FulfillmentType,
  requestedStart: Date,
  now: Date,
): { ok: true; slot: Slot } | { ok: false; reason: SlotRejection } {
  if (!config.schedulingEnabled) return { ok: false, reason: "SCHEDULING_DISABLED" };
  if (config.ordersPaused && (config.pausedUntil === null || requestedStart < config.pausedUntil)) {
    return { ok: false, reason: "PAUSED" };
  }
  const lead = (kind === "DELIVERY" ? config.deliveryLeadMinutes : config.pickupLeadMinutes) * MINUTE;
  if (requestedStart.getTime() < now.getTime() + lead - MINUTE) return { ok: false, reason: "TOO_SOON" };
  const lastKey = addDaysKey(localDateKey(now, config.timezone), config.maxScheduleDays, config.timezone);
  if (localDateKey(requestedStart, config.timezone) > lastKey) return { ok: false, reason: "TOO_FAR" };
  const slots = listSlots(config, kind, now).flatMap((d) => d.slots);
  const slot = slots.find((s) => s.start.getTime() === requestedStart.getTime());
  return slot ? { ok: true, slot } : { ok: false, reason: "OUTSIDE_HOURS" };
}

const timeFormatters = new Map<string, Intl.DateTimeFormat>();
export function formatTime(instant: Date, timezone: string): string {
  let f = timeFormatters.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
      hour12: false,
    });
    timeFormatters.set(timezone, f);
  }
  return f.format(instant);
}

/** "Oggi", "Domani" or "lunedì 12 ottobre". */
export function formatDayLabel(dateKey: string, now: Date, timezone: string): string {
  const today = localDateKey(now, timezone);
  if (dateKey === today) return "Oggi";
  if (dateKey === addDaysKey(today, 1, timezone)) return "Domani";
  const midday = localMidnight(dateKey, timezone);
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: timezone,
  }).format(new Date(midday.getTime() + 12 * 3600_000));
}

/** Human description of the next opening, e.g. "Apriamo alle 18:30" or "Apriamo domani alle 11:30". */
export function describeNextOpening(next: Date | null, now: Date, timezone: string): string | null {
  if (!next) return null;
  const day = formatDayLabel(localDateKey(next, timezone), now, timezone);
  const time = formatTime(next, timezone);
  if (day === "Oggi") return `Apriamo alle ${time}`;
  if (day === "Domani") return `Apriamo domani alle ${time}`;
  return `Apriamo ${day} alle ${time}`;
}

export { addDaysKey };
