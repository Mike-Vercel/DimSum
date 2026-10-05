import type { Metadata } from "next";
import { Suspense } from "react";
import { GuestOrders, OrdersView } from "@/components/account/orders-view";
import { AccountPageHeader } from "@/components/account/page-header";
import { Skeleton } from "@/components/ui/feedback";
import { getViewer } from "@/server/auth/session";
import { listMyOrders } from "@/server/services/account";
import { recentOrdersFromThisBrowser } from "@/server/services/orders/tracking";

export const metadata: Metadata = { title: "I miei ordini", robots: { index: false, follow: false } };

async function OrdersContent() {
  const viewer = await getViewer();
  if (!viewer) return <GuestOrders orders={await recentOrdersFromThisBrowser()} />;
  const [active, history] = await Promise.all([
    listMyOrders(viewer.userId, { status: "active" }),
    listMyOrders(viewer.userId, { status: "history" }),
  ]);
  return <OrdersView initialActive={active} initialHistory={history} />;
}

export default function OrdersPage() {
  return (
    <>
      <AccountPageHeader title="I miei ordini" />
      <Suspense
        fallback={
          <div className="space-y-3">
            <Skeleton className="h-11 w-72 rounded-full" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        }
      >
        <OrdersContent />
      </Suspense>
    </>
  );
}
