"use client";

import { ChevronDown, MapPin, Store } from "lucide-react";
import { useState } from "react";
import { AddressSheet } from "@/components/address/address-sheet";
import { cn } from "@/lib/cn";
import { useHydrated } from "@/lib/stores/hydration";
import { useOrderPrefs } from "@/lib/stores/order-prefs";
import { useRestaurant } from "./restaurant-context";

/** "Consegna a [indirizzo ▾]" — opens the address picker. Shows the store for pickup orders. */
export function LocationButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  const hydrated = useHydrated();
  const fulfillment = useOrderPrefs((s) => s.fulfillment);
  const address = useOrderPrefs((s) => s.address);
  const restaurant = useRestaurant();
  const [open, setOpen] = useState(false);
  const pickup = hydrated && fulfillment === "PICKUP";
  const label = pickup ? "Ritiro da" : "Consegna a";
  const value = pickup
    ? `${restaurant.name} · ${restaurant.address.street} ${restaurant.address.streetNumber}`
    : hydrated && address
      ? `${address.street} ${address.streetNumber}`
      : "Inserisci indirizzo";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex min-w-0 tap items-center gap-2 text-left",
          compact && "rounded-full bg-surface px-3.5 py-2 ring-1 ring-line",
          className,
        )}
        aria-label={`${label} ${value}. Cambia`}
      >
        {pickup ? (
          <Store className="size-4.5 shrink-0 text-brand" aria-hidden />
        ) : (
          <MapPin className="size-4.5 shrink-0 text-brand" aria-hidden />
        )}
        <span className="min-w-0">
          {!compact ? <span className="block text-micro font-medium text-fg-muted">{label}</span> : null}
          <span className="flex items-center gap-1 font-bold">
            <span className="truncate">{value}</span>
            <ChevronDown
              className="size-4 shrink-0 transition-transform group-hover:translate-y-0.5"
              aria-hidden
            />
          </span>
        </span>
      </button>
      <AddressSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
