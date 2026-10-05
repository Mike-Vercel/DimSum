import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TrackingView } from "@/components/tracking/tracking-view";
import { Skeleton } from "@/components/ui/feedback";
import { getTracking } from "@/server/services/orders/tracking";

export const metadata: Metadata = {
  title: "Il tuo ordine",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const viewport: Viewport = { themeColor: "#0e0d0c" };

function TrackingSkeleton() {
  return (
    <div data-theme="dark" className="min-h-dvh bg-canvas">
      <Skeleton className="h-[42dvh] rounded-none" />
      <div className="space-y-4 p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

async function OrderContent({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const tracking = await getTracking(ref);
  if (!tracking) notFound();
  return <TrackingView initial={tracking} />;
}

/** Public tracking page: the unguessable reference in the URL is the access token. */
export default function OrderPage({ params }: PageProps<"/order/[ref]">) {
  return (
    <main id="contenuto">
      <Suspense fallback={<TrackingSkeleton />}>
        <OrderContent params={params} />
      </Suspense>
    </main>
  );
}
