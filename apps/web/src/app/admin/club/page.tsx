import { ClubManager } from "@/components/admin/promotions/club-manager";
import { getLoyaltyAdmin } from "@/server/services/admin/promotions";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";

export const metadata: Metadata = { title: "Dimsum Club" };

async function Content() {
  await requireStaffPage("/admin/club", "loyalty:manage");
  return <ClubManager initial={await getLoyaltyAdmin()} />;
}

export default function ClubPage() {
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
