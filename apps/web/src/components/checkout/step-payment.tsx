"use client";

import { formatEuro } from "@dimsum/domain";
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
import { Input, Textarea } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { cartToInput, useCart } from "@/lib/stores/cart";
import { useCheckoutDraft } from "@/lib/stores/checkout";
import { useOrderPrefs } from "@/lib/stores/order-prefs";
import { OrderLines } from "./order-lines";

function CardBrands() {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      <span className="rounded bg-[#1a1f71] px-1.5 py-0.5 text-[9px] font-black text-white italic">VISA</span>
      <span className="flex">
        <span className="size-3.5 rounded-full bg-[#eb001b]" />
        <span className="-ml-1.5 size-3.5 rounded-full bg-[#f79e1b]/90" />
      </span>
      <span className="rounded bg-black px-1.5 py-0.5 text-[9px] font-semibold text-white">Pay</span>
    </span>
  );
}

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
  const draft = useCheckoutDraft();
  const [customTip, setCustomTip] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<{ message: string; cartLink?: boolean } | null>(null);

  const methods = restaurant.checkout.paymentMethods;
  const cashAllowed = fulfillment === "DELIVERY" ? methods.cashOnDelivery : methods.cashOnPickup;
  const method =
    !methods.online && cashAllowed
      ? "CASH_ON_DELIVERY"
      : draft.paymentMethod === "CASH_ON_DELIVERY" && !cashAllowed
        ? "ONLINE"
        : draft.paymentMethod;
  const total = quote?.totals.totalCents ?? 0;
  const tipOptions = [0, ...restaurant.checkout.tipOptionsCents];

  const place = async () => {
    if (!quote) return;
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
          name: draft.customer.name,
          email: draft.customer.email,
          phone: draft.customer.phone.trim() || null,
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
      {fulfillment === "DELIVERY" && restaurant.checkout.tipsEnabled ? (
        <section aria-labelledby="mancia" className="space-y-3">
          <div>
            <h2 id="mancia" className="text-title-sm font-bold">
              Mancia al rider
            </h2>
            <p className="text-body-sm text-fg-muted">
              Va interamente al rider che ti consegna l&apos;ordine.
            </p>
          </div>
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

      <section aria-labelledby="metodo" className="space-y-3">
        <h2 id="metodo" className="text-title-sm font-bold">
          Metodo di pagamento
        </h2>
        <RadioCardGroup
          value={method}
          onValueChange={(v) => draft.set("paymentMethod", v as "ONLINE" | "CASH_ON_DELIVERY")}
          className="grid gap-2.5"
        >
          {methods.online ? (
            <RadioCard
              value="ONLINE"
              icon={<CreditCard className="size-4.5" />}
              title="Carta, Apple Pay o Google Pay"
              description={
                restaurant.checkout.onlinePaymentsLive
                  ? "Pagamento sicuro online"
                  : "Ambiente di prova: nessun addebito"
              }
              trailing={<CardBrands />}
            />
          ) : null}
          {cashAllowed ? (
            <RadioCard
              value="CASH_ON_DELIVERY"
              icon={<Banknote className="size-4.5" />}
              title={fulfillment === "DELIVERY" ? "Contanti alla consegna" : "Contanti al ritiro"}
              description="Paghi direttamente al rider o al banco"
            />
          ) : null}
        </RadioCardGroup>
        <p className="flex items-center gap-2 text-caption text-fg-muted">
          <ShieldCheck className="size-4 text-success" aria-hidden /> I dati di pagamento sono cifrati e
          gestiti da Stripe: non li memorizziamo.
        </p>
      </section>

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
          disabled={!quote || settling || (hasAlcohol && !draft.ageConfirmed)}
          onClick={() => void place()}
        >
          {method === "ONLINE" ? "Conferma e paga" : "Conferma ordine"} <span aria-hidden>•</span>{" "}
          <span className="tabular-nums">{formatEuro(total)}</span>
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
