"use client";

import { formatEuro } from "@dimsum/domain";
import type { ProductDTO } from "@dimsum/types";
import { toast } from "@/components/ui/toaster";
import { haptics } from "./haptics";
import { useCart, type CartLine } from "./stores/cart";

export interface AddOptions {
  quantity?: number;
  variantId?: string | null;
  modifiers?: { modifierId: string; quantity: number }[];
  notes?: string | null;
  silent?: boolean;
}

/** A cart line for a configured product, with the display snapshot shown until the server quote. */
export function cartLineFor(
  product: ProductDTO,
  options: AddOptions = {},
): Omit<CartLine, "lineId" | "addedAt"> {
  const quantity = options.quantity ?? 1;
  const variant = product.variants.find((v) => v.id === options.variantId) ?? null;
  const modifiers = options.modifiers ?? [];
  const optionIndex = new Map(
    product.modifierGroups.flatMap((g) => g.options.map((o) => [o.id, o] as const)),
  );
  const extras = modifiers.reduce(
    (sum, m) => sum + (optionIndex.get(m.modifierId)?.priceDeltaCents ?? 0) * m.quantity,
    0,
  );
  const unitPriceCents = (variant?.priceCents ?? product.priceCents) + extras;
  const details = [
    ...(variant ? [variant.name] : []),
    ...modifiers.map((m) => {
      const o = optionIndex.get(m.modifierId);
      return o ? `${m.quantity > 1 ? `${m.quantity}× ` : ""}${o.name}` : "";
    }),
    ...(options.notes ? [`“${options.notes}”`] : []),
  ].filter(Boolean);

  return {
    productId: product.id,
    variantId: variant?.id ?? null,
    quantity,
    modifiers,
    notes: options.notes?.trim() || null,
    snapshot: {
      slug: product.slug,
      name: product.name,
      unitPriceCents,
      imageUrl: product.image?.url ?? null,
      imageBlur: product.image?.blurDataUrl ?? null,
      backdrop: product.image?.backdrop ?? "DARK",
      details,
    },
  };
}

/** Adds a configured product to the device cart with a display snapshot. */
export function useAddToCart() {
  const add = useCart((s) => s.add);
  return (product: ProductDTO, options: AddOptions = {}) => {
    const line = cartLineFor(product, options);
    add(line);
    haptics.success();
    if (!options.silent) {
      toast.success(`${line.quantity > 1 ? `${line.quantity}× ` : ""}${product.name}`, {
        description: `Aggiunto al carrello · ${formatEuro(line.snapshot.unitPriceCents * line.quantity)}`,
        duration: 2200,
      });
    }
  };
}
