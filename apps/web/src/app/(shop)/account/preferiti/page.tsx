import type { Metadata } from "next";
import { Suspense } from "react";
import { FavoritesView } from "@/components/account/favorites-view";
import { AccountPageHeader } from "@/components/account/page-header";
import { Skeleton } from "@/components/ui/feedback";
import { requireCustomerPage } from "@/server/auth/session";

export const metadata: Metadata = { title: "Preferiti", robots: { index: false, follow: false } };

async function Guarded() {
  await requireCustomerPage("/account/preferiti");
  return <FavoritesView />;
}

export default function FavoritesPage() {
  return (
    <>
      <AccountPageHeader title="Preferiti" description="I piatti che ami, pronti da riordinare." />
      <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
        <Guarded />
      </Suspense>
    </>
  );
}
