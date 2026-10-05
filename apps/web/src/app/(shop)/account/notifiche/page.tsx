import type { Metadata } from "next";
import { Suspense } from "react";
import { NotificationCenter } from "@/components/account/notification-center";
import { AccountPageHeader } from "@/components/account/page-header";
import { Skeleton } from "@/components/ui/feedback";
import { requireCustomerPage } from "@/server/auth/session";
import { listNotifications } from "@/server/services/inbox";

export const metadata: Metadata = { title: "Notifiche", robots: { index: false, follow: false } };

async function Inbox() {
  const viewer = await requireCustomerPage("/account/notifiche");
  return <NotificationCenter initial={await listNotifications(viewer.userId)} userId={viewer.userId} />;
}

export default function NotificationsPage() {
  return (
    <>
      <AccountPageHeader title="Notifiche" />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Inbox />
      </Suspense>
    </>
  );
}
