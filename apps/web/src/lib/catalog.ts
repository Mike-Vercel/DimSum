"use client";

import { isAvailableNow } from "@dimsum/domain";
import type { CatalogDTO, ProductDTO } from "@dimsum/types";
import { useCallback, useState, useSyncExternalStore } from "react";
import { api } from "./api";
import { useRealtime } from "./realtime";

/**
 * Live catalog: starts from the server-rendered snapshot (no client fetch on load), then follows
 * availability changes pushed by the kitchen ("Esaurito") and reloads only when the menu changes.
 */
export function useCatalog(initial: CatalogDTO): CatalogDTO {
  const [catalog, setCatalog] = useState(initial);

  const reload = useCallback(() => {
    api.catalog
      .get()
      .then(setCatalog)
      .catch(() => {
        /* keep the current menu; the next event or reconnect retries */
      });
  }, []);

  useRealtime(
    ["catalog"],
    (event) => {
      if (event.type === "catalog.availability") {
        setCatalog((current) => {
          const products = { ...current.products };
          for (const patch of event.patches) {
            const p = products[patch.productId];
            if (p)
              products[patch.productId] = {
                ...p,
                isAvailable: patch.isAvailable,
                availableAgainAt: patch.availableAgainAt,
              };
          }
          return { ...current, products };
        });
      } else if (event.type === "catalog.changed") {
        reload();
      }
    },
    { onReconnect: reload },
  );

  return catalog;
}

const MINUTE = 60_000;
let clock = 0;
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;

function subscribeClock(cb: () => void) {
  clockListeners.add(cb);
  if (!clockTimer) {
    clock = Math.floor(Date.now() / MINUTE) * MINUTE;
    clockTimer = setInterval(() => {
      clock = Math.floor(Date.now() / MINUTE) * MINUTE;
      clockListeners.forEach((l) => l());
    }, 15_000);
  }
  return () => {
    clockListeners.delete(cb);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

/**
 * Current time (minute precision) for timed availability ("disponibile da domani"). The server
 * render never reads the clock — prerendered HTML stays deterministic — and the client takes over
 * after hydration.
 */
export function useNow(): Date {
  const t = useSyncExternalStore(
    subscribeClock,
    () => clock || Math.floor(Date.now() / MINUTE) * MINUTE,
    () => 0,
  );
  return new Date(t);
}

export function productAvailable(product: ProductDTO, now: Date): boolean {
  return isAvailableNow(product, now);
}

/** Products that require choosing options must open the detail sheet instead of a quick add. */
export function needsConfiguration(product: ProductDTO): boolean {
  return product.variants.length > 0 || product.modifierGroups.some((g) => g.minSelect > 0);
}
