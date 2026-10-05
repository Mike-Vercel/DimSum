import { CouponsManager } from "@/components/admin/promotions/coupons-manager";
import { getAdminCatalog } from "@/server/services/admin/catalog";
import { listCoupons } from "@/server/services/admin/promotions";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Coupon e offerte" };

async function Content() {
  await requireStaffPage("/admin/coupon", "coupons:manage");
  const [coupons, catalog, config] = await Promise.all([
    listCoupons(),
    getAdminCatalog(),
    getRestaurantConfig(),
  ]);
  return <CouponsManager initial={coupons} categories={catalog.categories} timeZone={config.timezone} />;
}

export default function CouponsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <Content />
    </Suspense>
  );
}
