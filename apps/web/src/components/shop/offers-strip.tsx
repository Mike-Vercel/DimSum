"use client";

import { formatEuro } from "@dimsum/domain";
import type { CouponPublicDTO } from "@dimsum/types";
import { BadgePercent, Bike, Copy, TicketPercent } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { useNow } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { useCart } from "@/lib/stores/cart";

/** Live promotions configured in the admin (e.g. the restaurant's "20% sopra 30 €"). */
export function OffersStrip({ offers, className }: { offers: CouponPublicDTO[]; className?: string }) {
  const now = useNow();
  const setCoupon = useCart((s) => s.setCoupon);
  const active = offers.filter((o) => !o.validUntil || new Date(o.validUntil) > now);
  if (active.length === 0) return null;
  // One offer: a full-width banner on phones, centered on wider screens. Several: a row to swipe,
  // each card snapping inside the margins.
  const single = active.length === 1;
  return (
    <section
      aria-label="Offerte"
      className={cn(
        single
          ? "md:mx-auto md:max-w-xl"
          : "-mx-4 scrollbar-none flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-2 md:px-0",
        className,
      )}
    >
      {active.map((o) => {
        const Icon = o.type === "FREE_DELIVERY" ? Bike : o.automatic ? BadgePercent : TicketPercent;
        return (
          <article
            key={o.id}
            className={cn(
              "relative flex items-center gap-4 overflow-hidden rounded-2xl bg-brand p-4 text-white shadow-cta",
              single ? "w-full" : "w-[calc(100vw-3rem)] max-w-md shrink-0 snap-start md:w-auto md:max-w-none",
            )}
          >
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/15 text-body font-extrabold tracking-tight">
              {o.type === "PERCENTAGE" ? o.valueLabel : <Icon className="size-6" />}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="leading-snug font-bold">{o.name}</h3>
              <p className="text-caption text-white/80">
                {o.automatic
                  ? `Applicato in automatico${o.minSubtotalCents ? ` sopra ${formatEuro(o.minSubtotalCents, { compact: true })}` : ""}`
                  : (o.description ?? "Usa il codice al checkout")}
              </p>
            </div>
            {o.code ? (
              <button
                type="button"
                onClick={() => {
                  setCoupon(o.code);
                  void navigator.clipboard?.writeText(o.code!).catch(() => {});
                  toast.success(`Codice ${o.code} pronto`, {
                    description: "Lo applichiamo al tuo carrello.",
                  });
                }}
                className="relative z-10 inline-flex h-9 shrink-0 tap items-center gap-1.5 rounded-full bg-white px-3 text-caption font-bold whitespace-nowrap text-brand-ink"
              >
                <Copy className="size-3.5" /> {o.code}
              </button>
            ) : null}
            <span
              aria-hidden
              className="pointer-events-none absolute -right-6 -bottom-8 size-28 rounded-full bg-white/10"
            />
          </article>
        );
      })}
    </section>
  );
}
