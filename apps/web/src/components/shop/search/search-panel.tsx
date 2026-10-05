"use client";

import { buildSearchIndex, formatEuro, searchIndex } from "@dimsum/domain";
import type { ProductDTO } from "@dimsum/types";
import { ArrowLeft, Clock, Search, SearchX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { productAvailable, useNow } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { AddButton } from "../add-button";
import { FoodImage } from "../food-image";
import { useStorefront } from "../product-sheet/context";

const RECENT_KEY = "dimsum.recent-searches";

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function saveRecent(q: string) {
  try {
    const list = [q, ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable (private mode) */
  }
}

function ResultRow({ product, onOpen }: { product: ProductDTO; onOpen: () => void }) {
  const now = useNow();
  const available = productAvailable(product, now);
  return (
    <li className={cn("relative flex items-center gap-3.5 py-3", !available && "opacity-60")}>
      <FoodImage image={product.image} sizes="64px" rounded="rounded-xl" className="size-16 shrink-0" />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className="text-left leading-snug font-semibold after:absolute after:inset-0 after:content-['']"
        >
          {product.name}
        </button>
        <p className="text-body-sm text-fg-muted tabular-nums">
          {formatEuro(product.priceCents)}
          {!available ? " · Esaurito" : ""}
        </p>
      </div>
      <AddButton product={product} disabled={!available} size="sm" className="relative z-10" />
    </li>
  );
}

/** Full-screen search (mobile) / panel (desktop) over the whole menu, instant and typo tolerant. */
export function SearchPanel({ onClose, initialQuery = "" }: { onClose: () => void; initialQuery?: string }) {
  const { catalog, open } = useStorefront();
  const [q, setQ] = useState(initialQuery);
  const [category, setCategory] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const index = useMemo(() => {
    const categoryName = new Map(catalog.categories.map((c) => [c.id, c.name]));
    return buildSearchIndex(
      Object.values(catalog.products).map((p) => ({
        id: p.id,
        name: p.name,
        nameZh: p.nameZh,
        description: p.description,
        ingredients: p.ingredients,
        categoryName: categoryName.get(p.categoryId) ?? "",
        posCode: p.posCode,
      })),
    );
  }, [catalog]);

  const results = useMemo(() => {
    const base = q.trim()
      ? searchIndex(index, q, 60).map((h) => catalog.products[h.id]!)
      : category
        ? Object.values(catalog.products)
        : [];
    return category ? base.filter((p) => p.categoryId === category) : base;
  }, [index, q, category, catalog]);

  const openProduct = (p: ProductDTO) => {
    if (q.trim().length >= 2) saveRecent(q.trim());
    onClose();
    // Let the overlay unmount before the sheet takes focus.
    requestAnimationFrame(() => open(p.slug));
  };

  const showRecent = !q.trim() && !category && recent.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pt-[calc(var(--safe-top)+12px)] pb-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi ricerca"
          className="grid size-10 shrink-0 tap place-items-center rounded-full hover:bg-surface md:hidden"
        >
          <ArrowLeft className="size-5" />
        </button>
        <label className="relative flex-1">
          <span className="sr-only">Cerca nel menu</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-fg-subtle"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && results[0]) openProduct(results[0]);
            }}
            placeholder="Cerca un piatto, un ingrediente…"
            className="h-12 w-full rounded-full bg-surface pr-11 pl-12 text-body ring-1 ring-line outline-none focus:ring-2 focus:ring-ink-900 [&::-webkit-search-cancel-button]:hidden"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Cancella"
              className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full hover:bg-surface-3"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </label>
        <button type="button" onClick={onClose} className="hidden px-3 text-body-sm font-semibold md:block">
          Chiudi
        </button>
      </div>

      <div className="scrollbar-none flex gap-2 overflow-x-auto mask-fade-x px-4 pb-3">
        <Chip selected={category === null} onClick={() => setCategory(null)}>
          Tutti
        </Chip>
        {catalog.categories.map((c) => (
          <Chip
            key={c.id}
            selected={category === c.id}
            onClick={() => setCategory(category === c.id ? null : c.id)}
          >
            {c.name}
          </Chip>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(var(--safe-bottom)+24px)]">
        {showRecent ? (
          <section aria-label="Ricerche recenti" className="pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-caption font-semibold tracking-wide text-fg-muted uppercase">Recenti</h2>
              <button
                type="button"
                className="text-caption font-semibold text-brand-ink"
                onClick={() => {
                  localStorage.removeItem(RECENT_KEY);
                  setRecent([]);
                }}
              >
                Cancella
              </button>
            </div>
            <ul className="mt-2 divide-y divide-line">
              {recent.map((r) => (
                <li key={r}>
                  <button
                    type="button"
                    onClick={() => setQ(r)}
                    className="flex w-full items-center gap-3 py-3 text-left"
                  >
                    <Clock className="size-4 text-fg-subtle" aria-hidden /> {r}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {(q.trim() || category) && results.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={`Nessun risultato per “${q.trim()}”`}
            description="Prova con un altro piatto o un ingrediente: ravioli, bao, noodles, gamberi…"
          />
        ) : null}

        {results.length > 0 ? (
          <>
            <p className="pt-1 text-caption text-fg-muted" aria-live="polite">
              {results.length} {results.length === 1 ? "risultato" : "risultati"}
            </p>
            <ul className="divide-y divide-line">
              {results.map((p) => (
                <ResultRow key={p.id} product={p} onOpen={() => openProduct(p)} />
              ))}
            </ul>
          </>
        ) : null}

        {!q.trim() && !category && !showRecent ? (
          <p className="pt-6 text-center text-body-sm text-fg-muted">
            Cerca per nome, ingrediente o categoria. Funziona anche con qualche errore di battitura.
          </p>
        ) : null}
      </div>
    </div>
  );
}
