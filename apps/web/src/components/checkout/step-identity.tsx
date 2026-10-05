"use client";

import { checkoutCustomer } from "@dimsum/validation";
import { Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { explainGoogleSetup } from "@/components/auth/social-buttons";
import { GoogleIcon } from "@/components/brand/provider-icons";
import { useRestaurant } from "@/components/shop/restaurant-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Field, Input } from "@/components/ui/input";
import { Avatar, Divider } from "@/components/ui/misc";
import { toast } from "@/components/ui/toaster";
import { signIn, useSession } from "@/lib/auth-client";
import type { ProviderButton } from "@/lib/auth-providers";
import { useCheckoutDraft } from "@/lib/stores/checkout";
import { useOrderPrefs } from "@/lib/stores/order-prefs";

/**
 * "Come vuoi continuare?" — shown only after the address and the zone check, never before.
 * Guests can always order: no registration required.
 */
export function StepIdentity({ google, onContinue }: { google: ProviderButton; onContinue: () => void }) {
  const restaurant = useRestaurant();
  const { data: session, isPending } = useSession();
  const fulfillment = useOrderPrefs((s) => s.fulfillment);
  const identity = useCheckoutDraft((s) => s.identity);
  const setIdentity = useCheckoutDraft((s) => s.setIdentity);
  const customer = useCheckoutDraft((s) => s.customer);
  const setCustomer = useCheckoutDraft((s) => s.setCustomer);
  const marketing = useCheckoutDraft((s) => s.marketingConsent);
  const setDraft = useCheckoutDraft((s) => s.set);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [googleLoading, setGoogleLoading] = useState(false);
  const phoneRequired =
    fulfillment === "DELIVERY"
      ? restaurant.checkout.phoneRequiredForDelivery
      : restaurant.checkout.phoneRequiredForPickup;

  const validateAndContinue = (data: { name: string; email: string; phone: string }) => {
    const parsed = checkoutCustomer.safeParse({
      name: data.name,
      email: data.email,
      phone: data.phone.trim() ? data.phone : null,
    });
    const next: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
    }
    if (phoneRequired && !data.phone.trim())
      next.phone = "Il numero serve al rider o al ristorante in caso di necessità.";
    setErrors(next);
    if (Object.keys(next).length === 0) onContinue();
  };

  if (isPending) return <div className="h-48 skeleton rounded-2xl" />;

  if (session) {
    const name = customer.name || session.user.name;
    const email = customer.email || session.user.email;
    const phone = customer.phone || ((session.user as { phone?: string | null }).phone ?? "");
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3.5 rounded-2xl bg-surface p-4 ring-1 ring-line">
          <Avatar name={session.user.name} src={session.user.image} />
          <div className="min-w-0">
            <p className="font-semibold">Ordini come {session.user.name}</p>
            <p className="truncate text-body-sm text-fg-muted">{session.user.email}</p>
          </div>
        </div>
        <Field label="Nome e cognome" error={errors.name}>
          {(p) => (
            <Input
              {...p}
              value={name}
              onChange={(e) => setCustomer({ name: e.target.value })}
              autoComplete="name"
            />
          )}
        </Field>
        <Field
          label="Telefono"
          optional={!phoneRequired}
          error={errors.phone}
          hint="Lo usiamo solo per comunicazioni sull'ordine."
        >
          {(p) => (
            <Input
              {...p}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setCustomer({ phone: e.target.value })}
              autoComplete="tel"
              placeholder="+39 333 123 4567"
            />
          )}
        </Field>
        <Button
          size="xl"
          block
          className="h-14"
          onClick={() => {
            setCustomer({ name, email, phone });
            setIdentity("account");
            validateAndContinue({ name, email, phone });
          }}
        >
          Continua
        </Button>
      </div>
    );
  }

  if (identity !== "guest") {
    return (
      <div className="space-y-5">
        <div className="text-center">
          <h2 className="text-title font-bold">Come vuoi continuare?</h2>
          <p className="mt-1 text-body-sm text-fg-muted">Puoi ordinare anche senza registrarti.</p>
        </div>
        <Button size="xl" variant="dark" block className="h-14" onClick={() => setIdentity("guest")}>
          <UserRound className="size-5" /> Continua come ospite
        </Button>
        <Divider label="oppure" />
        {google !== "off" ? (
          <Button
            size="lg"
            variant="secondary"
            block
            loading={googleLoading}
            onClick={async () => {
              if (google === "setup") return explainGoogleSetup();
              setGoogleLoading(true);
              // Cart, address and checkout draft are persisted on the device: the redirect resumes here.
              const res = await signIn.social({
                provider: "google",
                callbackURL: "/checkout?riprendi=1",
                errorCallbackURL: "/checkout?errore=google",
              });
              if (res.error) {
                setGoogleLoading(false);
                toast.error("Accesso con Google non riuscito", {
                  description: res.error.message ?? "Riprova.",
                });
              }
            }}
          >
            <GoogleIcon className="size-5" /> Continua con Google
          </Button>
        ) : null}
        <Button asChild size="lg" variant="outline" block>
          <Link href="/login?next=/checkout%3Friprendi%3D1">
            <Mail className="size-5" /> Accedi con e-mail
          </Link>
        </Button>
        <p className="text-center text-body-sm text-fg-muted">
          Non hai un account?{" "}
          <Link href="/registrati?next=/checkout%3Friprendi%3D1" className="font-semibold text-brand-ink">
            Registrati
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        validateAndContinue(customer);
      }}
      noValidate
    >
      <div className="flex items-center justify-between">
        <h2 className="text-title-sm font-bold">I tuoi dati</h2>
        <button
          type="button"
          className="text-body-sm font-semibold text-brand-ink"
          onClick={() => setIdentity(null)}
        >
          Accedi invece
        </button>
      </div>
      <Field label="Nome e cognome" error={errors.name}>
        {(p) => (
          <Input
            {...p}
            value={customer.name}
            onChange={(e) => setCustomer({ name: e.target.value })}
            autoComplete="name"
            placeholder="Mario Rossi"
          />
        )}
      </Field>
      <Field
        label="E-mail *"
        error={errors.email}
        hint="Ti invieremo qui la conferma di pagamento e gli aggiornamenti sul tuo ordine."
      >
        {(p) => (
          <Input
            {...p}
            type="email"
            inputMode="email"
            value={customer.email}
            onChange={(e) => setCustomer({ email: e.target.value })}
            autoComplete="email"
            placeholder="nome@email.it"
          />
        )}
      </Field>
      <Field
        label="Telefono"
        optional={!phoneRequired}
        error={errors.phone}
        hint={
          fulfillment === "DELIVERY"
            ? "Solo per il rider, in caso di difficoltà a trovarti."
            : "Solo per avvisarti in caso di problemi."
        }
      >
        {(p) => (
          <Input
            {...p}
            type="tel"
            inputMode="tel"
            value={customer.phone}
            onChange={(e) => setCustomer({ phone: e.target.value })}
            autoComplete="tel"
            placeholder="+39 333 123 4567"
          />
        )}
      </Field>
      <label className="flex items-start gap-3 text-body-sm text-fg-muted">
        <Checkbox
          checked={marketing}
          onCheckedChange={(v) => setDraft("marketingConsent", v === true)}
          className="mt-0.5"
        />
        <span>
          Voglio ricevere via e-mail offerte e novità di DIMSUM (facoltativo, puoi annullare quando vuoi).
        </span>
      </label>
      <Button type="submit" size="xl" block className="h-14">
        Continua
      </Button>
    </form>
  );
}
