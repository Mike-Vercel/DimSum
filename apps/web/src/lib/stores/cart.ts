"use client";

import { MAX_CART_LINES, MAX_LINE_QUANTITY, signatureOf } from "@dimsum/domain";
import type { CartLineInput, CartQuoteDTO, ImageBackdrop } from "@dimsum/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Display snapshot taken when adding; the server quote always has the final word on prices. */
export interface CartLineSnapshot {
  slug: string;
  name: string;
  unitPriceCents: number;
  imageUrl: string | null;
  imageBlur: string | null;
  backdrop: ImageBackdrop;
  details: string[];
}

export interface CartLine extends CartLineInput {
  snapshot: CartLineSnapshot;
  addedAt: number;
}

export interface CartState {
  lines: CartLine[];
  couponCode: string | null;
  updatedAt: number;
  /** Increments on every add: drives the cart button bounce. */
  pulse: number;
  add(line: Omit<CartLine, "lineId" | "addedAt"> & { lineId?: string }): void;
  setQuantity(lineId: string, quantity: number): void;
  remove(lineId: string): CartLine | undefined;
  restore(line: CartLine): void;
  setNotes(lineId: string, notes: string | null): void;
  setCoupon(code: string | null): void;
  replaceLines(lines: CartLine[], couponCode?: string | null): void;
  syncFromQuote(quote: CartQuoteDTO): void;
  clear(): void;
}

const now = () => Date.now();

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      couponCode: null,
      updatedAt: 0,
      pulse: 0,
      add(input) {
        const lines = get().lines;
        const sig = signatureOf(input);
        const existing = lines.find((l) => signatureOf(l) === sig);
        if (existing) {
          set({
            lines: lines.map((l) =>
              l === existing
                ? {
                    ...l,
                    quantity: Math.min(MAX_LINE_QUANTITY, l.quantity + input.quantity),
                    snapshot: input.snapshot,
                  }
                : l,
            ),
            updatedAt: now(),
            pulse: get().pulse + 1,
          });
          return;
        }
        if (lines.length >= MAX_CART_LINES) return;
        const line: CartLine = {
          ...input,
          lineId: input.lineId ?? crypto.randomUUID(),
          quantity: Math.min(MAX_LINE_QUANTITY, input.quantity),
          addedAt: now(),
        };
        set({ lines: [...lines, line], updatedAt: now(), pulse: get().pulse + 1 });
      },
      setQuantity(lineId, quantity) {
        if (quantity <= 0) {
          get().remove(lineId);
          return;
        }
        set({
          lines: get().lines.map((l) =>
            l.lineId === lineId ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, quantity) } : l,
          ),
          updatedAt: now(),
        });
      },
      remove(lineId) {
        const line = get().lines.find((l) => l.lineId === lineId);
        set({ lines: get().lines.filter((l) => l.lineId !== lineId), updatedAt: now() });
        return line;
      },
      restore(line) {
        if (get().lines.some((l) => l.lineId === line.lineId)) return;
        set({ lines: [...get().lines, line].sort((a, b) => a.addedAt - b.addedAt), updatedAt: now() });
      },
      setNotes(lineId, notes) {
        set({ lines: get().lines.map((l) => (l.lineId === lineId ? { ...l, notes } : l)), updatedAt: now() });
      },
      setCoupon(code) {
        set({ couponCode: code?.trim().toUpperCase() || null, updatedAt: now() });
      },
      replaceLines(lines, couponCode) {
        set({ lines, ...(couponCode !== undefined ? { couponCode } : {}), updatedAt: now() });
      },
      syncFromQuote(quote) {
        // Keep the snapshot aligned with the server so the UI never shows stale prices.
        const byId = new Map(quote.lines.map((l) => [l.lineId, l]));
        let changed = false;
        const lines = get().lines.map((l) => {
          const q = byId.get(l.lineId);
          if (!q) return l;
          if (q.unitPriceCents === l.snapshot.unitPriceCents && q.name === l.snapshot.name) return l;
          changed = true;
          return { ...l, snapshot: { ...l.snapshot, unitPriceCents: q.unitPriceCents, name: q.name } };
        });
        if (changed) set({ lines });
      },
      clear() {
        set({ lines: [], couponCode: null, updatedAt: now() });
      },
    }),
    {
      name: "dimsum.cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ lines: s.lines, couponCode: s.couponCode, updatedAt: s.updatedAt }),
    },
  ),
);

export function cartToInput(lines: CartLine[]): CartLineInput[] {
  return lines.map(({ lineId, productId, variantId, quantity, modifiers, notes }) => ({
    lineId,
    productId,
    variantId,
    quantity,
    modifiers,
    notes,
  }));
}

export const selectItemCount = (s: CartState) => s.lines.reduce((sum, l) => sum + l.quantity, 0);
export const selectEstimatedSubtotal = (s: CartState) =>
  s.lines.reduce((sum, l) => sum + l.snapshot.unitPriceCents * l.quantity, 0);
