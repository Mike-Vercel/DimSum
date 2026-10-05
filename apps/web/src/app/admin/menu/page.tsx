import { can } from "@dimsum/domain";
import type { Metadata } from "next";
import { Suspense } from "react";
import { MenuManager } from "@/components/admin/menu/menu-manager";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { getAdminCatalog } from "@/server/services/admin/catalog";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Menu" };

async function Manager() {
  const viewer = await requireStaffPage("/admin/menu", "catalog:availability");
  const [catalog, config] = await Promise.all([getAdminCatalog(), getRestaurantConfig()]);
  return (
    <MenuManager initial={catalog} canEdit={can(viewer.role, "catalog:edit")} timeZone={config.timezone} />
  );
}

export default function MenuAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[480px] rounded-2xl" />
        </div>
      }
    >
      <Manager />
    </Suspense>
  );
}
