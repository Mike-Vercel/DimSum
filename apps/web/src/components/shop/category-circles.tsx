"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { FoodImage } from "./food-image";
import { useStorefront } from "./product-sheet/context";

/** Round category shortcuts with real dish photos (reference screens 2–3). */
export function CategoryCircles({
  className,
  activeId,
  onSelect,
}: {
  className?: string;
  activeId?: string | null;
  onSelect?: (categoryId: string) => void;
}) {
  const { catalog } = useStorefront();
  return (
    <nav
      aria-label="Categorie"
      // Top padding: the selected ring sits outside the photo and a scroller would clip it.
      className={cn(
        "-mx-4 scrollbar-none flex gap-4 overflow-x-auto mask-fade-x px-4 pt-1.5 pb-1",
        className,
      )}
    >
      {catalog.categories.map((c) => {
        const active = activeId === c.id;
        const content = (
          <>
            <span
              className={cn(
                "relative block size-[72px] overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-canvas transition-[box-shadow,transform] duration-300 group-hover:scale-105",
                active ? "ring-brand" : "ring-transparent",
              )}
            >
              <FoodImage
                image={c.image}
                sizes="72px"
                rounded="rounded-full"
                className="size-full"
                fit="cover"
              />
            </span>
            <span
              className={cn(
                "line-clamp-2 w-20 text-center text-caption leading-tight font-semibold",
                active ? "text-brand-ink" : "text-fg",
              )}
            >
              {c.name}
            </span>
          </>
        );
        return onSelect ? (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            aria-current={active || undefined}
            className="group flex shrink-0 tap flex-col items-center gap-2"
          >
            {content}
          </button>
        ) : (
          <Link
            key={c.id}
            href={`/menu#${c.slug}`}
            className="group flex shrink-0 tap flex-col items-center gap-2"
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
