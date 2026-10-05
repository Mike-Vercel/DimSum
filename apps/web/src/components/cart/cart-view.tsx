"use client";

import { formatEuro } from "@dimsum/domain";
import type { CartQuoteDTO, CheckoutBlocker } from "@dimsum/types";
import { ArrowLeft, ArrowRight, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FulfillmentSwitch } from "@/components/shop/fulfillment-switch";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useCartQuote } from "@/lib/cart-quote";
import { useOffline } from "@/lib/connectivity";
import { selectEstimatedSubtotal, useCart } from "@/lib/stores/cart";
import { useHydrated } from "@/lib/stores/hydration";
import { CartIssues } from "./cart-issues";
import { CartLines } from "./cart-lines";
import { CartSummary } from "./cart-summary";
import { CouponField } from "./coupon-field";
import { CartSuggestions } from "./suggestions";

/** Blockers that the checkout itself resolves (address, schedule) do not stop the customer here. */
const RESOLVED_IN_CHECKOUT: CheckoutBlocker[] = [
  "ADDRESS_REQUIRED",
  "OUT_OF_ZONE",
  "RESTAURANT_CLOSED",
  "SLOT_UNAVAILABLE",
];

export function blockerMessage(b: CheckoutBlocker): string {
  switch (b) {
    case "EMPTY_CART":
      return "Il carrello è vuoto";
    case "CART_ISSUES":
      return "Rimuovi i prodotti non disponibili";
    case "BELOW_MINIMUM":
      return "Minimo d'ordine non raggiunto";
    case "ORDERS_PAUSED":
      return "Al momento non accettiamo nuovi ordini";
    case "FULFILLMENT_UNAVAILABLE":
      return "Modalità non disponibile";
    case "RESTAURANT_CLOSED":
      return "Siamo chiusi: programma l'ordine";
    case "OUT_OF_ZONE":
      return "Indirizzo fuori zona";
    case "ADDRESS_REQUIRED":
      return "Inserisci l'indirizzo";
    case "SLOT_UNAVAILABLE":
      return "Scegli un altro orario";
  }
}

export function useCheckoutGate(quote: CartQuoteDTO | undefined) {
  const hard = quote?.blockers.filter((b) => !RESOLVED_IN_CHECKOUT.includes(b)) ?? [];
  return { canProceed: !!quote && hard.length === 0, reason: hard[0] ? blockerMessage(hard[0]) : null };
}

export function CartView() {
  const hydrated = useHydrated();
  const router = useRouter();
  const offline = useOffline();
  const count = useCart((s) => s.lines.length);
  const estimate = useCart(selectEstimatedSubtotal);
  const { data: quote, isError, refetch, settling } = useCartQuote();
  const gate = useCheckoutGate(quote);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  if (count === 0) {
    return (
      <EmptyState
        className="py-20"
        icon={ShoppingBag}
        title="Il carrello è vuoto"
        description="Ravioli, bao, noodles: scegli i tuoi piatti preferiti dal menu."
        action={
          <Button asChild size="lg">
            <Link href="/menu">Sfoglia il menu</Link>
          </Button>
        }
      />
    );
  }

  const total = quote?.totals.totalCents ?? estimate;
  const cta = (
    <Button
      size="xl"
      block
      disabled={!gate.canProceed || settling || offline}
      onClick={() => router.push("/checkout")}
      className="h-14"
    >
      {offline ? (
        "Sei offline"
      ) : gate.reason ? (
        gate.reason
      ) : (
        <>
          Vai al checkout <span aria-hidden>•</span> <span className="tabular-nums">{formatEuro(total)}</span>
          <ArrowRight className="size-5" />
        </>
      )}
    </Button>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pt-2 pb-36 lg:px-8 lg:pt-8 lg:pb-12">
      <div className="flex items-center gap-2 py-2 lg:py-0">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Indietro"
          className="grid size-10 tap place-items-center rounded-full hover:bg-surface lg:hidden"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-headline font-extrabold">Il tuo carrello</h1>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-8 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="space-y-6">
          <FulfillmentSwitch className="max-w-sm" />
          <CartIssues quote={quote} />
          <CartLines quote={quote} />
          <CartSuggestions />
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24">
          <div className="space-y-5 rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-line/70">
            <CouponField quote={quote} loading={settling} />
            {isError && !quote ? (
              <ErrorState onRetry={() => void refetch()} offline={offline} className="py-6" />
            ) : (
              <CartSummary quote={quote} loading={settling} />
            )}
            <div className="hidden lg:block">{cta}</div>
          </div>
          <p className="px-2 text-caption text-fg-muted">
            Il costo di consegna e il minimo d&apos;ordine dipendono dalla zona: li confermiamo al checkout
            dopo l&apos;indirizzo.
          </p>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 px-4 pt-3 pb-[calc(var(--safe-bottom)+12px)] backdrop-blur-md lg:hidden">
        {cta}
      </div>
    </div>
  );
}
