"use client";

import { formatEuro } from "@dimsum/domain";
import type { CheckoutResultDTO } from "@dimsum/types";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CartSummary } from "@/components/cart/cart-summary";
import { useStorefront } from "@/components/shop/product-sheet/context";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toaster";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import type { ProviderButton } from "@/lib/auth-providers";
import { useCartQuote } from "@/lib/cart-quote";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { useServiceStatus } from "@/lib/service-status";
import { useCart } from "@/lib/stores/cart";
import { useCheckoutDraft, type CheckoutStep } from "@/lib/stores/checkout";
import { useHydrated } from "@/lib/stores/hydration";
import { useOrderPrefs } from "@/lib/stores/order-prefs";
import { DevPayment } from "./dev-payment";
import { OrderLines } from "./order-lines";
import { StepFulfillment } from "./step-fulfillment";
import { StepIdentity } from "./step-identity";
import { StepPayment } from "./step-payment";
import { StripePayment } from "./stripe-payment";

const STEPS: { key: CheckoutStep; label: string }[] = [
  { key: "fulfillment", label: "Consegna" },
  { key: "identity", label: "I tuoi dati" },
  { key: "payment", label: "Pagamento" },
];

function Progress({ step }: { step: CheckoutStep }) {
  const index = STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="flex gap-2" aria-label="Avanzamento del checkout">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex-1" aria-current={i === index ? "step" : undefined}>
          <span
            className={cn(
              "block h-1 rounded-full transition-colors duration-500",
              i <= index ? "bg-brand" : "bg-surface-3",
            )}
          />
          <span
            className={cn(
              "mt-1.5 block text-micro font-semibold",
              i === index ? "text-fg" : "text-fg-subtle",
            )}
          >
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function OrderAside() {
  const { data: quote, settling } = useCartQuote({ includeTip: true });
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 space-y-5 rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-line/70">
        <h2 className="text-title-sm font-extrabold">Il tuo ordine</h2>
        <div className="max-h-72 overflow-y-auto pr-1">
          <OrderLines />
        </div>
        <div className="border-t border-line pt-4">
          <CartSummary quote={quote} loading={settling} />
        </div>
      </div>
    </aside>
  );
}

export function CheckoutFlow({ google }: { google: ProviderButton }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const { catalog } = useStorefront();
  const { data: session } = useSession();
  const lines = useCart((s) => s.lines);
  const cartUpdatedAt = useCart((s) => s.updatedAt);
  const clearCart = useCart((s) => s.clear);
  const step = useCheckoutDraft((s) => s.step);
  const setStep = useCheckoutDraft((s) => s.setStep);
  const pendingOrder = useCheckoutDraft((s) => s.pendingOrder);
  const resetDraft = useCheckoutDraft((s) => s.reset);
  const renewKey = useCheckoutDraft((s) => s.renewKey);
  const setSchedule = useOrderPrefs((s) => s.setSchedule);
  const { data: quote, settling, refetch } = useCartQuote({ includeTip: true });
  const { data: status } = useServiceStatus();
  const [payment, setPayment] = useState<CheckoutResultDTO | null>(null);
  const direction = useCheckoutDraft((s) => s.direction);

  const go = useCallback(
    (next: CheckoutStep) => {
      setStep(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [setStep],
  );

  // Entry points: "?riprendi=1" after Google/e-mail sign-in, "?programma=1" from the closed banner.
  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("programma") === "1") setSchedule({ mode: "scheduled", slotStart: null, slotLabel: null });
    if (params.get("errore") === "google") toast.error("Accesso con Google annullato o non riuscito.");
    if (params.has("riprendi") || params.has("programma") || params.has("errore"))
      window.history.replaceState(null, "", "/checkout");
  }, [hydrated, setSchedule]);

  useEffect(() => {
    if (
      hydrated &&
      session &&
      step === "identity" &&
      new URLSearchParams(window.location.search).has("riprendi")
    )
      go("payment");
  }, [hydrated, session, step, go]);

  // An order created earlier for this cart is resumed; a changed cart starts a new attempt.
  useEffect(() => {
    if (!hydrated || !pendingOrder) return;
    if (cartUpdatedAt > pendingOrder.createdAt) {
      renewKey();
      return;
    }
    void api.orders.paymentIntent(pendingOrder.publicId).then((r) => {
      if (r.status === "SUCCEEDED" || r.status === "PROCESSING") {
        clearCart();
        resetDraft();
        router.replace(`/order/${pendingOrder.publicId}?placed=1`);
      }
    });
  }, [hydrated, pendingOrder, cartUpdatedAt, renewKey, clearCart, resetDraft, router]);

  const finish = useCallback(
    (publicId: string) => {
      clearCart();
      resetDraft();
      router.replace(`/order/${publicId}?placed=1`);
    },
    [clearCart, resetDraft, router],
  );

  const onPlaced = (result: CheckoutResultDTO) => {
    if (
      result.payment.provider === "CASH" ||
      result.status !== "PENDING_PAYMENT" ||
      !result.payment.clientSecret
    ) {
      finish(result.publicId);
      return;
    }
    setPayment(result);
  };

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }

  if (lines.length === 0 && !payment) {
    return (
      <EmptyState
        className="py-24"
        icon={ShoppingBag}
        title="Il carrello è vuoto"
        description="Aggiungi qualche piatto per procedere al checkout."
        action={
          <Button asChild size="lg">
            <Link href="/menu">Vai al menu</Link>
          </Button>
        }
      />
    );
  }

  const hasAlcohol = lines.some((l) => catalog.products[l.productId]?.tags.includes("ALCOHOLIC"));
  const back = () => {
    if (payment) return setPayment(null);
    if (step === "payment") return go(session ? "fulfillment" : "identity");
    if (step === "identity") return go("fulfillment");
    router.push("/cart");
  };

  const content = payment ? (
    <div className="space-y-5">
      <div>
        <h2 className="text-title font-bold">Pagamento</h2>
        <p className="text-body-sm text-fg-muted">
          Ordine #{payment.number} · {formatEuro(payment.payment.amountCents)}
        </p>
      </div>
      {payment.payment.provider === "STRIPE" &&
      payment.payment.publishableKey &&
      payment.payment.clientSecret ? (
        <StripePayment
          publishableKey={payment.payment.publishableKey}
          clientSecret={payment.payment.clientSecret}
          amountCents={payment.payment.amountCents}
          returnUrl={`${window.location.origin}/order/${payment.publicId}?placed=1`}
          onSuccess={() => finish(payment.publicId)}
        />
      ) : (
        <DevPayment
          publicId={payment.publicId}
          amountCents={payment.payment.amountCents}
          onSuccess={() => finish(payment.publicId)}
        />
      )}
    </div>
  ) : step === "fulfillment" ? (
    <StepFulfillment
      quote={quote}
      quoting={settling}
      status={status}
      onContinue={() => go(session ? "payment" : "identity")}
    />
  ) : step === "identity" ? (
    <StepIdentity google={google} onContinue={() => go("payment")} />
  ) : (
    <StepPayment
      quote={quote}
      settling={settling}
      hasAlcohol={hasAlcohol}
      onPlaced={onPlaced}
      onQuoteChanged={() => void refetch()}
    />
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pt-2 pb-16 lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-none">
        <div className="flex items-center gap-2 py-2">
          <button
            type="button"
            onClick={back}
            aria-label="Indietro"
            className="grid size-10 tap place-items-center rounded-full hover:bg-surface"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-headline font-extrabold">Checkout</h1>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="mx-auto w-full max-w-2xl lg:mx-0">
          {!payment ? (
            <div className="mb-7">
              <Progress step={step} />
            </div>
          ) : null}
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={payment ? "pay" : step}
              custom={direction}
              initial={{ opacity: 0, x: 24 * direction }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 * direction }}
              transition={{ duration: 0.28, ease: ease.out }}
            >
              {content}
            </motion.div>
          </AnimatePresence>
        </div>
        <OrderAside />
      </div>
    </div>
  );
}
