import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SupportInbox } from "@/components/admin/support/support-inbox";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { listTickets } from "@/server/services/admin/support";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Richiesta di assistenza" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Inbox({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage("/admin/assistenza", "support:manage");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [tickets, config] = await Promise.all([listTickets({ status: "open" }), getRestaurantConfig()]);
  return <SupportInbox initial={tickets} selectedId={id} timeZone={config.timezone} />;
}

export default function SupportTicketPage({ params }: PageProps<"/admin/assistenza/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <Inbox params={params} />
    </Suspense>
  );
}
