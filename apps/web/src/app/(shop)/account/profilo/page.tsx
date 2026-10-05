import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPageHeader } from "@/components/account/page-header";
import { ProfileSettings } from "@/components/account/profile-settings";
import { Skeleton } from "@/components/ui/feedback";
import { requireCustomerPage } from "@/server/auth/session";
import { features } from "@/server/env";
import { getMe, signInMethods } from "@/server/services/account";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = { title: "Dati personali", robots: { index: false, follow: false } };

async function Profile() {
  const viewer = await requireCustomerPage("/account/profilo");
  const [me, methods, config] = await Promise.all([
    getMe(viewer.userId),
    signInMethods(viewer.userId),
    getRestaurantConfig(),
  ]);
  // The birth date is asked only when it is actually used (Club birthday gift).
  const askBirthday = config.loyalty.enabled && config.loyalty.birthdayBonusPoints > 0;
  return (
    <ProfileSettings
      me={me}
      methods={methods}
      askBirthday={askBirthday}
      googleAvailable={features().googleAuth}
    />
  );
}

export default function ProfilePage() {
  return (
    <>
      <AccountPageHeader title="Dati personali" />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Profile />
      </Suspense>
    </>
  );
}
