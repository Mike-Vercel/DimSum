/**
 * Cart composition rules shared by every client. The cart only stores intent (product, options,
 * quantity, notes); prices are always recomputed by the server quote.
 */
import type { CartLineInput } from "@dimsum/types";
import { lineSignature } from "./catalog";

export const MAX_LINE_QUANTITY = 30;
export const MAX_CART_LINES = 60;

export function signatureOf(
  line: Pick<CartLineInput, "productId" | "variantId" | "modifiers" | "notes">,
): string {
  return lineSignature(line.productId, line.modifiers, line.notes, line.variantId);
}

/** Adds a line, merging it into an identical one when present. */
export function addLine(lines: readonly CartLineInput[], line: CartLineInput): CartLineInput[] {
  const sig = signatureOf(line);
  const existing = lines.find((l) => signatureOf(l) === sig);
  if (existing) {
    return lines.map((l) =>
      l === existing ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, l.quantity + line.quantity) } : l,
    );
  }
  if (lines.length >= MAX_CART_LINES) return [...lines];
  return [...lines, { ...line, quantity: Math.min(MAX_LINE_QUANTITY, line.quantity) }];
}

export function setLineQuantity(
  lines: readonly CartLineInput[],
  lineId: string,
  quantity: number,
): CartLineInput[] {
  if (quantity <= 0) return lines.filter((l) => l.lineId !== lineId);
  return lines.map((l) =>
    l.lineId === lineId ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, quantity) } : l,
  );
}

/**
 * Merges the device cart with the cart stored on the account after login. The device cart is the
 * current intent and wins on conflicts; lines only present on the account are appended.
 */
export function mergeCarts(
  device: readonly CartLineInput[],
  account: readonly CartLineInput[],
): CartLineInput[] {
  let merged = [...device];
  const deviceSigs = new Set(device.map(signatureOf));
  for (const line of account) {
    if (!deviceSigs.has(signatureOf(line))) merged = addLine(merged, line);
  }
  return merged;
}

export function cartItemCount(lines: readonly Pick<CartLineInput, "quantity">[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}
