import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountHome, GuestHome } from "@/components/account/account-home";
import { Skeleton } from "@/components/ui/feedback";
import { getViewer } from "@/server/auth/session";
import { getMe, listMyOrders } from "@/server/services/account";
import { loyaltySummary } from "@/server/services/loyalty";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Il mio account", robots: { index: false, follow: false } };

async function AccountContent() {
  const viewer = await getViewer();
  if (!viewer) {
    const config = await getRestaurantConfig();
    return <GuestHome loyaltyName={config.loyalty.enabled ? config.loyalty.programName : null} />;
  }
  const [me, loyalty, active] = await Promise.all([
    getMe(viewer.userId),
    loyaltySummary(viewer.userId),
    listMyOrders(viewer.userId, { status: "active", limit: 3 }),
  ]);
  return <AccountHome me={me} loyalty={loyalty.enabled ? loyalty : null} activeOrders={active.items} />;
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      }
    >
      <AccountContent />
    </Suspense>
  );
}
