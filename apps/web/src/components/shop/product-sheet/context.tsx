"use client";

import type { CatalogDTO, ProductDTO } from "@dimsum/types";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useCatalog } from "@/lib/catalog";
import { ProductSheet } from "./product-sheet";

interface ProductSheetContextValue {
  catalog: CatalogDTO;
  open(slug: string): void;
  close(): void;
}

const Ctx = createContext<ProductSheetContextValue | null>(null);

const PARAM = "p";

/**
 * Hosts the live catalog and the product detail sheet for a storefront page. The open product
 * is mirrored in the URL (?p=slug) so the back button closes it and links can be shared.
 */
export function CatalogProvider({
  initialCatalog,
  children,
}: {
  initialCatalog: CatalogDTO;
  children: ReactNode;
}) {
  const catalog = useCatalog(initialCatalog);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setSlug(new URLSearchParams(window.location.search).get(PARAM));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const open = useCallback((next: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM, next);
    window.history.pushState(null, "", url);
    setSlug(next);
  }, []);

  const close = useCallback(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PARAM)) return setSlug(null);
    url.searchParams.delete(PARAM);
    window.history.replaceState(null, "", url);
    setSlug(null);
  }, []);

  const product: ProductDTO | null = useMemo(
    () => (slug ? (Object.values(catalog.products).find((p) => p.slug === slug) ?? null) : null),
    [catalog, slug],
  );

  const value = useMemo(() => ({ catalog, open, close }), [catalog, open, close]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <ProductSheet
        product={product}
        bestseller={!!product && catalog.bestsellerIds.includes(product.id)}
        onClose={close}
      />
    </Ctx.Provider>
  );
}

export function useStorefront(): ProductSheetContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStorefront must be used inside CatalogProvider");
  return ctx;
}
