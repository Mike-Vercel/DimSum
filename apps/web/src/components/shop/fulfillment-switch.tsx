"use client";

import type { FulfillmentType } from "@dimsum/types";
import { Bike, Store } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { useHydrated } from "@/lib/stores/hydration";
import { useOrderPrefs } from "@/lib/stores/order-prefs";

export function FulfillmentSwitch({ className }: { className?: string }) {
  const hydrated = useHydrated();
  const fulfillment = useOrderPrefs((s) => s.fulfillment);
  const setFulfillment = useOrderPrefs((s) => s.setFulfillment);
  return (
    <Segmented<FulfillmentType>
      ariaLabel="Modalità dell'ordine"
      className={className}
      value={hydrated ? fulfillment : "DELIVERY"}
      onChange={setFulfillment}
      options={[
        {
          value: "DELIVERY",
          label: (
            <>
              <Bike className="size-4" aria-hidden /> Consegna
            </>
          ),
        },
        {
          value: "PICKUP",
          label: (
            <>
              <Store className="size-4" aria-hidden /> Ritiro
            </>
          ),
        },
      ]}
    />
  );
}
