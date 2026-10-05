"use client";

import type { ProductDTO } from "@dimsum/types";
import { Check, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { needsConfiguration } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { useAddToCart } from "@/lib/use-add-to-cart";
import { useStorefront } from "./product-sheet/context";

/** Round red "+" (reference screens 2–3): quick add, or opens the sheet when options are required. */
export function AddButton({
  product,
  disabled,
  className,
  size = "md",
}: {
  product: ProductDTO;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const add = useAddToCart();
  const { open } = useStorefront();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1200);
    return () => clearTimeout(t);
  }, [done]);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Aggiungi ${product.name} al carrello`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (needsConfiguration(product)) {
          open(product.slug);
          return;
        }
        add(product);
        setDone(true);
      }}
      className={cn(
        "relative grid shrink-0 tap place-items-center rounded-full bg-brand text-white shadow-cta transition-colors hover:bg-red-600 disabled:bg-ink-300 disabled:shadow-none",
        size === "sm" ? "size-8" : "size-10",
        done && "bg-jade-500 hover:bg-jade-500",
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={done ? "done" : "plus"}
          initial={{ scale: 0.4, rotate: -90, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0.4, rotate: 90, opacity: 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 30 }}
        >
          {done ? (
            <Check className="size-5" strokeWidth={3} />
          ) : (
            <Plus className={size === "sm" ? "size-4" : "size-5"} strokeWidth={2.6} />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
