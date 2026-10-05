import { AuditLog } from "@/components/admin/people/team";
import { listAudit } from "@/server/services/admin/team";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Registro attività" };

async function Content() {
  await requireStaffPage("/admin/registro", "audit:read");
  const [entries, config] = await Promise.all([listAudit({}), getRestaurantConfig()]);
  return <AuditLog initial={entries} timeZone={config.timezone} />;
}

export default function AuditPage() {
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
