"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStorefront } from "@/components/shop/product-sheet/context";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "./api";
import { haptics } from "./haptics";
import { useCart } from "./stores/cart";
import { cartLineFor } from "./use-add-to-cart";

/** "Riordina": rebuilds a past order against today's menu and says what changed. */
export function useReorder() {
  const router = useRouter();
  const { catalog } = useStorefront();
  const add = useCart((s) => s.add);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const reorder = async (orderId: string) => {
    setPendingId(orderId);
    try {
      const res = await api.me.reorder(orderId);
      let added = 0;
      for (const line of res.lines) {
        const product = catalog.products[line.productId];
        if (!product) continue;
        add(
          cartLineFor(product, {
            quantity: line.quantity,
            variantId: line.variantId,
            modifiers: line.modifiers,
            notes: line.notes,
          }),
        );
        added++;
      }
      if (added === 0) {
        haptics.error();
        toast.error("Oggi questi piatti non sono disponibili", {
          description: "Dai un'occhiata al menu: troverai qualcosa di altrettanto buono.",
        });
        return;
      }
      const notes = [
        res.unavailable.length ? `Non disponibili: ${res.unavailable.join(", ")}.` : null,
        res.changedPrices.length ? `Prezzo aggiornato: ${res.changedPrices.join(", ")}.` : null,
      ].filter(Boolean);
      haptics.success();
      toast.success(
        "Ordine aggiunto al carrello",
        notes.length ? { description: notes.join(" "), duration: 6000 } : undefined,
      );
      router.push("/cart");
    } catch (error) {
      haptics.error();
      toast.error(error instanceof ApiError ? error.message : "Non è stato possibile riordinare. Riprova.");
    } finally {
      setPendingId(null);
    }
  };

  return { reorder, pendingId };
}
