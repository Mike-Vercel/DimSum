import { can } from "@dimsum/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderDetail } from "@/components/admin/orders/order-detail";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { isAppError } from "@/server/errors";
import { getAdminOrder } from "@/server/services/admin/orders";
import { listRiders } from "@/server/services/admin/riders";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Dettaglio ordine" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireStaffPage("/admin/ordini", "orders:read");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const order = await getAdminOrder(id).catch((error: unknown) => {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  });
  const [riders, config] = await Promise.all([listRiders(), getRestaurantConfig()]);
  return (
    <OrderDetail
      initial={order}
      riders={riders}
      timeZone={config.timezone}
      canRefund={can(viewer.role, "orders:refund")}
    />
  );
}

export default function OrderDetailPage({ params }: PageProps<"/admin/ordini/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-8">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <Detail params={params} />
    </Suspense>
  );
}
