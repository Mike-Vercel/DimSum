import type { Metadata } from "next";
import { Suspense } from "react";
import { HoursEditor } from "@/components/admin/hours/hours-editor";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { getHours } from "@/server/services/admin/settings";
import { computeServiceStatus, loadLiveLoad, loadRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Orari e chiusure" };

async function Hours() {
  await requireStaffPage("/admin/orari", "hours:edit");
  const [hours, config, load] = await Promise.all([getHours(), loadRestaurantConfig(), loadLiveLoad()]);
  return <HoursEditor initial={hours} status={computeServiceStatus(config, load, new Date())} />;
}

export default function HoursPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <Hours />
    </Suspense>
  );
}
