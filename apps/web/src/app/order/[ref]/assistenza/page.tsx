import { isActive } from "@dimsum/domain";
import { ArrowLeft, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SupportForm } from "@/components/support/support-form";
import { Skeleton } from "@/components/ui/feedback";
import { getTracking } from "@/server/services/orders/tracking";

export const metadata: Metadata = {
  title: "Assistenza ordine",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

async function SupportContent({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const order = await getTracking(ref);
  if (!order) notFound();
  const back = `/order/${order.publicId}`;

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 pt-safe backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <Link
            href={back}
            aria-label="Torna all'ordine"
            className="grid size-10 shrink-0 tap place-items-center rounded-full bg-surface ring-1 ring-line"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-caption text-fg-muted">Ordine #{order.number}</p>
            <h1 className="text-title font-extrabold">Assistenza</h1>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-xl space-y-7 px-5 pt-6 pb-[calc(var(--safe-bottom)+32px)]">
        {order.restaurant.phone && isActive(order.status) ? (
          <a
            href={`tel:${order.restaurant.phone}`}
            className="flex tap items-center gap-4 rounded-2xl bg-ink-950 p-4 text-white"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-red-500">
              <Phone className="size-5" />
            </span>
            <span className="text-body-sm">
              <span className="block font-bold">Ordine in corso e problema urgente?</span>
              <span className="block text-white/70">Chiama il ristorante: è il modo più rapido.</span>
            </span>
          </a>
        ) : null}
        <SupportForm
          order={{
            publicId: order.publicId,
            number: order.number,
            isDelivery: order.fulfillmentType === "DELIVERY",
            emailMasked: order.customer.email,
            items: order.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity })),
          }}
          backHref={back}
        />
      </div>
    </>
  );
}

export default function OrderSupportPage({ params }: PageProps<"/order/[ref]/assistenza">) {
  return (
    <main id="contenuto" className="min-h-dvh bg-canvas">
      <Suspense
        fallback={
          <div className="mx-auto max-w-xl space-y-4 p-5">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        }
      >
        <SupportContent params={params} />
      </Suspense>
    </main>
  );
}
