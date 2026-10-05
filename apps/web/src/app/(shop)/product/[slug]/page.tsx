import { formatEuro } from "@dimsum/domain";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductTile } from "@/components/shop/product-card";
import { ProductDetail } from "@/components/shop/product-sheet/product-detail";
import { appUrl } from "@/server/env";
import { jsonLdScript } from "@/server/seo";
import { getCatalog, getProductBySlug } from "@/server/services/catalog";

export async function generateStaticParams() {
  const catalog = await getCatalog();
  return Object.values(catalog.products).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const found = await getProductBySlug(slug);
  if (!found) return { title: "Prodotto non trovato" };
  const { product, category } = found;
  const description = `${product.description ?? category.name} — ${formatEuro(product.priceCents)}. Ordina online da DIMSUM Palermo: consegna o ritiro.`;
  return {
    title: `${product.name} · ${category.name}`,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: { title: product.name, description, url: `/product/${product.slug}`, type: "website" },
  };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const [found, catalog] = await Promise.all([getProductBySlug(slug), getCatalog()]);
  if (!found) notFound();
  const { product, category } = found;
  const related = category.productIds.filter((id) => id !== product.id).slice(0, 4);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MenuItem",
    name: product.name,
    description: product.description ?? undefined,
    image: product.image ? appUrl(product.image.url) : undefined,
    url: appUrl(`/product/${product.slug}`),
    menuAddOn: product.modifierGroups.flatMap((g) =>
      g.options.map((o) => ({ "@type": "MenuItem", name: o.name })),
    ),
    offers: { "@type": "Offer", price: (product.priceCents / 100).toFixed(2), priceCurrency: "EUR" },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-3 pb-12 lg:px-8 lg:pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <nav aria-label="Percorso" className="mb-4 flex items-center gap-1 text-body-sm text-fg-muted">
        <ChevronLeft className="size-4" aria-hidden />
        <Link href={`/menu#${category.slug}`} className="font-semibold hover:text-fg">
          {category.name}
        </Link>
      </nav>
      <div className="mx-auto max-w-xl overflow-hidden rounded-3xl bg-canvas lg:shadow-sm lg:ring-1 lg:ring-line/70">
        <ProductDetail
          product={product}
          bestseller={catalog.bestsellerIds.includes(product.id)}
          layout="page"
        />
      </div>
      {related.length ? (
        <section aria-labelledby="correlati" className="mt-12 space-y-4">
          <h2 id="correlati" className="text-title font-bold">
            Altri {category.name.toLowerCase()}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {related.map((id) => {
              const p = catalog.products[id];
              return p ? <ProductTile key={id} product={p} sizes="(min-width: 768px) 25vw, 50vw" /> : null;
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
