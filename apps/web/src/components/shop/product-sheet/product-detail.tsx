"use client";

import {
  describeModifierError,
  formatEuro,
  resolveVariant,
  unitPrice,
  validateModifierSelection,
  type PricedProduct,
} from "@dimsum/domain";
import type { ProductDTO } from "@dimsum/types";
import { Clock, Minus, Plus, Wine } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, RadioCard, RadioCardGroup } from "@/components/ui/choice";
import { InlineAlert } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { QuantityStepper } from "@/components/ui/stepper";
import { productAvailable, useNow } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";
import { useAddToCart } from "@/lib/use-add-to-cart";
import { AllergenList } from "../allergen-list";
import { FavoriteButton } from "../favorite-button";
import { FoodImage } from "../food-image";
import { ProductBadges } from "../product-badges";

function toPriced(p: ProductDTO): PricedProduct {
  return {
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
    priceCents: p.priceCents,
    variants: p.variants,
    vatRateBps: 1000,
    isAvailable: p.isAvailable,
    excludedFromDiscounts: p.excludedFromDiscounts,
    maxQuantityPerLine: 30,
    modifierGroups: p.modifierGroups.map((g) => ({
      id: g.id,
      name: g.name,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      maxTotalQuantity: g.maxTotalQuantity,
      options: g.options.map((o) => ({ ...o, groupId: g.id })),
    })),
  };
}

function groupHint(g: ProductDTO["modifierGroups"][number]): string {
  if (g.minSelect > 0 && g.minSelect === g.maxSelect)
    return g.minSelect === 1 ? "Scegli 1 opzione" : `Scegli ${g.minSelect} opzioni`;
  if (g.minSelect > 0) return `Scegli da ${g.minSelect} a ${g.maxSelect}`;
  return g.maxSelect === 1 ? "Facoltativo · max 1" : `Facoltativo · fino a ${g.maxSelect}`;
}

/** Product detail with options, notes and sticky CTA. Shared by the sheet and the full page. */
export function ProductDetail({
  product,
  bestseller,
  onAdded,
  layout = "sheet",
}: {
  product: ProductDTO;
  bestseller?: boolean;
  onAdded?: () => void;
  layout?: "sheet" | "page";
}) {
  const now = useNow();
  const addToCart = useAddToCart();
  const priced = useMemo(() => toPriced(product), [product]);
  const defaultVariant = product.variants.find((v) => v.isAvailable)?.id ?? null;
  const [variantId, setVariantId] = useState<string | null>(defaultVariant);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [showErrors, setShowErrors] = useState(false);

  const available = productAvailable(product, now);
  const selections = Object.entries(selected)
    .filter(([, q]) => q > 0)
    .map(([modifierId, q]) => ({ modifierId, quantity: q }));
  const modResult = validateModifierSelection(priced, selections);
  const variantResult = resolveVariant(priced, variantId);
  const variant = variantResult.ok ? variantResult.variant : null;
  const unit = unitPrice(priced, modResult.resolved, variant);
  const errors = [
    ...(variantResult.ok ? [] : ["Scegli una variante."]),
    ...(modResult.ok ? [] : modResult.errors.map(describeModifierError)),
  ];
  const alcoholic = product.tags.includes("ALCOHOLIC");

  const toggle = (groupId: string, optionId: string) => {
    haptics.select();
    setSelected((prev) => {
      const group = product.modifierGroups.find((g) => g.id === groupId);
      const next = { ...prev };
      if (next[optionId]) {
        delete next[optionId];
        return next;
      }
      // Single-choice groups behave like radios.
      if (group && group.maxSelect === 1) for (const o of group.options) delete next[o.id];
      next[optionId] = 1;
      return next;
    });
  };

  const submit = () => {
    if (!available) return;
    if (errors.length) {
      setShowErrors(true);
      haptics.warning();
      return;
    }
    addToCart(product, { quantity, variantId, modifiers: selections, notes: notes.trim() || null });
    onAdded?.();
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className={cn("relative", layout === "sheet" ? "px-3 pt-1" : "")}>
        <FoodImage
          image={product.image}
          sizes="(min-width: 768px) 560px, 100vw"
          priority
          rounded={layout === "sheet" ? "rounded-2xl" : "rounded-3xl"}
          className="aspect-[4/3] w-full"
        />
        <div className="absolute top-3 right-6">
          <FavoriteButton productId={product.id} productName={product.name} variant="glass" />
        </div>
        {!available ? (
          <div className="absolute inset-x-6 bottom-3">
            <Badge tone="glass" size="md">
              <Clock aria-hidden />
              {product.availableAgainAt ? "Torna disponibile a breve" : "Esaurito per oggi"}
            </Badge>
          </div>
        ) : null}
      </div>

      <div className="flex-1 space-y-6 px-5 pt-5 pb-6">
        <header>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-headline font-extrabold">{product.name}</h2>
              {product.nameZh ? (
                <p className="mt-1 font-cjk text-body-sm text-fg-subtle" lang="zh-Hans">
                  {product.nameZh}
                </p>
              ) : null}
            </div>
            <p className="shrink-0 pt-1 text-title font-extrabold text-brand-ink">
              {formatEuro(variant?.priceCents ?? product.priceCents)}
            </p>
          </div>
          <ProductBadges product={product} bestseller={bestseller} className="mt-3" size="md" />
          {product.description ? <p className="mt-3 text-body text-fg-muted">{product.description}</p> : null}
        </header>

        {product.ingredients.length > 0 ? (
          <section aria-labelledby="ingredienti">
            <h3 id="ingredienti" className="text-body font-bold">
              Ingredienti
            </h3>
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {product.ingredients.map((i) => (
                <li
                  key={i}
                  className="rounded-full bg-surface-2 px-3 py-1 text-body-sm text-fg ring-1 ring-line first-letter:uppercase"
                >
                  {i}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {product.variants.length > 0 ? (
          <section aria-labelledby="varianti">
            <div className="flex items-baseline justify-between">
              <h3 id="varianti" className="text-body font-bold">
                Scegli la variante
              </h3>
              <Badge tone="brand">Obbligatorio</Badge>
            </div>
            <RadioCardGroup value={variantId ?? ""} onValueChange={setVariantId} className="mt-3 grid gap-2">
              {product.variants.map((v) => (
                <RadioCard
                  key={v.id}
                  value={v.id}
                  disabled={!v.isAvailable}
                  title={v.name}
                  description={v.isAvailable ? undefined : "Non disponibile"}
                  trailing={<span className="font-semibold tabular-nums">{formatEuro(v.priceCents)}</span>}
                />
              ))}
            </RadioCardGroup>
          </section>
        ) : null}

        {product.modifierGroups.map((g) => {
          const groupError =
            showErrors && !modResult.ok && modResult.errors.some((e) => "groupId" in e && e.groupId === g.id);
          return (
            <section key={g.id} aria-labelledby={`g-${g.id}`}>
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <h3 id={`g-${g.id}`} className="text-body font-bold">
                    {g.name}
                  </h3>
                  <p
                    className={cn("text-caption", groupError ? "font-semibold text-danger" : "text-fg-muted")}
                  >
                    {g.description ? `${g.description} · ` : ""}
                    {groupHint(g)}
                  </p>
                </div>
                {g.minSelect > 0 ? <Badge tone="brand">Obbligatorio</Badge> : null}
              </div>
              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg bg-surface ring-1 ring-line">
                {g.options.map((o) => {
                  const qty = selected[o.id] ?? 0;
                  return (
                    <li
                      key={o.id}
                      className={cn("flex items-center gap-3 px-4 py-3", !o.isAvailable && "opacity-50")}
                    >
                      <Checkbox
                        id={`o-${o.id}`}
                        checked={qty > 0}
                        disabled={!o.isAvailable}
                        onCheckedChange={() => toggle(g.id, o.id)}
                        aria-label={o.name}
                      />
                      <label htmlFor={`o-${o.id}`} className="min-w-0 flex-1 cursor-pointer text-body">
                        {o.name}
                        {!o.isAvailable ? (
                          <span className="ml-2 text-caption text-fg-muted">Esaurito</span>
                        ) : null}
                      </label>
                      {qty > 0 && o.maxQuantity > 1 ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Meno ${o.name}`}
                            className="grid size-8 tap place-items-center rounded-full ring-1 ring-line"
                            onClick={() =>
                              setSelected((p) => ({ ...p, [o.id]: Math.max(1, (p[o.id] ?? 1) - 1) }))
                            }
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-5 text-center font-semibold tabular-nums">{qty}</span>
                          <button
                            type="button"
                            aria-label={`Più ${o.name}`}
                            disabled={qty >= o.maxQuantity}
                            className="grid size-8 tap place-items-center rounded-full ring-1 ring-line disabled:opacity-40"
                            onClick={() =>
                              setSelected((p) => ({
                                ...p,
                                [o.id]: Math.min(o.maxQuantity, (p[o.id] ?? 1) + 1),
                              }))
                            }
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      ) : null}
                      <span className="w-16 text-right text-body-sm text-fg-muted tabular-nums">
                        {o.priceDeltaCents ? `+${formatEuro(o.priceDeltaCents)}` : "Gratis"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        <AllergenList allergens={product.allergens} declared={product.allergensDeclared} />

        {alcoholic ? (
          <InlineAlert tone="warning" title="Bevanda alcolica">
            <span className="inline-flex items-center gap-1">
              <Wine className="size-3.5" aria-hidden /> Vendita vietata ai minori di 18 anni: al momento della
              consegna potrà esserti chiesto un documento.
            </span>
          </InlineAlert>
        ) : null}

        <section aria-labelledby="note">
          <h3 id="note" className="text-body font-bold">
            Note per la cucina <span className="font-normal text-fg-subtle">(facoltativo)</span>
          </h3>
          <Textarea
            className="mt-2.5"
            value={notes}
            maxLength={200}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Es. senza cipolla, poco piccante…"
            aria-labelledby="note"
          />
        </section>

        {showErrors && errors.length > 0 ? <InlineAlert tone="danger" title={errors[0]} /> : null}
      </div>

      <div className="sticky bottom-0 z-10 border-t border-line bg-canvas/95 px-5 pt-3 pb-[calc(var(--safe-bottom)+12px)] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <QuantityStepper
            value={quantity}
            onChange={(q) => setQuantity(Math.max(1, q))}
            size="lg"
            label="Quantità"
          />
          <Button size="lg" block onClick={submit} disabled={!available} className="h-13 flex-1">
            {available ? (
              <>
                Aggiungi {quantity > 1 ? quantity : ""} <span aria-hidden>•</span>{" "}
                {formatEuro(unit * quantity)}
              </>
            ) : (
              "Non disponibile"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
