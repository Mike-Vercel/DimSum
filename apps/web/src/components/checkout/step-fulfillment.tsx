"use client";

import { formatEuro } from "@dimsum/domain";
import type { CartQuoteDTO, ServiceStatusDTO } from "@dimsum/types";
import { CalendarClock, Clock, MapPin, Pencil, Store } from "lucide-react";
import { useState } from "react";
import { AddressPicker } from "@/components/address/address-picker";
import { DeliveryCheck } from "@/components/address/delivery-check";
import { FulfillmentSwitch } from "@/components/shop/fulfillment-switch";
import { useRestaurant } from "@/components/shop/restaurant-context";
import { Button } from "@/components/ui/button";
import { RadioCard, RadioCardGroup } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { BottomSheet } from "@/components/ui/sheet";
import { useOrderPrefs } from "@/lib/stores/order-prefs";
import { useIsDesktop } from "@/lib/use-media-query";
import { SchedulePicker } from "./schedule-picker";

export function StepFulfillment({
  quote,
  quoting,
  status,
  onContinue,
}: {
  quote: CartQuoteDTO | undefined;
  quoting: boolean;
  status: ServiceStatusDTO | undefined;
  onContinue: () => void;
}) {
  const restaurant = useRestaurant();
  const desktop = useIsDesktop();
  const fulfillment = useOrderPrefs((s) => s.fulfillment);
  const address = useOrderPrefs((s) => s.address);
  const schedule = useOrderPrefs((s) => s.schedule);
  const setAddress = useOrderPrefs((s) => s.setAddress);
  const setSchedule = useOrderPrefs((s) => s.setSchedule);
  const setFulfillment = useOrderPrefs((s) => s.setFulfillment);
  const [editing, setEditing] = useState(false);

  const availability = fulfillment === "DELIVERY" ? status?.delivery : status?.pickup;
  const asapAvailable = !!availability?.available && !!status?.acceptingOrders;
  const asapLabel = availability?.etaMinMinutes
    ? `${availability.etaMinMinutes}–${availability.etaMaxMinutes} minuti`
    : "Appena possibile";
  const effectiveMode = asapAvailable ? schedule.mode : "scheduled";

  const delivery = quote?.delivery;
  const deliveryOk = fulfillment === "PICKUP" || (!!address && !!delivery?.deliverable);
  const scheduleOk = effectiveMode === "asap" ? asapAvailable : !!schedule.slotStart;
  const minimumOk = !quote?.blockers.includes("BELOW_MINIMUM");

  const picker = (embedded: boolean) => (
    <AddressPicker
      embedded={embedded}
      initial={address}
      onConfirm={(a, q) => {
        setAddress(a, q);
        setEditing(false);
      }}
      onSwitchToPickup={() => {
        setFulfillment("PICKUP");
        setEditing(false);
      }}
      confirmLabel="Usa questo indirizzo"
    />
  );

  return (
    <div className="space-y-7">
      <FulfillmentSwitch />

      {fulfillment === "DELIVERY" ? (
        <section aria-labelledby="indirizzo" className="space-y-3">
          <h2 id="indirizzo" className="text-title-sm font-bold">
            Indirizzo di consegna
          </h2>
          {address ? (
            <>
              <div className="flex items-start gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
                <MapPin className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {address.street} {address.streetNumber}
                  </p>
                  <p className="text-body-sm text-fg-muted">
                    {[address.postalCode, address.city].filter(Boolean).join(" ")}
                    {[
                      address.staircase && `scala ${address.staircase}`,
                      address.floor && `piano ${address.floor}`,
                      address.apartment && `int. ${address.apartment}`,
                    ]
                      .filter(Boolean)
                      .map((x) => ` · ${x}`)
                      .join("")}
                  </p>
                  {address.intercom ? (
                    <p className="text-caption text-fg-muted">Citofono: {address.intercom}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 text-body-sm font-semibold text-brand-ink"
                >
                  <Pencil className="size-3.5" /> Modifica
                </button>
              </div>
              <DeliveryCheck
                quote={delivery ?? null}
                loading={quoting && !delivery}
                onChangeAddress={() => setEditing(true)}
                onSwitchToPickup={() => setFulfillment("PICKUP")}
              />
            </>
          ) : (
            picker(true)
          )}
        </section>
      ) : (
        <section aria-labelledby="ritiro" className="space-y-3">
          <h2 id="ritiro" className="text-title-sm font-bold">
            Ritiro al locale
          </h2>
          <div className="flex items-start gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
            <Store className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
            <div>
              <p className="font-semibold">{restaurant.name}</p>
              <p className="text-body-sm text-fg-muted">{restaurant.address.formatted}</p>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="quando" className="space-y-3">
        <h2 id="quando" className="text-title-sm font-bold">
          Quando vuoi {fulfillment === "DELIVERY" ? "ricevere" : "ritirare"} l&apos;ordine?
        </h2>
        <RadioCardGroup
          value={effectiveMode}
          onValueChange={(v) =>
            setSchedule(
              v === "asap"
                ? { mode: "asap", slotStart: null, slotLabel: null }
                : { ...schedule, mode: "scheduled" },
            )
          }
          className="grid gap-2.5"
        >
          <RadioCard
            value="asap"
            disabled={!asapAvailable}
            icon={<Clock className="size-4.5" />}
            title="Il prima possibile"
            description={asapAvailable ? asapLabel : "Non disponibile in questo momento"}
          />
          {status?.schedulingEnabled ? (
            <RadioCard
              value="scheduled"
              icon={<CalendarClock className="size-4.5" />}
              title="Programma"
              description={schedule.slotLabel ?? "Scegli giorno e ora"}
            />
          ) : null}
        </RadioCardGroup>
        {effectiveMode === "scheduled" && status?.schedulingEnabled ? (
          <SchedulePicker fulfillment={fulfillment} value={schedule} onChange={setSchedule} />
        ) : null}
      </section>

      {quote && !minimumOk ? (
        <p className="rounded-xl bg-warning-soft p-3 text-body-sm text-warning" role="alert">
          Minimo d&apos;ordine per questa zona: {formatEuro(quote.minimumOrderCents)}. Aggiungi ancora{" "}
          {formatEuro(quote.minimumOrderShortfallCents)}.
        </p>
      ) : null}

      <Button
        size="xl"
        block
        disabled={!deliveryOk || !scheduleOk || !minimumOk || quoting}
        onClick={onContinue}
        className="h-14"
      >
        Continua
      </Button>

      {desktop ? (
        <Dialog open={editing} onOpenChange={setEditing} title="Indirizzo di consegna">
          <div className="pt-2">{picker(false)}</div>
        </Dialog>
      ) : (
        <BottomSheet open={editing} onOpenChange={setEditing} title="Indirizzo di consegna" keepFieldCentered>
          <div className="pt-3">{picker(false)}</div>
        </BottomSheet>
      )}
    </div>
  );
}
