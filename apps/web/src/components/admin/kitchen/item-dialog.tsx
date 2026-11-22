"use client";

import { ALLERGEN_LABELS } from "@dimsum/domain";
import type { KitchenItemDTO } from "@dimsum/types";
import { MessageSquareText, UtensilsCrossed } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";

/** Thumbnail of an ordered product (the catalog photo, or a neutral tile when there is none). */
export function ItemThumb({ item, className = "size-14" }: { item: KitchenItemDTO; className?: string }) {
  const url = item.product?.imageUrl;
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      className={`${className} shrink-0 rounded-xl object-cover ring-1 ring-black/5`}
    />
  ) : (
    <span className={`${className} grid shrink-0 place-items-center rounded-xl bg-surface-2 text-fg-subtle`}>
      <UtensilsCrossed className="size-5" />
    </span>
  );
}

/** Tapping a line on the kitchen board: the product in detail, as the customer ordered it. */
export function ItemDialog({ item, onClose }: { item: KitchenItemDTO | null; onClose: () => void }) {
  return (
    <Dialog
      open={!!item}
      onOpenChange={(open) => !open && onClose()}
      title={item?.name ?? ""}
      size="md"
      hideHeader
    >
      {item ? (
        <div className="pb-6">
          {item.product?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.product.imageUrl}
              alt={item.name}
              className="aspect-[4/3] w-full rounded-t-2xl bg-ink-950 object-cover"
            />
          ) : null}
          <div className="space-y-4 px-6 pt-5">
            <div className="flex items-start gap-3">
              <span className="grid h-12 min-w-12 shrink-0 place-items-center rounded-2xl bg-ink-950 px-2 text-title font-extrabold text-white tabular-nums">
                {item.quantity}×
              </span>
              <div className="min-w-0">
                <h2 className="text-title-lg leading-tight font-extrabold">{item.name}</h2>
                <p className="mt-0.5 text-body-sm text-fg-muted">
                  {[item.nameZh, item.posCode ? `Cod. ${item.posCode}` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>

            {item.variantName || item.modifiers.length ? (
              <div className="rounded-2xl bg-surface-2 p-4 text-body">
                {item.variantName ? <p className="font-semibold">{item.variantName}</p> : null}
                {item.modifiers.map((m) => (
                  <p key={m.name}>
                    + {m.quantity > 1 ? `${m.quantity}× ` : ""}
                    {m.name}
                  </p>
                ))}
              </div>
            ) : null}

            {item.notes ? (
              <p className="flex gap-2 rounded-2xl bg-warning-soft p-4 text-body font-semibold">
                <MessageSquareText className="mt-0.5 size-5 shrink-0 text-warning" /> “{item.notes}”
              </p>
            ) : null}

            {item.product?.description ? (
              <p className="text-body text-fg-muted">{item.product.description}</p>
            ) : null}

            {item.product?.ingredients.length ? (
              <div>
                <p className="text-caption font-bold tracking-wide text-fg-subtle uppercase">Ingredienti</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.product.ingredients.map((x) => (
                    <span key={x} className="rounded-full bg-surface-2 px-3 py-1 text-body-sm">
                      {x}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {item.allergens.length ? (
              <div>
                <p className="text-caption font-bold tracking-wide text-fg-subtle uppercase">Allergeni</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.allergens.map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-danger-soft px-3 py-1 text-body-sm font-semibold text-danger"
                    >
                      {ALLERGEN_LABELS[a]}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
