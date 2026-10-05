"use client";

import { formatEuro } from "@dimsum/domain";
import { useState } from "react";
import { FoodImage } from "@/components/shop/food-image";
import { useCart } from "@/lib/stores/cart";

/** What is being ordered, as the customer reviews it before paying. */
export function OrderLines({ limit }: { limit?: number }) {
  const lines = useCart((s) => s.lines);
  const [expanded, setExpanded] = useState(false);
  const hidden = limit && !expanded ? Math.max(0, lines.length - limit) : 0;
  return (
    <div>
      <ul className="space-y-3">
        {lines.slice(0, lines.length - hidden).map((l) => (
          <li key={l.lineId} className="flex items-center gap-3">
            <FoodImage
              image={
                l.snapshot.imageUrl
                  ? {
                      url: l.snapshot.imageUrl,
                      width: 120,
                      height: 120,
                      alt: "",
                      blurDataUrl: l.snapshot.imageBlur,
                      dominantColor: null,
                      backdrop: l.snapshot.backdrop,
                    }
                  : null
              }
              sizes="48px"
              rounded="rounded-lg"
              className="size-12 shrink-0"
            />
            <div className="min-w-0 flex-1 text-body-sm">
              <p className="line-clamp-2 font-semibold">
                {l.quantity}× {l.snapshot.name}
              </p>
              {l.snapshot.details.length ? (
                <p className="truncate text-caption text-fg-muted">{l.snapshot.details.join(" · ")}</p>
              ) : null}
            </div>
            <span className="text-body-sm font-semibold tabular-nums">
              {formatEuro(l.snapshot.unitPriceCents * l.quantity)}
            </span>
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 tap text-body-sm font-semibold text-brand-ink"
        >
          Mostra {hidden === 1 ? "un altro prodotto" : `altri ${hidden} prodotti`}
        </button>
      ) : null}
    </div>
  );
}
