import { ALLERGEN_DISCLAIMER, ALLERGEN_LABELS } from "@dimsum/domain";
import type { Allergen } from "@dimsum/types";
import {
  Bean,
  Droplet,
  Egg,
  Fish,
  Flower2,
  Leaf,
  Milk,
  Nut,
  Shell,
  Shrimp,
  Sprout,
  Wheat,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

export const ALLERGEN_ICONS: Record<Allergen, LucideIcon> = {
  GLUTEN: Wheat,
  CRUSTACEANS: Shrimp,
  EGGS: Egg,
  FISH: Fish,
  PEANUTS: Nut,
  SOYBEANS: Bean,
  MILK: Milk,
  NUTS: Nut,
  CELERY: Leaf,
  MUSTARD: Droplet,
  SESAME: Sprout,
  SULPHITES: Wine,
  LUPIN: Flower2,
  MOLLUSCS: Shell,
};

export function AllergenList({
  allergens,
  declared,
  className,
}: {
  allergens: Allergen[];
  declared: boolean;
  className?: string;
}) {
  return (
    <section className={className} aria-labelledby="allergeni">
      <h3 id="allergeni" className="text-body font-bold">
        Allergeni
      </h3>
      {declared && allergens.length > 0 ? (
        <ul className="mt-2.5 flex flex-wrap gap-2">
          {allergens.map((a) => {
            const Icon = ALLERGEN_ICONS[a];
            return (
              <li
                key={a}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-body-sm ring-1 ring-line"
              >
                <Icon className="size-4 text-fg-muted" aria-hidden />
                {ALLERGEN_LABELS[a]}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1.5 text-body-sm text-fg-muted">
          Allergeni non indicati per questo prodotto: in caso di allergie o intolleranze chiedi al ristorante
          prima di ordinare.
        </p>
      )}
      <p className={cn("mt-2.5 text-caption text-fg-subtle")}>{ALLERGEN_DISCLAIMER}</p>
    </section>
  );
}
