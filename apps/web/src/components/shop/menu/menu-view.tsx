"use client";

import { isAvailableNow } from "@dimsum/domain";
import { useCallback, useEffect, useRef, useState } from "react";
import { CartPanel } from "@/components/cart/cart-panel";
import { useNow } from "@/lib/catalog";
import { CategoryCircles } from "../category-circles";
import { ProductRow, ProductTile } from "../product-card";
import { useStorefront } from "../product-sheet/context";
import { CategoryNav } from "./category-nav";

/** Full menu: circles, scroll-synced category bar, sections, desktop side cart. */
export function MenuView() {
  const { catalog } = useStorefront();
  const now = useNow();
  const [activeId, setActiveId] = useState<string | null>(catalog.categories[0]?.id ?? null);
  const lockUntil = useRef(0);
  const circles = useRef<HTMLDivElement>(null);
  const [pillsRevealed, setPillsRevealed] = useState(false);
  const sections = useRef(new Map<string, HTMLElement>());
  const best = new Set(catalog.bestsellerIds);

  // Scroll spy: the active category is the last section whose top passed under the sticky bars.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < lockUntil.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0];
        if (first) setActiveId(first.target.getAttribute("data-category"));
      },
      { rootMargin: "-150px 0px -55% 0px", threshold: 0 },
    );
    sections.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [catalog.categories]);

  const scrollTo = useCallback((id: string) => {
    const el = sections.current.get(id);
    if (!el) return;
    setActiveId(id);
    lockUntil.current = Date.now() + 900;
    el.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    history.replaceState(null, "", `#${el.id}`);
  }, []);

  // Phones: the first screen shows the category circles; the pill bar appears only once they have
  // scrolled away under the header, and hides again when they come back.
  useEffect(() => {
    const el = circles.current;
    if (!el) return;
    const headerHeight = Math.round(document.querySelector("header")?.getBoundingClientRect().height ?? 90);
    const observer = new IntersectionObserver(
      ([entry]) =>
        setPillsRevealed(!!entry && !entry.isIntersecting && entry.boundingClientRect.top < headerHeight),
      { rootMargin: `-${headerHeight}px 0px 0px 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Deep links (/menu#bao-al-vapore) after hydration.
  useEffect(() => {
    const hash = decodeURIComponent(location.hash.slice(1));
    const category = catalog.categories.find((c) => c.slug === hash);
    if (category) requestAnimationFrame(() => scrollTo(category.id));
  }, [catalog.categories, scrollTo]);

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-8">
      <h1 className="pt-3 pb-4 text-headline font-extrabold lg:pt-8 lg:text-display">Menu</h1>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
        <div>
          <div ref={circles} className="mb-4 lg:hidden">
            <CategoryCircles activeId={activeId} onSelect={scrollTo} />
          </div>
          <CategoryNav
            categories={catalog.categories}
            activeId={activeId}
            onSelect={scrollTo}
            revealed={pillsRevealed}
          />

          <div className="space-y-10 pt-6 pb-10">
            {catalog.categories.map((c, ci) => (
              <section
                key={c.id}
                id={c.slug}
                data-category={c.id}
                ref={(el) => {
                  if (el) sections.current.set(c.id, el);
                  else sections.current.delete(c.id);
                }}
                className="scroll-mt-40 lg:scroll-mt-36"
                aria-labelledby={`h-${c.slug}`}
              >
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <h2 id={`h-${c.slug}`} className="text-title font-extrabold lg:text-headline">
                    {c.name}
                  </h2>
                  <span className="text-caption text-fg-subtle">
                    {
                      c.productIds.filter(
                        (id) => catalog.products[id] && isAvailableNow(catalog.products[id], now),
                      ).length
                    }{" "}
                    piatti
                  </span>
                </div>
                {c.description ? (
                  <p className="-mt-2 mb-4 text-body-sm text-fg-muted">{c.description}</p>
                ) : null}
                <div className="grid gap-3 md:hidden">
                  {c.productIds.map((id, i) => {
                    const p = catalog.products[id];
                    return p ? (
                      <ProductRow
                        key={id}
                        product={p}
                        bestseller={best.has(id)}
                        priority={ci === 0 && i < 3}
                      />
                    ) : null;
                  })}
                </div>
                <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
                  {c.productIds.map((id, i) => {
                    const p = catalog.products[id];
                    return p ? (
                      <ProductTile
                        key={id}
                        product={p}
                        bestseller={best.has(id)}
                        priority={ci === 0 && i < 3}
                        sizes="(min-width: 1280px) 280px, 40vw"
                      />
                    ) : null;
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 pt-1">
            <CartPanel />
          </div>
        </aside>
      </div>
    </div>
  );
}
