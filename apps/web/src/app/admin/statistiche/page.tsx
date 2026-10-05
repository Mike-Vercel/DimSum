import { AnalyticsView } from "@/components/admin/analytics/analytics-view";
import { getAnalytics } from "@/server/services/admin/reports";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Statistiche" };

async function Content() {
  await requireStaffPage("/admin/statistiche", "analytics:read");
  const [analytics, config] = await Promise.all([getAnalytics("7d", {}), getRestaurantConfig()]);
  return <AnalyticsView initial={analytics} timeZone={config.timezone} />;
}

export default function AnalyticsPage() {
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
