"use client";

import type {
  DeliveryDetailsFields,
  DeliveryQuoteDTO,
  FulfillmentType,
  GeocodedAddressDTO,
} from "@dimsum/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type DeliveryAddress = GeocodedAddressDTO & DeliveryDetailsFields & { savedAddressId: string | null };

export interface Schedule {
  mode: "asap" | "scheduled";
  /** ISO start of the chosen slot when scheduled. */
  slotStart: string | null;
  slotLabel: string | null;
}

interface OrderPrefsState {
  fulfillment: FulfillmentType;
  address: DeliveryAddress | null;
  deliveryQuote: DeliveryQuoteDTO | null;
  schedule: Schedule;
  setFulfillment(f: FulfillmentType): void;
  setAddress(address: DeliveryAddress | null, quote?: DeliveryQuoteDTO | null): void;
  setDeliveryQuote(quote: DeliveryQuoteDTO | null): void;
  updateDetails(details: Partial<DeliveryDetailsFields>): void;
  setSchedule(schedule: Schedule): void;
}

export const useOrderPrefs = create<OrderPrefsState>()(
  persist(
    (set, get) => ({
      fulfillment: "DELIVERY",
      address: null,
      deliveryQuote: null,
      schedule: { mode: "asap", slotStart: null, slotLabel: null },
      setFulfillment: (fulfillment) =>
        set({ fulfillment, schedule: { mode: "asap", slotStart: null, slotLabel: null } }),
      setAddress: (address, quote = null) => set({ address, deliveryQuote: quote }),
      setDeliveryQuote: (deliveryQuote) => set({ deliveryQuote }),
      updateDetails: (details) => {
        const a = get().address;
        if (a) set({ address: { ...a, ...details } });
      },
      setSchedule: (schedule) => set({ schedule }),
    }),
    {
      name: "dimsum.order-prefs",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        fulfillment: s.fulfillment,
        address: s.address,
        deliveryQuote: s.deliveryQuote,
        schedule: s.schedule,
      }),
    },
  ),
);
