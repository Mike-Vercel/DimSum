"use client";

import { describeRefusal, formatEuro } from "@dimsum/domain";
import type { DeliveryQuoteDTO } from "@dimsum/types";
import { Bike, CircleCheck, MapPinOff, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";

/** Result of the zone check shown under the map. */
export function DeliveryCheck({
  quote,
  loading,
  onChangeAddress,
  onSwitchToPickup,
}: {
  quote: DeliveryQuoteDTO | null;
  loading: boolean;
  onChangeAddress: () => void;
  onSwitchToPickup?: (() => void) | undefined;
}) {
  if (loading) return <Skeleton className="h-[74px] rounded-2xl" />;
  if (!quote) return null;
  if (quote.deliverable && quote.zone) {
    const z = quote.zone;
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-success-soft p-4" role="status">
        <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <div className="text-body-sm">
          <p className="font-semibold text-success">Consegniamo qui</p>
          <p className="mt-0.5 text-fg/80">
            Consegna {z.deliveryFeeCents === 0 ? "gratuita" : formatEuro(z.deliveryFeeCents)}
            {z.minimumOrderCents > 0 ? ` · minimo d'ordine ${formatEuro(z.minimumOrderCents)}` : ""}
            {z.freeDeliveryThresholdCents
              ? ` · gratis sopra ${formatEuro(z.freeDeliveryThresholdCents)}`
              : ""}
          </p>
          {quote.etaMinMinutes ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-fg/80">
              <Bike className="size-3.5" aria-hidden /> Arrivo stimato in {quote.etaMinMinutes}–
              {quote.etaMaxMinutes} min
            </p>
          ) : null}
        </div>
      </div>
    );
  }
  const imprecise = quote.reason === "ADDRESS_IMPRECISE";
  return (
    <div className="rounded-2xl bg-danger-soft p-4" role="alert">
      <div className="flex items-start gap-3">
        <MapPinOff className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
        <p className="text-body-sm font-semibold text-danger">
          {quote.reason ? describeRefusal(quote.reason) : "Indirizzo non servito."}
        </p>
      </div>
      {!imprecise && onSwitchToPickup ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={onChangeAddress}>
            Cambia indirizzo
          </Button>
          <Button variant="dark" size="sm" onClick={onSwitchToPickup}>
            <Store className="size-4" /> Ordina con ritiro
          </Button>
        </div>
      ) : null}
    </div>
  );
}
