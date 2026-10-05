"use client";

import { formatEuro, isAvailableNow, suggestProducts } from "@dimsum/domain";
import { AddButton } from "@/components/shop/add-button";
import { FoodImage } from "@/components/shop/food-image";
import { useStorefront } from "@/components/shop/product-sheet/context";
import { useNow } from "@/lib/catalog";
import { useCart } from "@/lib/stores/cart";

/** "Ti potrebbe piacere": drinks, desserts and starters missing from the cart. No profiling. */
export function CartSuggestions() {
  const { catalog, open } = useStorefront();
  const now = useNow();
  const lines = useCart((s) => s.lines);
  const complements = ["bevande", "dolci", "mochi-e-daifuku", "antipasti"]
    .map((slug) => catalog.categories.find((c) => c.slug === slug)?.id)
    .filter((id): id is string => !!id);
  const rank = new Map(catalog.bestsellerIds.map((id, i) => [id, i]));
  const ids = suggestProducts(
    Object.values(catalog.products).map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      isAvailable: isAvailableNow(p, now),
      priceCents: p.priceCents,
      isFeatured: p.isFeatured,
      salesRank: rank.get(p.id) ?? null,
    })),
    lines.map((l) => l.productId),
    { complementCategoryIds: complements, limit: 4 },
  );
  if (ids.length === 0) return null;
  return (
    <section aria-labelledby="ti-potrebbe-piacere" className="space-y-3">
      <h2 id="ti-potrebbe-piacere" className="text-title-sm font-bold">
        Ti potrebbe piacere
      </h2>
      <ul className="-mx-4 scrollbar-none flex gap-3 overflow-x-auto px-4 pb-1">
        {ids.map((id) => {
          const p = catalog.products[id]!;
          return (
            <li
              key={id}
              className="relative flex w-40 shrink-0 flex-col rounded-2xl bg-surface p-2.5 ring-1 ring-line/70"
            >
              <FoodImage
                image={p.image}
                sizes="140px"
                rounded="rounded-xl"
                className="aspect-square w-full"
              />
              <button
                type="button"
                onClick={() => open(p.slug)}
                className="mt-2 line-clamp-2 text-left text-caption leading-snug font-semibold after:absolute after:inset-0 after:content-['']"
              >
                {p.name}
              </button>
              <div className="mt-auto flex items-center justify-between pt-2">
                <span className="text-body-sm font-bold tabular-nums">{formatEuro(p.priceCents)}</span>
                <AddButton product={p} size="sm" className="relative z-10" />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
