"use client";

import { Bike, Clock, MapPin, Store } from "lucide-react";
import { useRestaurant } from "@/components/shop/restaurant-context";
import { summarizeHours } from "@/lib/hours";
import { Button } from "@/components/ui/button";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { toast } from "@/components/ui/toaster";
import { useOrderPrefs } from "@/lib/stores/order-prefs";
import { AddressPicker } from "./address-picker";

function PickupInfo({ onDelivery }: { onDelivery: () => void }) {
  const r = useRestaurant();
  const hours = summarizeHours(r.pickupHours);
  return (
    <div className="space-y-4 px-5 pb-6">
      <div className="flex items-start gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
        <span className="grid size-10 place-items-center rounded-full bg-ink-900 text-white">
          <Store className="size-5" />
        </span>
        <div>
          <p className="font-bold">{r.name}</p>
          <p className="text-body-sm text-fg-muted">{r.address.formatted}</p>
        </div>
      </div>
      <div className="flex items-start gap-3 px-1">
        <Clock className="mt-0.5 size-4.5 text-fg-subtle" aria-hidden />
        <dl className="text-body-sm">
          {hours.map((h) => (
            <div key={h.days} className="flex gap-3">
              <dt className="text-fg-muted">{h.days}</dt>
              <dd className="tabular-nums">{h.ranges}</dd>
            </div>
          ))}
        </dl>
      </div>
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${r.location.lat},${r.location.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-1 text-body-sm font-semibold text-brand-ink"
      >
        <MapPin className="size-4" aria-hidden /> Indicazioni per arrivare
      </a>
      <Button variant="secondary" block onClick={onDelivery}>
        <Bike className="size-4" /> Preferisco la consegna a domicilio
      </Button>
    </div>
  );
}

/** Address picker in a sheet (phones) or dialog (desktop), bound to the order preferences. */
export function AddressSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fulfillment = useOrderPrefs((s) => s.fulfillment);
  const address = useOrderPrefs((s) => s.address);
  const setAddress = useOrderPrefs((s) => s.setAddress);
  const setFulfillment = useOrderPrefs((s) => s.setFulfillment);

  const title = fulfillment === "PICKUP" ? "Ritiro al locale" : "Indirizzo di consegna";
  const body =
    fulfillment === "PICKUP" ? (
      <PickupInfo onDelivery={() => setFulfillment("DELIVERY")} />
    ) : (
      <AddressPicker
        initial={address}
        onConfirm={(a, quote) => {
          setAddress(a, quote);
          onOpenChange(false);
          toast.success("Indirizzo salvato", { description: `${a.street} ${a.streetNumber}` });
        }}
        onSwitchToPickup={() => {
          setFulfillment("PICKUP");
          toast("Ritiro al locale selezionato");
        }}
      />
    );

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      keepFieldCentered={fulfillment !== "PICKUP"}
    >
      {body}
    </ResponsiveSheet>
  );
}
