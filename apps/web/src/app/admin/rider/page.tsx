import { can } from "@dimsum/domain";
import type { Metadata } from "next";
import { Suspense } from "react";
import { RidersManager } from "@/components/admin/riders/riders-manager";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { listRiders } from "@/server/services/admin/riders";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Rider" };

async function Riders() {
  const viewer = await requireStaffPage("/admin/rider", "riders:assign");
  const [riders, config] = await Promise.all([listRiders(), getRestaurantConfig()]);
  return (
    <RidersManager
      initial={riders}
      restaurant={config.location}
      canManage={can(viewer.role, "riders:manage")}
    />
  );
}

export default function RidersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <Riders />
    </Suspense>
  );
}
