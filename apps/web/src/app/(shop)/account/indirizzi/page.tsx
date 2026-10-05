import type { Metadata } from "next";
import { Suspense } from "react";
import { AddressBook } from "@/components/account/address-book";
import { AccountPageHeader } from "@/components/account/page-header";
import { Skeleton } from "@/components/ui/feedback";
import { requireCustomerPage } from "@/server/auth/session";
import { listAddresses } from "@/server/services/account";

export const metadata: Metadata = { title: "Indirizzi", robots: { index: false, follow: false } };

async function Addresses() {
  const viewer = await requireCustomerPage("/account/indirizzi");
  return <AddressBook initial={await listAddresses(viewer.userId)} />;
}

export default function AddressesPage() {
  return (
    <>
      <AccountPageHeader
        title="Indirizzi"
        description="Con citofono, piano e note per il rider: arrivano sempre al posto giusto."
      />
      <Suspense fallback={<Skeleton className="h-48 rounded-2xl" />}>
        <Addresses />
      </Suspense>
    </>
  );
}
