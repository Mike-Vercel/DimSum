"use client";

import type { FulfillmentType, ServiceStatusDTO } from "@dimsum/types";
import { CalendarClock, MoonStar } from "lucide-react";
import { cn } from "@/lib/cn";

/** "lunedì 23 nov alle 11:30" in the restaurant's time zone. */
export function reopeningLabel(iso: string | null | undefined, timeZone: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "short", timeZone }).format(d);
  const time = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone }).format(d);
  return `${day} alle ${time}`;
}

/** Orders "as soon as possible" are not possible right now for this mode (closed, or the mode is off). */
export function asapUnavailable(status: ServiceStatusDTO | undefined, fulfillment: FulfillmentType): boolean {
  if (!status) return false;
  const mode = fulfillment === "DELIVERY" ? status.delivery : status.pickup;
  return !status.acceptingOrders || !mode.available;
}

/**
 * Shown before and during checkout when the restaurant is closed: when it reopens and, if scheduling
 * is on, that the order can already be placed for a later time.
 */
export function ClosedNotice({
  status,
  fulfillment,
  timeZone,
  className,
}: {
  status: ServiceStatusDTO;
  fulfillment: FulfillmentType;
  timeZone: string;
  className?: string;
}) {
  const mode = fulfillment === "DELIVERY" ? status.delivery : status.pickup;
  const reopens = reopeningLabel(mode.nextAvailableAt ?? status.nextOpeningAt, timeZone);
  const paused = status.isPaused;
  return (
    <div
      role="status"
      className={cn("flex gap-3 rounded-2xl bg-info-soft px-4 py-3.5 text-body-sm text-info", className)}
    >
      {status.schedulingEnabled ? (
        <CalendarClock className="mt-0.5 size-5 shrink-0" aria-hidden />
      ) : (
        <MoonStar className="mt-0.5 size-5 shrink-0" aria-hidden />
      )}
      <div className="space-y-0.5">
        <p className="font-bold">
          {paused ? "Ordini in pausa in questo momento" : "Siamo chiusi in questo momento"}
        </p>
        <p className="text-fg-muted">
          {reopens ? <>Riapriamo {reopens}. </> : null}
          {status.schedulingEnabled
            ? "Puoi già ordinare: scegli giorno e orario, lo prepariamo per allora."
            : "Torna a trovarci allora: ti aspettiamo!"}
        </p>
      </div>
    </div>
  );
}
