"use client";

import { formatEuro } from "@dimsum/domain";
import type { CartQuoteDTO, CouponPublicDTO } from "@dimsum/types";
import { useQuery } from "@tanstack/react-query";
import { BadgePercent, Bike } from "lucide-react";
import { Skeleton } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useOrderPrefs } from "@/lib/stores/order-prefs";

function Row({
  label,
  value,
  strong,
  muted,
  accent,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4",
        strong ? "text-title-sm font-extrabold" : "text-body-sm",
        muted && "text-fg-muted",
      )}
    >
      <dt>{label}</dt>
      <dd className={cn("tabular-nums", accent && "font-semibold text-success")}>{value}</dd>
    </div>
  );
}

function Progress({ value, max, children }: { value: number; max: number; children: React.ReactNode }) {
  const pct = Math.max(4, Math.min(100, (value / max) * 100));
  return (
    <div className="rounded-xl bg-surface-2 p-3 ring-1 ring-line">
      <p className="text-caption font-medium">{children}</p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-500 ease-[var(--ease-out-quint)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Nudges toward the nearest automatic promotion (e.g. "20% sopra 30 €"), never invasive. */
function PromoNudge({ subtotal, applied }: { subtotal: number; applied: boolean }) {
  const { data } = useQuery({
    queryKey: ["offers"],
    queryFn: () => api.offers.list(),
    staleTime: 5 * 60_000,
  });
  if (applied) return null;
  const next = (data?.coupons ?? [])
    .filter((c: CouponPublicDTO) => c.automatic && c.minSubtotalCents && c.minSubtotalCents > subtotal)
    .sort((a, b) => (a.minSubtotalCents ?? 0) - (b.minSubtotalCents ?? 0))[0];
  if (!next?.minSubtotalCents) return null;
  const missing = next.minSubtotalCents - subtotal;
  if (missing > next.minSubtotalCents * 0.6) return null;
  return (
    <Progress value={subtotal} max={next.minSubtotalCents}>
      <BadgePercent className="mr-1 inline size-3.5 text-brand" aria-hidden />
      Aggiungi {formatEuro(missing)} per ottenere: {next.name}
    </Progress>
  );
}

export function CartSummary({ quote, loading }: { quote: CartQuoteDTO | undefined; loading: boolean }) {
  const fulfillment = useOrderPrefs((s) => s.fulfillment);
  if (!quote) {
    return (
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }
  const t = quote.totals;
  const needsAddress = quote.blockers.includes("ADDRESS_REQUIRED");
  return (
    <div className={cn("space-y-3 transition-opacity", loading && "opacity-70")}>
      {quote.minimumOrderShortfallCents > 0 ? (
        <Progress value={t.subtotalCents} max={quote.minimumOrderCents}>
          Aggiungi {formatEuro(quote.minimumOrderShortfallCents)} per raggiungere il minimo d&apos;ordine di{" "}
          {formatEuro(quote.minimumOrderCents)} della tua zona.
        </Progress>
      ) : quote.freeDeliveryShortfallCents && quote.freeDeliveryShortfallCents > 0 ? (
        <Progress value={t.subtotalCents} max={t.subtotalCents + quote.freeDeliveryShortfallCents}>
          <Bike className="mr-1 inline size-3.5 text-brand" aria-hidden />
          Ancora {formatEuro(quote.freeDeliveryShortfallCents)} per la consegna gratuita
        </Progress>
      ) : null}
      <PromoNudge subtotal={t.subtotalCents} applied={!!quote.coupon} />
      <dl className="space-y-1.5">
        <Row label="Subtotale" value={formatEuro(t.subtotalCents)} />
        {t.discountCents > 0 ? (
          <Row label={quote.coupon?.name ?? "Sconto"} value={`−${formatEuro(t.discountCents)}`} accent />
        ) : null}
        {fulfillment === "DELIVERY" ? (
          <Row
            label="Consegna"
            value={
              needsAddress
                ? "Al checkout"
                : t.deliveryFeeCents === 0
                  ? "Gratis"
                  : formatEuro(t.deliveryFeeCents)
            }
            muted={needsAddress}
          />
        ) : (
          <Row label="Ritiro al locale" value="Gratis" />
        )}
        {t.serviceFeeCents > 0 ? <Row label="Servizio" value={formatEuro(t.serviceFeeCents)} /> : null}
        {t.tipCents > 0 ? <Row label="Mancia al rider" value={formatEuro(t.tipCents)} /> : null}
        <div className="border-t border-line pt-2.5">
          <Row label="Totale" value={formatEuro(t.totalCents)} strong />
          <p className="mt-0.5 text-micro text-fg-subtle">IVA inclusa ({formatEuro(t.taxCents)})</p>
        </div>
      </dl>
    </div>
  );
}
