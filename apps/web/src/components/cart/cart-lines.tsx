"use client";

import { formatEuro } from "@dimsum/domain";
import type { CartQuoteDTO } from "@dimsum/types";
import { AnimatePresence, motion } from "motion/react";
import { FoodImage } from "@/components/shop/food-image";
import { Badge } from "@/components/ui/badge";
import { QuantityStepper } from "@/components/ui/stepper";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { useCart, type CartLine } from "@/lib/stores/cart";

/** Cart lines with steppers; removing a line offers "Annulla" (reference screen 5). */
export function CartLines({
  quote,
  compact = false,
}: {
  quote: CartQuoteDTO | undefined;
  compact?: boolean;
}) {
  const lines = useCart((s) => s.lines);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const restore = useCart((s) => s.restore);
  const quoted = new Map(quote?.lines.map((l) => [l.lineId, l]) ?? []);

  const onChange = (line: CartLine, quantity: number) => {
    if (quantity <= 0) {
      const removed = remove(line.lineId);
      if (removed) {
        toast(`${removed.snapshot.name} rimosso`, {
          action: { label: "Annulla", onClick: () => restore(removed) },
          duration: 4000,
        });
      }
      return;
    }
    setQuantity(line.lineId, quantity);
  };

  return (
    <ul
      className={cn(
        "divide-y divide-line",
        compact ? "" : "rounded-2xl bg-surface px-4 shadow-xs ring-1 ring-line/70",
      )}
    >
      <AnimatePresence initial={false}>
        {lines.map((line) => {
          const q = quoted.get(line.lineId);
          const unavailable = q ? !q.isAvailable : false;
          const unit = q?.unitPriceCents ?? line.snapshot.unitPriceCents;
          return (
            <motion.li
              key={line.lineId}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
              transition={spring.smooth}
              className="overflow-hidden"
            >
              <div className={cn("flex gap-3.5 py-3.5", unavailable && "opacity-60")}>
                <FoodImage
                  image={
                    line.snapshot.imageUrl
                      ? {
                          url: line.snapshot.imageUrl,
                          width: 160,
                          height: 160,
                          alt: line.snapshot.name,
                          blurDataUrl: line.snapshot.imageBlur,
                          dominantColor: null,
                          backdrop: line.snapshot.backdrop,
                        }
                      : null
                  }
                  sizes="72px"
                  rounded="rounded-xl"
                  className={compact ? "size-14 shrink-0" : "size-18 shrink-0"}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="leading-snug font-semibold">{line.snapshot.name}</p>
                    <p className="shrink-0 font-semibold tabular-nums">{formatEuro(unit * line.quantity)}</p>
                  </div>
                  {line.snapshot.details.length ? (
                    <p className="mt-0.5 line-clamp-2 text-caption text-fg-muted">
                      {line.snapshot.details.join(" · ")}
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {unavailable ? (
                      <Badge tone="dark" size="md">
                        Esaurito
                      </Badge>
                    ) : (
                      <span className="text-caption text-fg-subtle tabular-nums">
                        {formatEuro(unit)} cad.
                      </span>
                    )}
                    <QuantityStepper
                      value={line.quantity}
                      onChange={(qty) => onChange(line, qty)}
                      removable
                      size="sm"
                      label={`Quantità di ${line.snapshot.name}`}
                    />
                  </div>
                </div>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
