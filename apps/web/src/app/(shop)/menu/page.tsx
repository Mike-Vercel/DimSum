import type { Metadata } from "next";
import { MenuView } from "@/components/shop/menu/menu-view";
import { jsonLdScript, menuJsonLd } from "@/server/seo";
import { getCatalog } from "@/server/services/catalog";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = {
  title: "Menu: ravioli, bao, noodles e dolci",
  description:
    "Il menu completo di DIMSUM Palermo: ravioli al vapore e alla piastra, bao, noodles in brodo e saltati, riso, piatti caldi, mochi e bevande. Ordina online con consegna o ritiro.",
  alternates: { canonical: "/menu" },
  openGraph: { title: "Menu DIMSUM · Asian street food a Palermo", url: "/menu" },
};

export default async function MenuPage() {
  const [catalog, config] = await Promise.all([getCatalog(), getRestaurantConfig()]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(menuJsonLd(config, catalog)) }}
      />
      <MenuView />
    </>
  );
}
