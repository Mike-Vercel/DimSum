import { TicketX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PromoApplier } from "@/components/shop/promo-applier";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { findPromoByCode } from "@/server/services/offers";

export const metadata: Metadata = { title: "Promozione", robots: { index: false, follow: true } };

// Promo codes are created in the admin at any time: no build-time shell for this route.
export const instant = false;

async function Promo({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const promo = await findPromoByCode(decodeURIComponent(code));
  if (promo) return <PromoApplier promo={promo} />;
  return (
    <div className="mx-auto max-w-lg rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
      <TicketX className="mx-auto size-10 text-fg-muted" />
      <h1 className="text-title-lg mt-4 font-bold">Promozione non disponibile</h1>
      <p className="mt-2 text-body text-fg-muted">
        Il codice è scaduto o non è più attivo. Guarda le offerte di oggi.
      </p>
      <Button asChild size="lg" className="mt-6">
        <Link href="/offerte">Vedi le offerte</Link>
      </Button>
    </div>
  );
}

export default function PromoPage({ params }: PageProps<"/promo/[code]">) {
  return (
    <div className="px-4 pt-10 pb-16">
      <Suspense fallback={<Skeleton className="mx-auto h-80 max-w-lg rounded-3xl" />}>
        <Promo params={params} />
      </Suspense>
    </div>
  );
}
