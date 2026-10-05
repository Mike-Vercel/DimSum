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
import { cn } from "@/lib/cn";
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
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center",
        offer.personal ? "bg-ink-950 text-white" : "bg-brand text-white shadow-cta",
      )}
    >
      <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white/15 text-title font-extrabold tracking-tight">
        {offer.type === "PERCENTAGE" ? offer.valueLabel : <Icon className="size-7" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-caption font-semibold tracking-wide text-white/70 uppercase">
          {offer.personal ? "Solo per te" : offer.automatic ? "Automatica" : "Con codice"}
        </p>
        <h2 className="text-title font-bold">{offer.name}</h2>
        {offer.description ? <p className="mt-0.5 text-body-sm text-white/85">{offer.description}</p> : null}
        {conditions.length ? (
          <p className="mt-1 text-caption text-white/70">{conditions.join(" · ")}</p>
        ) : null}
      </div>
      {offer.code ? (
        <Button
          variant="white"
          onClick={() => {
            setCoupon(offer.code);
            void navigator.clipboard?.writeText(offer.code!).catch(() => undefined);
            toast.success(`Codice ${offer.code} applicato al carrello`);
          }}
        >
          <Copy className="size-4" /> {offer.code}
        </Button>
      ) : (
        <p className="text-body-sm font-semibold text-white/90">Si applica da sola nel carrello</p>
      )}
    </article>
  );
}

/** "Offerte": public promotions plus, for signed-in customers, their personal coupons. */
export function OffersList({ offers }: { offers: CouponPublicDTO[] }) {
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
    <div className="grid gap-4 lg:grid-cols-2">
      {all.map((o) => (
        <OfferCard key={o.id} offer={o} timeZone={timezone} />
      ))}
    </div>
  );
}
