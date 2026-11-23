import type { Metadata } from "next";
import { ComboShowcase } from "@/components/shop/combo-showcase";
import { OffersList } from "@/components/shop/offers-list";
import { getCatalog } from "@/server/services/catalog";
import { getPublicOffers } from "@/server/services/offers";

export const metadata: Metadata = {
  title: "Offerte",
  description:
    "Promozioni attive su ravioli, bao e noodles di DIMSUM Palermo: si applicano da sole nel carrello.",
  alternates: { canonical: "/offerte" },
};

export default async function OffersPage() {
  const [offers, catalog] = await Promise.all([getPublicOffers(), getCatalog()]);
  // Combos in menu order: the "Combo" category first, then any combo placed elsewhere.
  const comboIds = catalog.categories.flatMap((c) => c.productIds).filter((id) => catalog.products[id]?.combo);
  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 lg:px-8 lg:pt-12">
      <h1 className="text-display font-extrabold">Offerte</h1>
      <p className="mt-1 mb-8 text-body text-fg-muted">Combo a prezzo speciale e sconti che si applicano da soli.</p>
      <div className="space-y-12">
        <ComboShowcase comboIds={comboIds} />
        <OffersList offers={offers} hasCombos={comboIds.length > 0} />
      </div>
    </div>
  );
}
