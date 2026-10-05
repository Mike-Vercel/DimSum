import type { Metadata } from "next";
import { ClubComingSoon, ClubView } from "@/components/shop/club-view";
import { db } from "@/server/db";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = {
  title: "Dimsum Club",
  description: "Il programma fedeltà di DIMSUM Palermo.",
  alternates: { canonical: "/club" },
};

export default async function ClubPage() {
  const config = await getRestaurantConfig();
  const { loyalty } = config;
  const rewards = loyalty.enabled
    ? await db.loyaltyReward.findMany({
        where: { isActive: true },
        orderBy: [{ position: "asc" }, { pointsCost: "asc" }],
        select: { id: true, name: true, description: true, pointsCost: true },
      })
    : [];
  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 pb-16 lg:px-8 lg:pt-12">
      {loyalty.enabled ? (
        <ClubView programName={loyalty.programName} pointsPerEuro={loyalty.pointsPerEuro} rewards={rewards} />
      ) : (
        <ClubComingSoon programName={loyalty.programName} />
      )}
    </div>
  );
}
