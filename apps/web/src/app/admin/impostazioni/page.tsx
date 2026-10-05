import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsEditor } from "@/components/admin/settings/settings-editor";
import { Skeleton } from "@/components/ui/feedback";
import { requireStaffPage } from "@/server/auth/session";
import { features } from "@/server/env";
import { getSettings } from "@/server/services/admin/settings";

export const metadata: Metadata = { title: "Impostazioni" };

async function Settings() {
  await requireStaffPage("/admin/impostazioni", "settings:edit");
  return (
    <SettingsEditor initial={await getSettings()} paymentsLive={features().paymentProvider === "stripe"} />
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <Settings />
    </Suspense>
  );
}
