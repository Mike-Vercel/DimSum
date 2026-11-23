import { can } from "@dimsum/domain";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ComboManager } from "@/components/admin/menu/combo-manager";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { getAdminCatalog } from "@/server/services/admin/catalog";
import { listCombos } from "@/server/services/admin/combos";

export const metadata: Metadata = { title: "Combo" };

async function Manager() {
  const viewer = await requireStaffPage("/admin/combo", "catalog:availability");
  const [combos, catalog] = await Promise.all([listCombos(), getAdminCatalog()]);
  return <ComboManager initial={combos} catalog={catalog} canEdit={can(viewer.role, "catalog:edit")} />;
}

export default function ComboAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[420px] rounded-2xl" />
        </div>
      }
    >
      <Manager />
    </Suspense>
  );
}
