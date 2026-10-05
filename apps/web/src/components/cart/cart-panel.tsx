"use client";

import { formatEuro } from "@dimsum/domain";
import { ArrowRight, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { FulfillmentSwitch } from "@/components/shop/fulfillment-switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { useCartQuote } from "@/lib/cart-quote";
import { selectEstimatedSubtotal, useCart } from "@/lib/stores/cart";
import { useHydrated } from "@/lib/stores/hydration";
import { CartLines } from "./cart-lines";
import { CartSummary } from "./cart-summary";
import { useCheckoutGate } from "./cart-view";

/** Sticky cart beside the desktop menu (spec §57). */
export function CartPanel() {
  const hydrated = useHydrated();
  const count = useCart((s) => s.lines.length);
  const estimate = useCart(selectEstimatedSubtotal);
  const { data: quote, settling } = useCartQuote();
  const gate = useCheckoutGate(quote);

  return (
    <section
      aria-label="Il tuo ordine"
      className="flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-3xl bg-surface shadow-sm ring-1 ring-line/70"
    >
      <div className="space-y-3 border-b border-line p-5">
        <h2 className="text-title-sm font-extrabold">Il tuo ordine</h2>
        <FulfillmentSwitch />
      </div>
      {!hydrated ? (
        <div className="space-y-3 p-5">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : count === 0 ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-fg-subtle ring-1 ring-line">
            <ShoppingBag className="size-6" strokeWidth={1.6} />
          </span>
          <p className="mt-4 font-semibold">Il carrello è vuoto</p>
          <p className="mt-1 text-body-sm text-fg-muted">Premi + sui piatti per aggiungerli.</p>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-5">
            <CartLines quote={quote} compact />
          </div>
          <div className="space-y-4 border-t border-line p-5">
            <CartSummary quote={quote} loading={settling} />
            {gate.canProceed ? (
              <Button asChild size="lg" block>
                <Link href="/checkout">
                  Vai al checkout <span aria-hidden>•</span>{" "}
                  <span className="tabular-nums">{formatEuro(quote?.totals.totalCents ?? estimate)}</span>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button size="lg" block disabled>
                {gate.reason ?? "Calcolo in corso…"}
              </Button>
            )}
            <Link
              href="/cart"
              className="block text-center text-body-sm font-semibold text-fg-muted hover:text-fg"
            >
              Apri il carrello
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
