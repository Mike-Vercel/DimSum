"use client";

import { signOut } from "./auth-client";
import { useCart } from "./stores/cart";
import { useCheckoutDraft } from "./stores/checkout";
import { useOrderPrefs } from "./stores/order-prefs";

/**
 * Explicit sign-out: the account's cart, contact details and address stay on the account, not on
 * a device that may be shared.
 */
export async function signOutAndForget(): Promise<void> {
  await signOut();
  useCart.getState().clear();
  useCheckoutDraft.getState().forget();
  useOrderPrefs.getState().setAddress(null);
}
