"use client";

import { formatEuro } from "@dimsum/domain";
import type { ProductDTO } from "@dimsum/types";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { productAvailable, useNow } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { AddButton } from "./add-button";
import { FavoriteButton } from "./favorite-button";
import { FoodImage } from "./food-image";
import { ProductBadges } from "./product-badges";
import { useStorefront } from "./product-sheet/context";

/**
 * Cards use the "stretched link" pattern: the product name is the link and covers the card,
 * while the add and favorite buttons sit above it as independent controls (valid, accessible).
 */
function ProductLink({ product, className }: { product: ProductDTO; className?: string }) {
  const { open } = useStorefront();
  return (
    <Link
      href={`/product/${product.slug}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        open(product.slug);
      }}
      className={cn(
        "outline-none after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-ring",
        className,
      )}
    >
      {product.name}
    </Link>
  );
}

/** List row for the mobile menu (reference screen 3). */
export function ProductRow({
  product,
  bestseller,
  priority,
}: {
  product: ProductDTO;
  bestseller?: boolean;
  priority?: boolean;
}) {
  const now = useNow();
  const available = productAvailable(product, now);
  return (
    <article
      className={cn(
        "group relative flex tap gap-4 rounded-2xl bg-surface p-3 shadow-xs ring-1 ring-line/70 transition-shadow hover:shadow-md",
        !available && "opacity-70",
      )}
    >
      <div className="relative shrink-0">
        <FoodImage
          image={product.image}
          sizes="112px"
          priority={priority}
          rounded="rounded-xl"
          className="size-28"
          imgClassName={available ? "group-hover:scale-[1.04]" : "grayscale"}
        />
        {!available ? (
          <Badge tone="dark" className="absolute bottom-1.5 left-1/2 -translate-x-1/2">
            Esaurito
          </Badge>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="line-clamp-2 text-body leading-snug font-bold">
          <ProductLink product={product} />
        </h3>
        {product.nameZh ? (
          <p className="truncate font-cjk text-micro text-fg-subtle" lang="zh-Hans">
            {product.nameZh}
          </p>
        ) : null}
        {product.description ? (
          <p className="mt-1 line-clamp-2 text-caption text-fg-muted">{product.description}</p>
        ) : null}
        <ProductBadges product={product} bestseller={bestseller} className="mt-1.5" />
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className="text-body font-bold tabular-nums">{formatEuro(product.priceCents)}</span>
          <AddButton product={product} disabled={!available} size="sm" className="relative z-10" />
        </div>
      </div>
    </article>
  );
}

/** Card for carousels and desktop grids (reference screen 2, "I più amati"). */
export function ProductTile({
  product,
  bestseller,
  priority,
  className,
  sizes = "(min-width: 1280px) 280px, (min-width: 768px) 30vw, 46vw",
}: {
  product: ProductDTO;
  bestseller?: boolean;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  const now = useNow();
  const available = productAvailable(product, now);
  return (
    <article
      className={cn(
        "group relative flex tap flex-col overflow-hidden rounded-2xl bg-surface shadow-xs ring-1 ring-line/70 transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-lg",
        !available && "opacity-75",
        className,
      )}
    >
      <div className="relative">
        <FoodImage
          image={product.image}
          sizes={sizes}
          priority={priority}
          rounded="rounded-none"
          className="aspect-[4/3] w-full"
          imgClassName={available ? "group-hover:scale-[1.05]" : "grayscale"}
        />
        <FavoriteButton
          productId={product.id}
          productName={product.name}
          variant="glass"
          className="absolute top-2 right-2 z-10 size-9"
        />
        {!available ? (
          <Badge tone="dark" size="md" className="absolute bottom-2 left-2">
            Esaurito
          </Badge>
        ) : bestseller ? (
          <Badge tone="solid" size="md" className="absolute bottom-2 left-2">
            Più venduto
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="line-clamp-2 text-body-sm leading-snug font-bold md:text-body">
          <ProductLink product={product} />
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="text-body font-bold tabular-nums">{formatEuro(product.priceCents)}</span>
          <AddButton product={product} disabled={!available} size="sm" className="relative z-10" />
        </div>
      </div>
    </article>
  );
}
