import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPageHeader } from "@/components/account/page-header";
import { PrivacyCenter } from "@/components/account/privacy-center";
import { Skeleton } from "@/components/ui/feedback";
import { requireCustomerPage } from "@/server/auth/session";
import { getMe } from "@/server/services/account";

export const metadata: Metadata = { title: "Privacy e dati", robots: { index: false, follow: false } };

async function Privacy() {
  const viewer = await requireCustomerPage("/account/privacy");
  return <PrivacyCenter me={await getMe(viewer.userId)} />;
}

export default function PrivacyPage() {
  return (
    <>
      <AccountPageHeader title="Privacy e dati" description="Decidi tu cosa riceviamo e cosa conserviamo." />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Privacy />
      </Suspense>
    </>
  );
}
