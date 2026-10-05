import type { Metadata } from "next";
import { OffersList } from "@/components/shop/offers-list";
import { getPublicOffers } from "@/server/services/offers";

export const metadata: Metadata = {
  title: "Offerte",
  description:
    "Promozioni attive su ravioli, bao e noodles di DIMSUM Palermo: si applicano da sole nel carrello.",
  alternates: { canonical: "/offerte" },
};

export default async function OffersPage() {
  const offers = await getPublicOffers();
  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 lg:px-8 lg:pt-12">
      <h1 className="mb-6 text-display font-extrabold">Offerte</h1>
      <OffersList offers={offers} />
    </div>
  );
}
