import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersList } from "@/components/admin/orders/orders-list";
import { AdminPage } from "@/components/admin/ui";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { listAdminOrders } from "@/server/services/admin/orders";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Ordini" };

async function List() {
  await requireStaffPage("/admin/ordini", "orders:read");
  const [initial, config] = await Promise.all([listAdminOrders({ limit: 50 }), getRestaurantConfig()]);
  return <OrdersList initial={initial} timeZone={config.timezone} />;
}

export default function OrdersPage() {
  return (
    <AdminPage title="Ordini" description="Cerca per numero, cliente, e-mail o telefono.">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <List />
      </Suspense>
    </AdminPage>
  );
}
