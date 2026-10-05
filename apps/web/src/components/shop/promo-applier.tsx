"use client";

import type { CouponPublicDTO } from "@dimsum/types";
import { TicketPercent } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/stores/cart";
import { useHydrated } from "@/lib/stores/hydration";

/** Shared promo link: the code goes straight into the cart, ready at checkout. */
export function PromoApplier({ promo }: { promo: CouponPublicDTO }) {
  const hydrated = useHydrated();
  const setCoupon = useCart((s) => s.setCoupon);
  useEffect(() => {
    if (hydrated && promo.code) setCoupon(promo.code);
  }, [hydrated, promo.code, setCoupon]);
  return (
    <div className="mx-auto max-w-lg rounded-3xl bg-brand p-8 text-center text-white shadow-cta">
      <TicketPercent className="mx-auto size-10" />
      <p className="mt-4 text-display font-extrabold">{promo.valueLabel}</p>
      <h1 className="text-title-lg mt-1 font-bold">{promo.name}</h1>
      {promo.description ? <p className="mt-2 text-body text-white/85">{promo.description}</p> : null}
      <p className="mt-4 text-body-sm text-white/80">
        Codice <strong>{promo.code}</strong> aggiunto al carrello: lo trovi applicato al checkout.
      </p>
      <Button asChild variant="white" size="lg" className="mt-6">
        <Link href="/menu">Scegli dal menu</Link>
      </Button>
    </div>
  );
}
