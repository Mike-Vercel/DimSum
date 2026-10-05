import { TeamManager } from "@/components/admin/people/team";
import { listStaff } from "@/server/services/admin/team";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Team" };

async function Content() {
  const viewer = await requireStaffPage("/admin/team", "staff:manage");
  const [staff, config] = await Promise.all([listStaff(), getRestaurantConfig()]);
  return <TeamManager initial={staff} viewerId={viewer.userId} timeZone={config.timezone} />;
}

export default function TeamPage() {
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
