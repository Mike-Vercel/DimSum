import { firstNameOf } from "@dimsum/domain";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/components/admin/dashboard";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { getDashboard } from "@/server/services/admin/reports";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Dashboard" };

async function Content() {
  const viewer = await requireStaffPage("/admin", "orders:read");
  const [dashboard, config] = await Promise.all([getDashboard(), getRestaurantConfig()]);
  return <Dashboard initial={dashboard} firstName={firstNameOf(viewer.name)} timeZone={config.timezone} />;
}

export default function AdminHomePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 p-8">
          <Skeleton className="h-10 w-72" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      }
    >
      <Content />
    </Suspense>
  );
}
