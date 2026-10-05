import type { WeeklyHoursDTO } from "@dimsum/types";

const DAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

/** Groups identical days: "Lun–Dom 11:30–15:00 · 18:30–23:00". */
export function summarizeHours(hours: WeeklyHoursDTO[]): { days: string; ranges: string }[] {
  const out: { from: number; to: number; ranges: string }[] = [];
  for (const d of hours) {
    const ranges = d.ranges.length ? d.ranges.map((r) => `${r.opensAt}–${r.closesAt}`).join(" · ") : "Chiuso";
    const last = out[out.length - 1];
    if (last && last.ranges === ranges && last.to === d.weekday - 1) last.to = d.weekday;
    else out.push({ from: d.weekday, to: d.weekday, ranges });
  }
  const short = (n: number) => DAYS[n - 1]!.slice(0, 3);
  return out.map((g) => ({
    days: g.from === g.to ? DAYS[g.from - 1]! : `${short(g.from)}–${short(g.to)}`,
    ranges: g.ranges,
  }));
}
