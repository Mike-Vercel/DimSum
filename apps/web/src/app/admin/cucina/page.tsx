import type { Metadata } from "next";
import { Suspense } from "react";
import { KitchenBoard } from "@/components/admin/kitchen/kitchen-board";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { getKitchenBoard } from "@/server/services/admin/orders";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Cucina" };

async function Board() {
  await requireStaffPage("/admin/cucina", "orders:manage");
  const [board, config] = await Promise.all([getKitchenBoard(), getRestaurantConfig()]);
  return <KitchenBoard initial={board} timeZone={config.timezone} />;
}

export default function KitchenPage() {
  return (
    <Suspense
      fallback={
        <div className="grid gap-4 p-6 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      }
    >
      <Board />
    </Suspense>
  );
}
