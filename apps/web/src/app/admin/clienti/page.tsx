import { CustomersList } from "@/components/admin/people/customers";
import { listCustomers } from "@/server/services/admin/team";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Clienti" };

async function Content() {
  await requireStaffPage("/admin/clienti", "customers:read");
  const [customers, config] = await Promise.all([listCustomers({}), getRestaurantConfig()]);
  return <CustomersList initial={customers} timeZone={config.timezone} />;
}

export default function CustomersPage() {
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
