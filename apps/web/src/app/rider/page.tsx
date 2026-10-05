import type { Metadata } from "next";
import { Suspense } from "react";
import { Seal } from "@/components/brand/logo";
import { RiderApp } from "@/components/rider/rider-app";
import { requireRiderPage } from "@/server/auth/session";
import { getRiderHome } from "@/server/services/rider";

export const metadata: Metadata = { title: "Le mie consegne" };

async function Home() {
  const viewer = await requireRiderPage("/rider");
  return <RiderApp initial={await getRiderHome(viewer.userId)} />;
}

export default function RiderPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center" aria-busy="true">
          <Seal className="h-12 animate-pulse text-red-500" />
        </div>
      }
    >
      <Home />
    </Suspense>
  );
}
