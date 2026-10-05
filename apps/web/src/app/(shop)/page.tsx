import { Bike, CircleCheck, Clock, UtensilsCrossed } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { CategoryCircles } from "@/components/shop/category-circles";
import { FulfillmentSwitch } from "@/components/shop/fulfillment-switch";
import { Highlights } from "@/components/shop/highlights";
import { DesktopHero, MobileHero } from "@/components/shop/home-hero";
import { OffersStrip } from "@/components/shop/offers-strip";
import { SearchOverlayTrigger } from "@/components/shop/search/search-trigger";
import { ServiceStatusBanner } from "@/components/shop/service-status";
import { Skeleton } from "@/components/ui/feedback";
import { SectionTitle } from "@/components/ui/misc";
import { jsonLdScript, restaurantJsonLd } from "@/server/seo";
import { getCatalog } from "@/server/services/catalog";
import { getPublicOffers } from "@/server/services/offers";
import { getRestaurantConfig, getServiceStatus } from "@/server/services/restaurant";

async function LiveStatus() {
  await connection();
  const status = await getServiceStatus();
  return <ServiceStatusBanner initial={status} />;
}

const STEPS = [
  {
    icon: UtensilsCrossed,
    title: "Scegli dal menu",
    text: "Ravioli, bao, noodles e dolci: oltre cento piatti, con allergeni e ingredienti.",
  },
  {
    icon: CircleCheck,
    title: "Paga in sicurezza",
    text: "Carta, Apple Pay o Google Pay. Anche senza account, come ospite.",
  },
  {
    icon: Bike,
    title: "Seguilo in tempo reale",
    text: "Dalla cucina alla tua porta, con il rider sulla mappa e l'orario di arrivo.",
  },
] as const;

export default async function HomePage() {
  const [catalog, offers, config] = await Promise.all([
    getCatalog(),
    getPublicOffers(),
    getRestaurantConfig(),
  ]);
  const bySlug = (slug: string) => catalog.categories.find((c) => c.slug === slug);
  const noodles = bySlug("noodles-in-brodo") ?? catalog.categories[0];
  const heroImages = ["ravioli-al-vapore", "noodles-in-brodo", "bao-al-vapore"].map(
    (s) => bySlug(s)?.image ?? null,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pt-3 lg:px-8 lg:pt-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(restaurantJsonLd(config, catalog)) }}
      />
      <DesktopHero images={heroImages} />

      <div className="mt-1 space-y-7 lg:mt-10 lg:space-y-14">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-center lg:gap-5">
          <FulfillmentSwitch />
          <Suspense fallback={<Skeleton className="h-12 rounded-2xl" />}>
            <LiveStatus />
          </Suspense>
        </div>

        <MobileHero image={noodles?.image ?? null} href={`/menu#${noodles?.slug ?? ""}`} />

        <div className="lg:hidden">
          <SearchOverlayTrigger variant="bar" />
        </div>

        <section aria-labelledby="categorie" className="space-y-4">
          <SectionTitle title={<span id="categorie">Cosa ti va oggi?</span>} />
          <CategoryCircles />
        </section>

        <Highlights />

        <OffersStrip offers={offers} />

        <section
          aria-labelledby="come-funziona"
          className="rounded-3xl bg-surface p-6 shadow-xs ring-1 ring-line/70 lg:p-10"
        >
          <h2 id="come-funziona" className="text-title font-bold lg:text-headline">
            Ordina direttamente da noi
          </h2>
          <p className="mt-1 text-body-sm text-fg-muted">
            Niente intermediari: il tuo ordine arriva subito in cucina.
          </p>
          <ol className="mt-6 grid gap-5 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-bold">
                    <span className="text-fg-subtle tabular-nums">{i + 1}. </span>
                    {title}
                  </p>
                  <p className="mt-0.5 text-body-sm text-fg-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 flex items-center gap-2 text-caption text-fg-muted">
            <Clock className="size-4" aria-hidden /> Ordini online ogni giorno negli orari di servizio ·
            prezzi IVA inclusa
          </p>
        </section>
      </div>
    </div>
  );
}
