"use client";

import { formatEuro } from "@dimsum/domain";
import type { CouponPublicDTO } from "@dimsum/types";
import { useQuery } from "@tanstack/react-query";
import { BadgePercent, Bike, Copy, Gift, TicketPercent } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toaster";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { useNow } from "@/lib/catalog";
import { formatLongDate } from "@/lib/dates";
import { useCart } from "@/lib/stores/cart";
import { useRestaurant } from "./restaurant-context";

function OfferCard({ offer, timeZone }: { offer: CouponPublicDTO; timeZone: string }) {
  const setCoupon = useCart((s) => s.setCoupon);
  const Icon = offer.personal
    ? Gift
    : offer.type === "FREE_DELIVERY"
      ? Bike
      : offer.automatic
        ? BadgePercent
        : TicketPercent;
  const conditions = [
    offer.minSubtotalCents ? `Spesa minima ${formatEuro(offer.minSubtotalCents)}` : null,
    offer.validUntil ? `Valida fino al ${formatLongDate(offer.validUntil, timeZone)}` : null,
  ].filter(Boolean);
  // A coupon, shaped like one: the value big on the left, a perforated edge, the details on the right.
  const tone = offer.personal
    ? { bg: "#16130f", stub: "#2a241d", ink: "#ffd23f" }
    : offer.type === "FREE_DELIVERY"
      ? { bg: "#1f7a4d", stub: "#185f3c", ink: "#ffffff" }
      : { bg: "#d4282e", stub: "#a91d22", ink: "#ffffff" };
  return (
    <article
      className="group relative flex overflow-hidden rounded-[24px] text-white shadow-[0_18px_40px_-24px_rgba(120,30,10,.6)] transition-transform duration-300 hover:-translate-y-0.5"
      style={{ background: tone.bg }}
    >
      <div
        className="relative flex w-[34%] max-w-36 shrink-0 flex-col items-center justify-center gap-1 px-3 py-5 text-center"
        style={{ background: tone.stub }}
      >
        {offer.type === "FREE_DELIVERY" ? (
          <Icon className="size-9" style={{ color: tone.ink }} />
        ) : (
          <span className="text-[30px] leading-none font-black tracking-tight tabular-nums" style={{ color: tone.ink }}>
            {offer.valueLabel}
          </span>
        )}
        <span className="text-[10px] font-extrabold tracking-[0.16em] uppercase opacity-80">
          {offer.type === "FREE_DELIVERY" ? "Consegna gratis" : offer.personal ? "Solo per te" : "Sconto"}
        </span>
        {/* Perforation with the two notches of a real coupon. */}
        <span aria-hidden className="absolute top-3 bottom-3 -right-px w-0 border-r-2 border-dashed border-white/35" />
        <span aria-hidden className="absolute -top-3 -right-3 size-6 rounded-full bg-canvas" />
        <span aria-hidden className="absolute -right-3 -bottom-3 size-6 rounded-full bg-canvas" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 pl-5">
        <p className="text-caption font-bold tracking-wide text-white/70 uppercase">
          {offer.personal ? "Il tuo coupon" : offer.automatic ? "Si applica da sola" : "Con codice"}
        </p>
        <h3 className="text-title font-extrabold leading-tight">{offer.name}</h3>
        {offer.description ? <p className="text-body-sm text-white/85">{offer.description}</p> : null}
        {conditions.length ? <p className="text-caption text-white/65">{conditions.join(" · ")}</p> : null}
        <div className="mt-auto pt-1">
          {offer.code ? (
            <Button
              variant="white"
              size="sm"
              onClick={() => {
                setCoupon(offer.code);
                void navigator.clipboard?.writeText(offer.code!).catch(() => undefined);
                toast.success(`Codice ${offer.code} applicato al carrello`);
              }}
            >
              <Copy className="size-4" /> {offer.code}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-caption font-bold">
              <BadgePercent className="size-3.5" /> Già attiva nel carrello
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/** "Offerte": public promotions plus, for signed-in customers, their personal coupons. */
export function OffersList({ offers, hasCombos = false }: { offers: CouponPublicDTO[]; hasCombos?: boolean }) {
  const now = useNow();
  const { timezone } = useRestaurant();
  const { data: session } = useSession();
  const personal = useQuery({
    queryKey: ["me", "coupons"],
    queryFn: () => api.me.coupons(),
    enabled: !!session,
    select: (d) => d.coupons.filter((c) => c.personal),
  });
  const all = [...(personal.data ?? []), ...offers].filter(
    (o) => !o.validUntil || new Date(o.validUntil) > now,
  );

  if (all.length === 0) {
    // With combos on the page, no empty state for the coupons part.
    if (hasCombos) return null;
    return (
      <EmptyState
        icon={TicketPercent}
        title="Nessuna offerta attiva al momento"
        description="Torna a trovarci: le nuove promozioni compaiono qui e si applicano da sole nel carrello."
        action={
          <Button asChild>
            <Link href="/menu">Vai al menu</Link>
          </Button>
        }
      />
    );
  }
  return (
    <section aria-labelledby="coupon-title" className="space-y-5">
      <div>
        <p className="text-caption font-bold tracking-[0.18em] text-brand uppercase">Sconti e codici</p>
        <h2 id="coupon-title" className="text-headline font-extrabold">
          Le offerte
        </h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {all.map((o) => (
          <OfferCard key={o.id} offer={o} timeZone={timezone} />
        ))}
      </div>
    </section>
  );
}
