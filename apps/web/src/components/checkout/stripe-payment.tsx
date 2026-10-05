"use client";

import { formatEuro } from "@dimsum/domain";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Appearance, type Stripe } from "@stripe/stripe-js";
import { Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/feedback";
import { haptics } from "@/lib/haptics";

const stripePromises = new Map<string, Promise<Stripe | null>>();
function stripeFor(key: string) {
  let p = stripePromises.get(key);
  if (!p) {
    p = loadStripe(key, { locale: "it" });
    stripePromises.set(key, p);
  }
  return p;
}

const appearance: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#d82a1e",
    colorText: "#141210",
    colorTextSecondary: "#6b635b",
    colorBackground: "#ffffff",
    colorDanger: "#c2241a",
    borderRadius: "14px",
    fontFamily: "Archivo, system-ui, sans-serif",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid #e8e0d4", boxShadow: "none", padding: "14px" },
    ".Input:focus": { border: "1px solid #141210", boxShadow: "0 0 0 1px #141210" },
    ".Tab": { border: "1px solid #e8e0d4", boxShadow: "none" },
    ".Tab--selected": { border: "2px solid #d82a1e", boxShadow: "none" },
  },
};

function PayForm({
  amountCents,
  returnUrl,
  onSuccess,
}: {
  amountCents: number;
  returnUrl: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        setBusy(true);
        setError(null);
        const { error: err, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: returnUrl },
          redirect: "if_required",
        });
        if (err) {
          haptics.error();
          setError(
            err.type === "card_error" || err.type === "validation_error"
              ? (err.message ?? "Pagamento non riuscito.")
              : "Pagamento non riuscito. Riprova o usa un altro metodo.",
          );
          setBusy(false);
          return;
        }
        if (paymentIntent && ["succeeded", "processing", "requires_capture"].includes(paymentIntent.status)) {
          haptics.success();
          onSuccess();
        } else {
          setBusy(false);
        }
      }}
    >
      <PaymentElement
        onReady={() => setReady(true)}
        options={{
          layout: {
            type: "accordion",
            defaultCollapsed: false,
            radios: "always",
            spacedAccordionItems: true,
          },
          wallets: { applePay: "auto", googlePay: "auto" },
          fields: { billingDetails: { address: "never" } },
        }}
      />
      {error ? <InlineAlert tone="danger" title={error} /> : null}
      <Button type="submit" size="xl" block className="h-14" loading={busy} disabled={!stripe || !ready}>
        <Lock className="size-4" /> Paga {formatEuro(amountCents)}
      </Button>
      <p className="text-center text-caption text-fg-muted">
        Pagamento protetto da Stripe. I dati della carta non transitano sui nostri server.
      </p>
    </form>
  );
}

export function StripePayment({
  publishableKey,
  clientSecret,
  amountCents,
  returnUrl,
  onSuccess,
}: {
  publishableKey: string;
  clientSecret: string;
  amountCents: number;
  returnUrl: string;
  onSuccess: () => void;
}) {
  return (
    <Elements
      stripe={stripeFor(publishableKey)}
      options={{
        clientSecret,
        appearance,
        locale: "it",
        fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700&display=swap" }],
      }}
    >
      <PayForm amountCents={amountCents} returnUrl={returnUrl} onSuccess={onSuccess} />
    </Elements>
  );
}
