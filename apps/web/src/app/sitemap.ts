import type { MetadataRoute } from "next";
import { appUrl } from "@/server/env";
import { getCatalog } from "@/server/services/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await getCatalog();
  const pages: MetadataRoute.Sitemap = [
    { url: appUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: appUrl("/menu"), changeFrequency: "daily", priority: 0.9 },
    { url: appUrl("/offerte"), changeFrequency: "weekly", priority: 0.6 },
    { url: appUrl("/info"), changeFrequency: "monthly", priority: 0.6 },
    { url: appUrl("/club"), changeFrequency: "monthly", priority: 0.4 },
    { url: appUrl("/supporto"), changeFrequency: "monthly", priority: 0.3 },
    { url: appUrl("/privacy"), changeFrequency: "yearly", priority: 0.1 },
    { url: appUrl("/cookie"), changeFrequency: "yearly", priority: 0.1 },
    { url: appUrl("/termini"), changeFrequency: "yearly", priority: 0.1 },
  ];
  const products = Object.values(catalog.products).map((p) => ({
    url: appUrl(`/product/${p.slug}`),
    changeFrequency: "weekly" as const,
    priority: 0.7,
    ...(p.image ? { images: [appUrl(p.image.url)] } : {}),
  }));
  return [...pages, ...products];
}
