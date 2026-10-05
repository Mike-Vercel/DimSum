import type { Metadata } from "next";
import { Suspense } from "react";
import { ZonesEditor } from "@/components/admin/zones/zones-editor";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { listZones } from "@/server/services/admin/settings";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Zone di consegna" };

async function Zones() {
  await requireStaffPage("/admin/zone", "zones:edit");
  const [zones, config] = await Promise.all([listZones(), getRestaurantConfig()]);
  return <ZonesEditor initial={zones} restaurant={config.location} />;
}

export default function ZonesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[560px] rounded-2xl" />
        </div>
      }
    >
      <Zones />
    </Suspense>
  );
}
