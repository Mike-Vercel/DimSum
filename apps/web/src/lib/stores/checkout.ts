"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CheckoutStep = "fulfillment" | "identity" | "payment";
export type PaymentChoice = "ONLINE" | "CASH_ON_DELIVERY";

const STEP_ORDER: CheckoutStep[] = ["fulfillment", "identity", "payment"];

/**
 * Checkout draft. Persisted so that a Google sign-in redirect (or a refresh) brings the customer
 * back exactly where they were, cart and address included.
 */
interface CheckoutDraftState {
  step: CheckoutStep;
  /** 1 = forward, -1 = back: drives the slide animation between steps. */
  direction: 1 | -1;
  identity: "guest" | "account" | null;
  customer: { name: string; email: string; phone: string };
  tipCents: number;
  paymentMethod: PaymentChoice;
  kitchenNotes: string;
  ageConfirmed: boolean;
  marketingConsent: boolean;
  saveAddress: boolean;
  /** One key per checkout attempt: identical retries return the same order. */
  idempotencyKey: string;
  /** Order created with this key, if any (resume payment after a refresh). */
  pendingOrder: { publicId: string; number: string; createdAt: number } | null;
  setStep(step: CheckoutStep): void;
  setIdentity(identity: "guest" | "account" | null): void;
  setCustomer(customer: Partial<CheckoutDraftState["customer"]>): void;
  set<K extends keyof CheckoutDraftState>(key: K, value: CheckoutDraftState[K]): void;
  setPendingOrder(order: CheckoutDraftState["pendingOrder"]): void;
  /** New attempt after the cart or totals changed. */
  renewKey(): void;
  /** Returns the current key, creating one if needed. */
  ensureKey(): string;
  reset(): void;
  /** Sign-out on a shared device: forget the customer's details too. */
  forget(): void;
}

const fresh = () => ({
  step: "fulfillment" as CheckoutStep,
  direction: 1 as 1 | -1,
  identity: null,
  tipCents: 0,
  paymentMethod: "ONLINE" as PaymentChoice,
  kitchenNotes: "",
  ageConfirmed: false,
  marketingConsent: false,
  saveAddress: true,
  // Assigned when the checkout starts (never during a server render).
  idempotencyKey: "",
  pendingOrder: null,
});

export const useCheckoutDraft = create<CheckoutDraftState>()(
  persist(
    (set, get) => ({
      ...fresh(),
      customer: { name: "", email: "", phone: "" },
      setStep: (step) =>
        set({ step, direction: STEP_ORDER.indexOf(step) >= STEP_ORDER.indexOf(get().step) ? 1 : -1 }),
      setIdentity: (identity) => set({ identity }),
      setCustomer: (customer) => set({ customer: { ...get().customer, ...customer } }),
      set: (key, value) => set({ [key]: value } as Partial<CheckoutDraftState>),
      setPendingOrder: (pendingOrder) => set({ pendingOrder }),
      renewKey: () => set({ idempotencyKey: crypto.randomUUID(), pendingOrder: null }),
      ensureKey: () => {
        const current = get().idempotencyKey;
        if (current) return current;
        const key = crypto.randomUUID();
        set({ idempotencyKey: key });
        return key;
      },
      // Keep customer details for the next order (they are the customer's own data on their device).
      reset: () => set({ ...fresh(), idempotencyKey: crypto.randomUUID() }),
      forget: () => set({ ...fresh(), customer: { name: "", email: "", phone: "" } }),
    }),
    {
      name: "dimsum.checkout",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
