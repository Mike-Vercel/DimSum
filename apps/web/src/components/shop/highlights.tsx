"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { SectionTitle } from "@/components/ui/misc";
import { ProductTile } from "./product-card";
import { useStorefront } from "./product-sheet/context";

/**
 * "I più amati" when there are real sales or staff picks; otherwise an honest "Le specialità"
 * selection (first dish of the main categories) — never invented bestsellers.
 */
export function Highlights() {
  const { catalog } = useStorefront();
  const best = catalog.bestsellerIds.map((id) => catalog.products[id]).filter((p) => p !== undefined);
  const fallback = catalog.categories
    .slice(0, 8)
    .map((c) => catalog.products[c.productIds[0]!])
    .filter((p) => p !== undefined);
  const items = (best.length >= 4 ? best : fallback).slice(0, 8);
  const title = best.length >= 4 ? "I più amati" : "Le nostre specialità";

  return (
    <section aria-labelledby="highlights" className="space-y-4">
      <SectionTitle
        title={<span id="highlights">{title}</span>}
        action={
          <Link
            href="/menu"
            className="inline-flex items-center gap-1 text-body-sm font-semibold text-brand-ink"
          >
            Vedi tutti <ArrowRight className="size-4" />
          </Link>
        }
      />
      <div className="-mx-4 scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-4">
        {items.map((p, i) => (
          <ProductTile
            key={p.id}
            product={p}
            bestseller={best.length >= 4}
            priority={i < 2}
            className="w-[46vw] max-w-56 shrink-0 snap-start md:w-auto md:max-w-none"
          />
        ))}
      </div>
    </section>
  );
}
