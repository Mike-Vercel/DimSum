"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useCart } from "./cart";
import { useCheckoutDraft } from "./checkout";
import { useOrderPrefs } from "./order-prefs";

/**
 * Persisted stores hydrate after the first client render (skipHydration) so server HTML and
 * the first client render match. Components read `useHydrated()` before showing device data.
 */
let hydrated = false;
const listeners = new Set<() => void>();

export function rehydrateStores() {
  if (hydrated) return;
  void Promise.all([
    useCart.persist.rehydrate(),
    useOrderPrefs.persist.rehydrate(),
    useCheckoutDraft.persist.rehydrate(),
  ]).then(() => {
    hydrated = true;
    listeners.forEach((l) => l());
  });
}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => hydrated,
    () => false,
  );
}

/** Keeps several tabs in sync: a cart change in one tab shows up in the others. */
export function useCrossTabSync() {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "dimsum.cart") void useCart.persist.rehydrate();
      if (e.key === "dimsum.order-prefs") void useOrderPrefs.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}
