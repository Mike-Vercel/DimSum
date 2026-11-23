"use client";

import { formatEuro } from "@dimsum/domain";
import type { ProductDTO } from "@dimsum/types";
import { useStorefront } from "./product-sheet/context";
import { AddButton } from "./add-button";
import { cn } from "@/lib/cn";

/**
 * "Offerte" → Combo: several dishes at a special price, shown to make you hungry — the dishes
 * big on a warm background, the saving as a yellow burst, the price large with the full price
 * struck through.
 */
export function ComboShowcase({ comboIds }: { comboIds: string[] }) {
  const { catalog } = useStorefront();
  const combos = comboIds.map((id) => catalog.products[id]).filter((p): p is ProductDTO => !!p?.combo);
  if (!combos.length) return null;
  return (
    <section aria-labelledby="combo-title" className="space-y-5">
      <div>
        <p className="text-caption font-bold tracking-[0.18em] text-brand uppercase">Più piatti, un prezzo speciale</p>
        <h2 id="combo-title" className="text-headline font-extrabold">
          Le combo
        </h2>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {combos.map((p, i) => (
          <ComboCard key={p.id} product={p} featured={i === 0 && combos.length % 2 === 1} />
        ))}
      </div>
    </section>
  );
}

function ComboCard({ product, featured }: { product: ProductDTO; featured: boolean }) {
  const { catalog, open } = useStorefront();
  const combo = product.combo!;
  const saving = combo.valueCents - product.priceCents;
  const photos = combo.items
    .map((i) => catalog.products[i.productId]?.image)
    .filter((img): img is NonNullable<typeof img> => !!img)
    .slice(0, 3);

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[28px] bg-surface shadow-[0_20px_50px_-28px_rgba(120,40,10,.55)] ring-1 ring-black/5",
        featured && "sm:col-span-2 sm:flex-row",
      )}
    >
      <button
        type="button"
        onClick={() => open(product.slug)}
        aria-label={`Dettagli di ${product.name}`}
        className={cn(
          "relative isolate block overflow-hidden text-left",
          featured ? "aspect-[16/10] sm:aspect-auto sm:w-[56%]" : "aspect-[16/11]",
        )}
      >
        {/* Warm "grill" background with a soft spotlight. */}
        <span
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(70% 60% at 50% 55%, #ffd36b 0%, #ff9a3c 45%, #e2452f 80%, #b8231f 100%)",
          }}
        />
        <span aria-hidden className="absolute inset-0 -z-10 opacity-25 [background:repeating-linear-gradient(115deg,transparent_0_18px,rgba(255,255,255,.18)_18px_20px)]" />
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image.url}
            alt=""
            className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <span className="flex size-full items-center justify-center">
            {photos.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.url + i}
                src={img.url}
                alt=""
                className={cn(
                  "aspect-square rounded-full object-cover shadow-[0_18px_30px_-10px_rgba(0,0,0,.55)] ring-[5px] ring-white/90 transition-transform duration-500",
                  photos.length === 1 ? "w-[58%]" : "w-[42%]",
                  i === 0 && photos.length > 1 && "-mr-[9%] -rotate-6 group-hover:-rotate-12",
                  i === 1 && "z-10 scale-[1.18] group-hover:scale-[1.24]",
                  i === 2 && "-ml-[9%] rotate-6 group-hover:rotate-12",
                )}
              />
            ))}
          </span>
        )}
        {saving > 0 ? (
          <span
            className="absolute top-3 left-3 grid size-[84px] rotate-[-12deg] place-items-center text-center text-ink-950 drop-shadow-[0_6px_10px_rgba(0,0,0,.25)] transition-transform duration-500 group-hover:rotate-0"
            style={{
              background: "#ffd23f",
              clipPath:
                "polygon(50% 0%,61% 12%,76% 6%,80% 21%,95% 24%,90% 39%,100% 50%,90% 61%,95% 76%,80% 79%,76% 94%,61% 88%,50% 100%,39% 88%,24% 94%,20% 79%,5% 76%,10% 61%,0% 50%,10% 39%,5% 24%,20% 21%,24% 6%,39% 12%)",
            }}
          >
            <span className="leading-none">
              <span className="block text-[11px] font-extrabold uppercase">Risparmi</span>
              <span className="block text-[17px] font-black tabular-nums">{formatEuro(saving, { compact: true })}</span>
            </span>
          </span>
        ) : null}
        {!product.isAvailable ? (
          <span className="absolute inset-x-0 bottom-0 bg-ink-950/80 py-1.5 text-center text-caption font-bold text-white">
            Non disponibile oggi
          </span>
        ) : null}
      </button>

      <div className={cn("flex flex-1 flex-col gap-3 p-5", featured && "sm:justify-center sm:p-7")}>
        <div>
          <h3 className={cn("font-extrabold leading-tight", featured ? "text-headline" : "text-title-lg")}>
            {product.name}
          </h3>
          {product.description ? <p className="mt-1 text-body-sm text-fg-muted">{product.description}</p> : null}
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {combo.items.map((i) => (
            <li key={i.productId} className="rounded-full bg-surface-2 px-2.5 py-1 text-caption font-semibold">
              {i.quantity}× {i.name}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          <p className="leading-none tabular-nums">
            {saving > 0 ? (
              <span className="mb-1 block text-body-sm text-fg-subtle line-through">{formatEuro(combo.valueCents)}</span>
            ) : null}
            <span className="text-[34px] font-black tracking-tight text-brand">{formatEuro(product.priceCents)}</span>
          </p>
          <AddButton product={product} disabled={!product.isAvailable} />
        </div>
      </div>
    </article>
  );
}
