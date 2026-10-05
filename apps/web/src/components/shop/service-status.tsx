"use client";

import type { FulfillmentType, ServiceStatusDTO } from "@dimsum/types";
import { CalendarClock, Clock } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { useServiceStatus } from "@/lib/service-status";
import { useOrderPrefs } from "@/lib/stores/order-prefs";

const timeFmt = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
});
const dayFmt = new Intl.DateTimeFormat("it-IT", { weekday: "long", timeZone: "Europe/Rome" });

function nextOpeningLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today.getTime() + 86_400_000).toDateString() === d.toDateString();
  const when = sameDay ? "" : tomorrow ? "domani " : `${dayFmt.format(d)} `;
  return `Apriamo ${when}alle ${timeFmt.format(d)}`;
}

/** "Aperto · Consegna stimata 25–35 min" or "Al momento siamo chiusi" (values from business logic). */
export function ServiceStatusBanner({
  initial,
  className,
}: {
  initial?: ServiceStatusDTO;
  className?: string;
}) {
  const { data } = useServiceStatus(initial);
  const fulfillment = useOrderPrefs((s) => s.fulfillment);
  if (!data) return <Skeleton className={cn("h-14 rounded-2xl", className)} />;

  const f = fulfillment === "DELIVERY" ? data.delivery : data.pickup;
  const other: FulfillmentType = fulfillment === "DELIVERY" ? "PICKUP" : "DELIVERY";
  const otherAvailable = other === "DELIVERY" ? data.delivery.available : data.pickup.available;

  if (f.available && data.acceptingOrders) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-xs ring-1 ring-line/70",
          className,
        )}
        role="status"
      >
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-jade-500 opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-jade-500" />
        </span>
        <p className="min-w-0 flex-1 text-body-sm">
          <span className="font-semibold text-success">Aperto</span>
          <span className="text-fg-muted"> · </span>
          <span className="font-semibold">
            {fulfillment === "DELIVERY" ? "Consegna stimata" : "Ritiro in"} {f.etaMinMinutes}–
            {f.etaMaxMinutes} min
          </span>
        </p>
        <Clock className="size-4.5 text-fg-subtle" aria-hidden />
      </div>
    );
  }

  const reason = data.isPaused
    ? "Al momento non accettiamo nuovi ordini"
    : f.available
      ? "Al momento non accettiamo nuovi ordini"
      : !otherAvailable && !data.isOpen
        ? "Al momento siamo chiusi"
        : fulfillment === "DELIVERY"
          ? "La consegna al momento non è disponibile"
          : "Il ritiro al momento non è disponibile";
  const next = nextOpeningLabel(f.nextAvailableAt ?? data.nextOpeningAt);

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl bg-ink-900 px-5 py-4 text-center text-white",
        className,
      )}
      role="status"
    >
      <p className="flex items-center justify-center gap-2 text-body-sm font-semibold">
        <span className="size-2.5 shrink-0 rounded-full bg-red-400" aria-hidden />
        {reason}
      </p>
      {data.closureReason ? <p className="mt-0.5 text-body-sm text-white/70">{data.closureReason}</p> : null}
      {next ? <p className="mt-0.5 text-body-sm text-white/70">{next}</p> : null}
      {data.schedulingEnabled && !data.isPaused ? (
        <Link
          href="/checkout?programma=1"
          className="mt-3 inline-flex h-10 tap items-center gap-2 rounded-full bg-white px-5 text-caption font-semibold whitespace-nowrap text-ink-900"
        >
          <CalendarClock className="size-4" /> Programma il tuo ordine
        </Link>
      ) : null}
      {otherAvailable && !data.isPaused ? (
        <p className="mt-2 text-caption text-white/70">
          {other === "PICKUP"
            ? "Il ritiro al locale è disponibile."
            : "La consegna a domicilio è disponibile."}
        </p>
      ) : null}
    </div>
  );
}
