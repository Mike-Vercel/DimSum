"use client";

import { signatureOf } from "@dimsum/domain";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { cartToInput, useCart, type CartLine } from "@/lib/stores/cart";
import { useHydrated } from "@/lib/stores/hydration";
import { cartLineFor } from "@/lib/use-add-to-cart";
import { useStorefront } from "./product-sheet/context";

/**
 * Keeps the cart on the account: at sign-in the account cart is merged into the device cart
 * (nothing is lost on either side), then every change is mirrored back so the same cart is
 * waiting on the customer's other devices.
 */
export function AccountCartSync() {
  const { data: session } = useSession();
  const hydrated = useHydrated();
  const { catalog } = useStorefront();
  const userId = session?.user.id ?? null;
  const mergedFor = useRef<string | null>(null);
  const ready = useRef(false);
  // Read at merge time: live menu updates must not restart (and cancel) an in-flight merge.
  const catalogRef = useRef(catalog);
  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);

  useEffect(() => {
    if (!userId) {
      mergedFor.current = null;
      ready.current = false;
      return;
    }
    if (!hydrated || mergedFor.current === userId) return;
    mergedFor.current = userId;
    ready.current = false;
    let cancelled = false;
    api.cart
      .getAccountCart()
      .then((remote) => {
        if (cancelled) return;
        const state = useCart.getState();
        const local = new Set(state.lines.map(signatureOf));
        const now = Date.now();
        const incoming: CartLine[] = remote.lines.flatMap((line) => {
          const product = catalogRef.current.products[line.productId];
          if (!product || local.has(signatureOf(line))) return [];
          const built = cartLineFor(product, {
            quantity: line.quantity,
            variantId: line.variantId,
            modifiers: line.modifiers,
            notes: line.notes,
          });
          return [{ ...built, lineId: line.lineId, addedAt: now }];
        });
        if (incoming.length || (!state.couponCode && remote.couponCode)) {
          state.replaceLines([...state.lines, ...incoming], state.couponCode ?? remote.couponCode);
        }
      })
      .catch(() => {
        /* offline or signed out meanwhile: the device cart stays as it is */
      })
      .finally(() => {
        if (cancelled) return;
        ready.current = true;
        const s = useCart.getState();
        void api.cart
          .saveAccountCart({ lines: cartToInput(s.lines), couponCode: s.couponCode })
          .catch(() => undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, userId]);

  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useCart.subscribe((state, previous) => {
      if (!ready.current || state.updatedAt === previous.updatedAt) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const s = useCart.getState();
        void api.cart
          .saveAccountCart({ lines: cartToInput(s.lines), couponCode: s.couponCode })
          .catch(() => undefined);
      }, 800);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [userId]);

  return null;
}
