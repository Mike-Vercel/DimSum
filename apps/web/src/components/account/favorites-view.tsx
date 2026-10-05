"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { ProductTile } from "@/components/shop/product-card";
import { useStorefront } from "@/components/shop/product-sheet/context";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { useFavorites } from "@/lib/favorites";

export function FavoritesView() {
  const { catalog } = useStorefront();
  const favorites = useFavorites();
  // Products removed from the menu simply disappear from the list.
  const products = [...favorites.ids].map((id) => catalog.products[id]).filter((p) => p !== undefined);

  if (favorites.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="Nessun preferito, per ora"
        description="Tocca il cuore su un piatto per ritrovarlo qui e riordinarlo in un attimo."
        action={
          <Button asChild>
            <Link href="/menu">Scopri il menu</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {products.map((p) => (
        <li key={p.id}>
          <ProductTile product={p} bestseller={catalog.bestsellerIds.includes(p.id)} />
        </li>
      ))}
    </ul>
  );
}
