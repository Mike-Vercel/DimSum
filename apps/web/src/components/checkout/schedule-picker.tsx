"use client";

import type { FulfillmentType } from "@dimsum/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Chip } from "@/components/ui/badge";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { Schedule } from "@/lib/stores/order-prefs";

/** "lun 23 nov" for a "YYYY-MM-DD" day (noon UTC: the same calendar day in any time zone). */
function shortDate(key: string): string {
  return new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${key}T12:00:00Z`),
  );
}

/** Day chips + time slots for scheduled orders ("Programma"). Slots come from the server rules. */
export function SchedulePicker({
  fulfillment,
  value,
  onChange,
}: {
  fulfillment: FulfillmentType;
  value: Schedule;
  onChange: (s: Schedule) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["slots", fulfillment],
    queryFn: () => api.restaurant.slots(fulfillment),
    staleTime: 60_000,
  });
  const days = data?.days ?? [];
  const selectedDay = days.find((d) => d.slots.some((s) => s.start === value.slotStart))?.date;
  const [day, setDay] = useState<string | null>(null);
  const activeDay = day ?? selectedDay ?? days[0]?.date ?? null;

  if (isLoading) return <Skeleton className="h-32 rounded-2xl" />;
  if (days.length === 0) {
    return (
      <EmptyState
        className="py-6"
        title="Nessun orario disponibile"
        description="Al momento non ci sono fasce prenotabili. Riprova più tardi."
      />
    );
  }
  const slots = days.find((d) => d.date === activeDay)?.slots ?? [];
  return (
    <div className="space-y-3">
      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        {days.map((d) => (
          <Chip
            key={d.date}
            selected={d.date === activeDay}
            onClick={() => setDay(d.date)}
            className="capitalize"
          >
            {d.label === shortDate(d.date) || /\d/.test(d.label) ? d.label : `${d.label} · ${shortDate(d.date)}`}
          </Chip>
        ))}
      </div>
      <div role="radiogroup" aria-label="Fascia oraria" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {slots.map((s) => {
          const selected = s.start === value.slotStart;
          return (
            <button
              key={s.start}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!s.available}
              onClick={() =>
                onChange({
                  mode: "scheduled",
                  slotStart: s.start,
                  slotLabel: `${days.find((d) => d.date === activeDay)?.label ?? ""} ${activeDay ? shortDate(activeDay) : ""}, ${s.label}`,
                })
              }
              className={cn(
                "h-11 tap rounded-xl text-body-sm font-semibold tabular-nums ring-1 transition-colors ring-inset disabled:opacity-40",
                selected ? "bg-brand text-white ring-brand" : "bg-surface ring-line hover:bg-surface-2",
              )}
            >
              {s.label.split("–")[0]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
