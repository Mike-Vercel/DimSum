"use client";

import { formatEuro } from "@dimsum/domain";
import { personName, phone as phoneSchema } from "@dimsum/validation";
import type { CartQuoteDTO, CheckoutResultDTO } from "@dimsum/types";
import { Banknote, CreditCard, ShieldCheck, Wine } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CartSummary } from "@/components/cart/cart-summary";
import { useRestaurant } from "@/components/shop/restaurant-context";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, RadioCard, RadioCardGroup } from "@/components/ui/choice";
import { InlineAlert } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { cartToInput, useCart } from "@/lib/stores/cart";
import { useCheckoutDraft } from "@/lib/stores/checkout";
import { useOrderPrefs } from "@/lib/stores/order-prefs";
import { useServiceStatus } from "@/lib/service-status";
import { asapUnavailable, ClosedNotice } from "./closed-notice";
import { OrderLines } from "./order-lines";
import { SchedulePicker } from "./schedule-picker";
import { TipMascot, tipMood } from "./tip-mascot";

export function StepPayment({
  quote,
  settling,
  hasAlcohol,
  onPlaced,
  onQuoteChanged,
}: {
  quote: CartQuoteDTO | undefined;
  settling: boolean;
  hasAlcohol: boolean;
  onPlaced: (result: CheckoutResultDTO) => void;
  onQuoteChanged: () => void;
}) {
  const restaurant = useRestaurant();
  const lines = useCart((s) => s.lines);
  const couponCode = useCart((s) => s.couponCode);
  const fulfillment = useOrderPrefs((s) => s.fulfillment);
  const address = useOrderPrefs((s) => s.address);
  const schedule = useOrderPrefs((s) => s.schedule);
  const setSchedule = useOrderPrefs((s) => s.setSchedule);
  const { data: status } = useServiceStatus();
  // Back on the checkout after closing time (it remembers the step): "as soon as possible" from
  // before no longer works, so the day and time are chosen here instead of failing at "Conferma".
  const needsSlot =
    !!status &&
    !status.isPaused &&
    status.schedulingEnabled &&
    asapUnavailable(status, fulfillment) &&
    !(schedule.mode === "scheduled" && schedule.slotStart);
  const draft = useCheckoutDraft();
  const [customTip, setCustomTip] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<{ message: string; cartLink?: boolean } | null>(null);
  const [contactErrors, setContactErrors] = useState<{ name?: string; phone?: string }>({});

  // Signed-in customers skip the "your details" step: name, e-mail and phone come from the account.
  // Only what the account lacks and the order needs (e.g. a phone for the rider) is asked here.
  const { data: session } = useSession();
  const account = session?.user as
    { name?: string | null; email?: string; phone?: string | null } | undefined;
  const contact = {
    name: draft.customer.name.trim() || account?.name?.trim() || "",
    email: draft.customer.email.trim() || account?.email || "",
    phone: draft.customer.phone.trim() || account?.phone?.trim() || "",
  };
  const phoneRequired =
    fulfillment === "DELIVERY"
      ? restaurant.checkout.phoneRequiredForDelivery
      : restaurant.checkout.phoneRequiredForPickup;
  // Latched: once a field is shown it stays while the customer types into it.
  const [askName, setAskName] = useState(false);
  const [askPhone, setAskPhone] = useState(false);
  if (account && !askName && !personName.safeParse(contact.name).success) setAskName(true);
  if (account && !askPhone && phoneRequired && !contact.phone) setAskPhone(true);

  const methods = restaurant.checkout.paymentMethods;
  const cashAllowed = fulfillment === "DELIVERY" ? methods.cashOnDelivery : methods.cashOnPickup;
  // Old persisted drafts may still contain ONLINE: default them to cash.
  const method = draft.paymentMethod === "POS_ON_DELIVERY" ? "POS_ON_DELIVERY" : "CASH_ON_DELIVERY";
  const total = quote?.totals.totalCents ?? 0;
  const tipOptions = [0, ...restaurant.checkout.tipOptionsCents];

  const place = async () => {
    if (!quote) return;
    const missing: { name?: string; phone?: string } = {};
    const nameCheck = personName.safeParse(contact.name);
    if (!nameCheck.success) missing.name = nameCheck.error.issues[0]?.message ?? "Inserisci nome e cognome.";
    if (contact.phone) {
      const phoneCheck = phoneSchema.safeParse(contact.phone);
      if (!phoneCheck.success) missing.phone = phoneCheck.error.issues[0]?.message ?? "Numero non valido.";
    } else if (phoneRequired)
      missing.phone = "Il numero serve al rider o al ristorante in caso di necessità.";
    setContactErrors(missing);
    if (missing.name || missing.phone) {
      document.getElementById("i-tuoi-dati")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setPlacing(true);
    setError(null);
    const idempotencyKey = draft.ensureKey();
    try {
      const result = await api.checkout.placeOrder({
        idempotencyKey,
        lines: cartToInput(lines),
        fulfillmentType: fulfillment,
        scheduledFor: schedule.mode === "scheduled" ? schedule.slotStart : null,
        address:
          fulfillment === "DELIVERY" && address
            ? {
                street: address.street,
                streetNumber: address.streetNumber,
                postalCode: address.postalCode,
                city: address.city,
                province: address.province,
                country: address.country || "IT",
                formatted: address.formatted,
                location: address.location,
                placeId: address.placeId,
                precision: address.precision,
                staircase: address.staircase,
                floor: address.floor,
                apartment: address.apartment,
                intercom: address.intercom,
                riderNotes: address.riderNotes,
              }
            : null,
        customer: {
          name: contact.name,
          email: contact.email,
          phone: contact.phone || null,
        },
        couponCode,
        tipCents: fulfillment === "DELIVERY" ? draft.tipCents : 0,
        paymentMethod: method,
        kitchenNotes: draft.kitchenNotes.trim() || null,
        ageConfirmed: draft.ageConfirmed,
        marketingConsent: draft.marketingConsent,
        saveAddress: draft.saveAddress,
        expectedTotalCents: total,
        expectedDiscountCents: quote?.totals.discountCents ?? 0,
        source: window.matchMedia("(display-mode: standalone)").matches ? "pwa" : "web",
      });
      draft.setPendingOrder({ publicId: result.publicId, number: result.number, createdAt: Date.now() });
      onPlaced(result);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "PRICE_CHANGED" || e.code === "COUPON_INVALID") {
          draft.renewKey();
          onQuoteChanged();
          setError({ message: e.message });
        } else if (e.code === "PRODUCT_UNAVAILABLE" || e.code === "CART_INVALID") {
          draft.renewKey();
          onQuoteChanged();
          setError({ message: e.message, cartLink: true });
        } else {
          setError({ message: e.message });
        }
      } else {
        setError({ message: "Qualcosa è andato storto. Riprova." });
      }
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="space-y-7">
      {askName || askPhone || contactErrors.name || contactErrors.phone ? (
        <section id="i-tuoi-dati" aria-labelledby="dati-titolo" className="space-y-3">
          <div>
            <h2 id="dati-titolo" className="text-title-sm font-bold">
              Completa i tuoi dati
            </h2>
            <p className="text-body-sm text-fg-muted">Mancano nel tuo account e servono per questo ordine.</p>
          </div>
          {askName || contactErrors.name ? (
            <Field label="Nome e cognome" error={contactErrors.name}>
              {(p) => (
                <Input
                  {...p}
                  value={contact.name}
                  onChange={(e) => draft.setCustomer({ name: e.target.value })}
                  autoComplete="name"
                />
              )}
            </Field>
          ) : null}
          {askPhone || contactErrors.phone ? (
            <Field
              label="Telefono"
              optional={!phoneRequired}
              error={contactErrors.phone}
              hint="Lo usiamo solo per comunicazioni sull'ordine."
            >
              {(p) => (
                <Input
                  {...p}
                  type="tel"
                  inputMode="tel"
                  value={contact.phone}
                  onChange={(e) => draft.setCustomer({ phone: e.target.value })}
                  autoComplete="tel"
                  placeholder="+39 333 123 4567"
                />
              )}
            </Field>
          ) : null}
        </section>
      ) : null}
      {needsSlot && status ? (
        <section aria-labelledby="quando-pagamento" className="space-y-3">
          <h2 id="quando-pagamento" className="text-title-sm font-bold">
            Quando vuoi {fulfillment === "DELIVERY" ? "ricevere" : "ritirare"} l&apos;ordine?
          </h2>
          <ClosedNotice status={status} fulfillment={fulfillment} timeZone={restaurant.timezone} />
          <SchedulePicker fulfillment={fulfillment} value={schedule} onChange={setSchedule} />
        </section>
      ) : null}

      <section aria-labelledby="metodo" className="space-y-3">
        <h2 id="metodo" className="text-title-sm font-bold">
          Metodo di pagamento
        </h2>
        <RadioCardGroup
          value={method}
          onValueChange={(v) => draft.set("paymentMethod", v as "CASH_ON_DELIVERY" | "POS_ON_DELIVERY")}
          className="grid gap-2.5"
        >
          {cashAllowed ? (
            <RadioCard
              value="POS_ON_DELIVERY"
              icon={<CreditCard className="size-4.5" />}
              title={fulfillment === "DELIVERY" ? "Carta con POS alla consegna" : "Carta con POS al ritiro"}
              description={
                fulfillment === "DELIVERY"
                  ? "Portiamo il POS a casa tua: paghi con la carta quando ricevi l’ordine."
                  : "Paghi con la carta al POS del locale quando ritiri l’ordine."
              }
            />
          ) : null}
          {cashAllowed ? (
            <RadioCard
              value="CASH_ON_DELIVERY"
              icon={<Banknote className="size-4.5" />}
              title={fulfillment === "DELIVERY" ? "Contanti alla consegna" : "Contanti al ritiro"}
              description={
                fulfillment === "DELIVERY"
                  ? "Paghi in contanti al rider quando ricevi l’ordine."
                  : "Paghi in contanti al banco quando ritiri l’ordine."
              }
            />
          ) : null}
        </RadioCardGroup>
        <p className="flex items-center gap-2 text-caption text-fg-muted">
          <ShieldCheck className="size-4 text-success" aria-hidden /> Nessun pagamento online. Paghi alla
          consegna o al ritiro, in contanti o con POS. Non ti chiediamo i dati della carta sul sito.
        </p>
      </section>

      {fulfillment === "DELIVERY" && restaurant.checkout.tipsEnabled ? (
        <section aria-labelledby="mancia" className="space-y-3">
          <div>
            <h2 id="mancia" className="text-title-sm font-bold">
              Mancia al rider
            </h2>
            <p className="text-body-sm text-fg-muted">
              Facoltativa: va interamente al rider che ti consegna l&apos;ordine.
            </p>
          </div>
          <TipMascot mood={tipMood(draft.tipCents, tipOptions)} className="rounded-2xl bg-surface-2 px-3 py-2.5" />
          <div className="flex flex-wrap gap-2">
            {tipOptions.map((cents) => (
              <Chip
                key={cents}
                selected={!customTip && draft.tipCents === cents}
                onClick={() => {
                  setCustomTip(false);
                  draft.set("tipCents", cents);
                }}
              >
                {cents === 0 ? "Nessuna" : formatEuro(cents, { compact: true })}
              </Chip>
            ))}
            <Chip selected={customTip} onClick={() => setCustomTip(true)}>
              Personalizzata
            </Chip>
          </div>
          {customTip ? (
            <label className="flex max-w-48 items-center gap-2">
              <span className="text-body font-semibold">€</span>
              <Input
                inputMode="decimal"
                aria-label="Mancia personalizzata in euro"
                defaultValue={draft.tipCents ? (draft.tipCents / 100).toFixed(2).replace(".", ",") : ""}
                onChange={(e) => {
                  const v = Math.round(Number(e.target.value.replace(",", ".")) * 100);
                  draft.set("tipCents", Number.isFinite(v) ? Math.min(5000, Math.max(0, v)) : 0);
                }}
                placeholder="0,00"
              />
            </label>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="note-cucina" className="space-y-2">
        <h2 id="note-cucina" className="text-title-sm font-bold">
          Note per la cucina <span className="font-normal text-fg-subtle">(facoltativo)</span>
        </h2>
        <Textarea
          rows={2}
          maxLength={300}
          value={draft.kitchenNotes}
          onChange={(e) => draft.set("kitchenNotes", e.target.value)}
          placeholder="Es. tutto poco piccante, posate per 2"
          aria-labelledby="note-cucina"
        />
      </section>

      {hasAlcohol ? (
        <label className="flex items-start gap-3 rounded-2xl bg-warning-soft p-4 text-body-sm">
          <Checkbox
            checked={draft.ageConfirmed}
            onCheckedChange={(v) => draft.set("ageConfirmed", v === true)}
            className="mt-0.5"
          />
          <span>
            <Wine className="mr-1 inline size-4 text-warning" aria-hidden />
            Il carrello contiene bevande alcoliche: dichiaro di avere almeno 18 anni. Al momento della
            consegna potrà essere richiesto un documento.
          </span>
        </label>
      ) : null}

      <section
        aria-labelledby="riepilogo"
        className="space-y-4 rounded-2xl bg-surface p-5 ring-1 ring-line lg:hidden"
      >
        <h2 id="riepilogo" className="text-title-sm font-bold">
          Il tuo ordine
        </h2>
        <OrderLines limit={3} />
        <div className="border-t border-line pt-4">
          <CartSummary quote={quote} loading={settling} />
        </div>
      </section>

      {error ? (
        <InlineAlert
          tone="danger"
          title={error.message}
          action={
            error.cartLink ? (
              <Button asChild size="sm" variant="secondary">
                <Link href="/cart">Rivedi il carrello</Link>
              </Button>
            ) : null
          }
        />
      ) : null}

      <div className="space-y-3">
        <Button
          size="xl"
          block
          className="h-14"
          loading={placing}
          disabled={!quote || settling || !cashAllowed || needsSlot || (hasAlcohol && !draft.ageConfirmed)}
          onClick={() => void place()}
        >
          Conferma ordine <span aria-hidden>•</span> <span className="tabular-nums">{formatEuro(total)}</span>
        </Button>
        <p className="text-center text-caption text-fg-muted">
          Confermando accetti i{" "}
          <Link href="/termini" className="underline">
            Termini
          </Link>{" "}
          e l&apos;
          <Link href="/privacy" className="underline">
            informativa Privacy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
