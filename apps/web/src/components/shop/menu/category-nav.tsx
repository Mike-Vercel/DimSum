"use client";

import type { CategoryDTO } from "@dimsum/types";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

/**
 * Horizontal category pills; the active pill follows the scroll position.
 * Phones: fixed under the header and shown only once the category circles have scrolled away, so
 * the first screen shows the circles alone. Desktop (no circles): always visible, sticky.
 */
export function CategoryNav({
  categories,
  activeId,
  onSelect,
  revealed,
}: {
  categories: CategoryDTO[];
  activeId: string | null;
  onSelect: (id: string) => void;
  revealed: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the active pill visible without moving the page vertically.
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-cat="${activeId}"]`);
    const box = scroller.current;
    if (!el || !box) return;
    const left = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2;
    box.scrollTo({
      left,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [activeId]);

  return (
    <nav
      aria-label="Categorie del menu"
      inert={!revealed}
      className={cn(
        "fixed inset-x-0 top-[var(--shop-header-h,calc(var(--safe-top)+90px))] z-30 border-b border-line/70 bg-canvas/90 backdrop-blur-xl transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none",
        "lg:sticky lg:inset-x-auto lg:top-[var(--shop-header-h,72px)] lg:translate-y-0 lg:rounded-2xl lg:border lg:bg-surface/90 lg:opacity-100",
        !revealed && "pointer-events-none -translate-y-2 opacity-0 lg:pointer-events-auto",
      )}
    >
      <div ref={scroller} className="scrollbar-none flex gap-1.5 overflow-x-auto px-4 py-2.5 lg:px-2">
        {categories.map((c) => {
          const active = c.id === activeId;
          return (
            <button
              key={c.id}
              type="button"
              data-cat={c.id}
              aria-current={active ? "true" : undefined}
              onClick={() => onSelect(c.id)}
              className={cn(
                "relative shrink-0 tap rounded-full px-4 py-2 text-body-sm font-semibold whitespace-nowrap transition-colors",
                active ? "text-white" : "text-fg-muted hover:text-fg",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="cat-pill"
                  transition={spring.snappy}
                  className="absolute inset-0 -z-0 rounded-full bg-ink-900"
                />
              ) : null}
              <span className="relative">{c.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
