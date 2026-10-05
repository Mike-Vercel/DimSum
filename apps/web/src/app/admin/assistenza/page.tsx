import type { Metadata } from "next";
import { Suspense } from "react";
import { SupportInbox } from "@/components/admin/support/support-inbox";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { listTickets } from "@/server/services/admin/support";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Assistenza" };

async function Inbox() {
  await requireStaffPage("/admin/assistenza", "support:manage");
  const [tickets, config] = await Promise.all([listTickets({ status: "open" }), getRestaurantConfig()]);
  return <SupportInbox initial={tickets} selectedId={null} timeZone={config.timezone} />;
}

export default function SupportPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <Inbox />
    </Suspense>
  );
}
