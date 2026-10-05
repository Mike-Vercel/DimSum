"use client";

import { formatEuro } from "@dimsum/domain";
import type { CartQuoteDTO } from "@dimsum/types";
import { InlineAlert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/stores/cart";

/** Explains server-side corrections: price updates, sold-out items, invalid options. */
export function CartIssues({ quote }: { quote: CartQuoteDTO | undefined }) {
  const remove = useCart((s) => s.remove);
  if (!quote?.issues.length) return null;
  const priceChanges = quote.issues.filter((i) => i.code === "PRICE_CHANGED");
  const blocking = quote.issues.filter((i) => i.code !== "PRICE_CHANGED" && i.code !== "QUANTITY_LIMIT");
  const removable = blocking.filter((i) => i.lineId);
  return (
    <div className="space-y-2">
      {priceChanges.length ? (
        <InlineAlert tone="warning" title="Il prezzo di un prodotto è stato aggiornato.">
          {priceChanges.map((i) => (
            <span key={i.lineId} className="block">
              {i.message.replace(/\.$/, "")}: {formatEuro(i.previousPriceCents ?? 0)} →{" "}
              <strong>{formatEuro(i.currentPriceCents ?? 0)}</strong>
            </span>
          ))}
          <span className="mt-1 block">Il totale qui sotto è già aggiornato.</span>
        </InlineAlert>
      ) : null}
      {blocking.length ? (
        <InlineAlert
          tone="danger"
          title={blocking.length === 1 ? blocking[0]!.message : "Alcuni prodotti non sono più disponibili."}
          action={
            removable.length ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => removable.forEach((i) => remove(i.lineId!))}
              >
                Rimuovi {removable.length === 1 ? "il prodotto" : "i prodotti"} non disponibili
              </Button>
            ) : null
          }
        >
          {blocking.length > 1
            ? blocking.map((i) => (
                <span key={`${i.lineId}-${i.code}`} className="block">
                  {i.message}
                </span>
              ))
            : null}
        </InlineAlert>
      ) : null}
    </div>
  );
}
