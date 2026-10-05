"use client";

import type { CartQuoteDTO } from "@dimsum/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { cartToInput, useCart } from "./stores/cart";
import { useCheckoutDraft } from "./stores/checkout";
import { useHydrated } from "./stores/hydration";
import { useOrderPrefs } from "./stores/order-prefs";

function useDebouncedValue<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Server quote of the current cart + order preferences. Debounced so fast quantity taps produce a
 * single request; the previous quote stays on screen while the next one loads.
 */
export function useCartQuote(options: { includeTip?: boolean } = {}) {
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);
  const couponCode = useCart((s) => s.couponCode);
  const syncFromQuote = useCart((s) => s.syncFromQuote);
  const fulfillment = useOrderPrefs((s) => s.fulfillment);
  const address = useOrderPrefs((s) => s.address);
  const schedule = useOrderPrefs((s) => s.schedule);
  const tipCents = useCheckoutDraft((s) => s.tipCents);

  const request = useMemo(
    () => ({
      lines: cartToInput(lines).map((l, i) => ({
        ...l,
        expectedUnitPriceCents: lines[i]!.snapshot.unitPriceCents,
      })),
      fulfillmentType: fulfillment,
      delivery:
        fulfillment === "DELIVERY" && address
          ? {
              location: address.location,
              precision: address.streetNumber ? ("rooftop" as const) : address.precision,
            }
          : null,
      couponCode,
      tipCents: options.includeTip && fulfillment === "DELIVERY" ? tipCents : 0,
      scheduledFor: schedule.mode === "scheduled" ? schedule.slotStart : null,
    }),
    [lines, fulfillment, address, couponCode, tipCents, schedule, options.includeTip],
  );
  const debounced = useDebouncedValue(request, 220);

  const query = useQuery<CartQuoteDTO>({
    queryKey: ["cart-quote", debounced],
    queryFn: ({ signal }) => api.cart.quote(debounced, signal),
    enabled: hydrated && debounced.lines.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (query.data) syncFromQuote(query.data);
  }, [query.data, syncFromQuote]);

  const settling = request !== debounced || query.isFetching;
  return { ...query, settling, request };
}
