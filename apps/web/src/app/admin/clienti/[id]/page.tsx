import { notFound } from "next/navigation";
import { CustomerDetail } from "@/components/admin/people/customers";
import { isAppError } from "@/server/errors";
import { getCustomer } from "@/server/services/admin/team";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Cliente" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage("/admin/clienti", "customers:read");
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const [customer, config] = await Promise.all([
    getCustomer(id).catch((error: unknown) => {
      if (isAppError(error) && error.code === "NOT_FOUND") notFound();
      throw error;
    }),
    getRestaurantConfig(),
  ]);
  return <CustomerDetail customer={customer} timeZone={config.timezone} />;
}

export default function CustomerPage({ params }: PageProps<"/admin/clienti/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <Content params={params} />
    </Suspense>
  );
}
