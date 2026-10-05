"use client";

import type { AdminSettingsResponse } from "@dimsum/api-client";
import type { SettingsInput } from "@dimsum/validation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Volume2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { InlineAlert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { playAlert, unlockAudio, type AlertSound } from "@/lib/admin/alert-sound";
import { centsToInput, firstErrors, parseEuroToCents } from "@/lib/admin/forms";
import { AdminPage, Panel } from "../ui";

function toDraft(s: AdminSettingsResponse) {
  return {
    name: s.name,
    tagline: s.tagline ?? "",
    legalName: s.legalName ?? "",
    vatNumber: s.vatNumber ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    supportEmail: s.supportEmail ?? "",
    street: s.street,
    streetNumber: s.streetNumber,
    postalCode: s.postalCode,
    city: s.city,
    province: s.province,
    formattedAddress: s.formattedAddress,
    lat: String(s.location.lat),
    lng: String(s.location.lng),
    googleReviewUrl: s.googleReviewUrl ?? "",
    instagramUrl: s.instagramUrl ?? "",
    facebookUrl: s.facebookUrl ?? "",
    orderNumberPrefix: s.orderNumberPrefix,
    deliveryEnabled: s.deliveryEnabled,
    pickupEnabled: s.pickupEnabled,
    autoAcceptOrders: s.autoAcceptOrders,
    acceptanceEscalationMinutes: String(s.acceptanceEscalationMinutes),
    defaultPrepMinutes: String(s.defaultPrepMinutes),
    prepTimeOptions: s.prepTimeOptions.join(", "),
    schedulingEnabled: s.schedulingEnabled,
    slotIntervalMinutes: String(s.slotIntervalMinutes),
    deliveryLeadMinutes: String(s.deliveryLeadMinutes),
    pickupLeadMinutes: String(s.pickupLeadMinutes),
    maxScheduleDays: String(s.maxScheduleDays),
    lastOrderBufferMinutes: String(s.lastOrderBufferMinutes),
    maxRouteKm: s.maxRouteDistanceMeters ? String(s.maxRouteDistanceMeters / 1000).replace(".", ",") : "",
    maxTravelMinutes: s.maxTravelSeconds ? String(Math.round(s.maxTravelSeconds / 60)) : "",
    customerCancelWindowMinutes: String(s.customerCancelWindowMinutes),
    onlinePaymentsEnabled: s.onlinePaymentsEnabled,
    cashOnDeliveryEnabled: s.cashOnDeliveryEnabled,
    cashOnPickupEnabled: s.cashOnPickupEnabled,
    tipsEnabled: s.tipsEnabled,
    tipOptions: s.tipOptionsCents.map((c) => centsToInput(c)).join(" · "),
    serviceFee: centsToInput(s.serviceFeeCents),
    phoneRequiredForDelivery: s.phoneRequiredForDelivery,
    phoneRequiredForPickup: s.phoneRequiredForPickup,
    newOrderSoundEnabled: s.newOrderSoundEnabled,
    newOrderSound: s.newOrderSound,
  };
}

const int = (v: string | boolean) => Number.parseInt(String(v), 10);
const nul = (v: string | boolean) => (String(v).trim() ? String(v).trim() : null);

type Draft = ReturnType<typeof toDraft>;
type DraftKey = keyof Draft;

function toInput(d: Draft): SettingsInput {
  const km = String(d.maxRouteKm).trim();
  const minutes = String(d.maxTravelMinutes).trim();
  return {
    name: String(d.name).trim(),
    tagline: nul(d.tagline),
    legalName: nul(d.legalName),
    vatNumber: nul(d.vatNumber),
    phone: nul(d.phone),
    email: nul(d.email),
    supportEmail: nul(d.supportEmail),
    street: String(d.street).trim(),
    streetNumber: String(d.streetNumber).trim(),
    postalCode: String(d.postalCode).trim(),
    city: String(d.city).trim(),
    province: String(d.province).trim(),
    formattedAddress: String(d.formattedAddress).trim(),
    location: { lat: Number(String(d.lat).replace(",", ".")), lng: Number(String(d.lng).replace(",", ".")) },
    googleReviewUrl: nul(d.googleReviewUrl),
    instagramUrl: nul(d.instagramUrl),
    facebookUrl: nul(d.facebookUrl),
    orderNumberPrefix: String(d.orderNumberPrefix).trim().toUpperCase(),
    deliveryEnabled: d.deliveryEnabled === true,
    pickupEnabled: d.pickupEnabled === true,
    autoAcceptOrders: d.autoAcceptOrders === true,
    acceptanceEscalationMinutes: int(d.acceptanceEscalationMinutes),
    defaultPrepMinutes: int(d.defaultPrepMinutes),
    prepTimeOptions: String(d.prepTimeOptions)
      .split(/[,\s·]+/)
      .filter(Boolean)
      .map(Number),
    schedulingEnabled: d.schedulingEnabled === true,
    slotIntervalMinutes: int(d.slotIntervalMinutes) as SettingsInput["slotIntervalMinutes"],
    deliveryLeadMinutes: int(d.deliveryLeadMinutes),
    pickupLeadMinutes: int(d.pickupLeadMinutes),
    maxScheduleDays: int(d.maxScheduleDays),
    lastOrderBufferMinutes: int(d.lastOrderBufferMinutes),
    maxRouteDistanceMeters: km ? Math.round(Number(km.replace(",", ".")) * 1000) : null,
    maxTravelSeconds: minutes ? int(minutes) * 60 : null,
    customerCancelWindowMinutes: int(d.customerCancelWindowMinutes),
    onlinePaymentsEnabled: d.onlinePaymentsEnabled === true,
    cashOnDeliveryEnabled: d.cashOnDeliveryEnabled === true,
    cashOnPickupEnabled: d.cashOnPickupEnabled === true,
    tipsEnabled: d.tipsEnabled === true,
    tipOptionsCents: String(d.tipOptions)
      .split(/[\s·;]+/)
      .filter(Boolean)
      .map((v) => parseEuroToCents(v) ?? -1),
    serviceFeeCents: parseEuroToCents(String(d.serviceFee)) ?? 0,
    phoneRequiredForDelivery: d.phoneRequiredForDelivery === true,
    phoneRequiredForPickup: d.phoneRequiredForPickup === true,
    newOrderSoundEnabled: d.newOrderSoundEnabled === true,
    newOrderSound: String(d.newOrderSound) as SettingsInput["newOrderSound"],
  };
}

export function SettingsEditor({
  initial,
  paymentsLive,
}: {
  initial: AdminSettingsResponse;
  paymentsLive: boolean;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [saved, setSaved] = useState(() => JSON.stringify(toDraft(initial)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(draft) !== saved;
  const set = (k: DraftKey, v: string | boolean) => setDraft((d) => ({ ...d, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.admin.settings.update(toInput(draft)),
    onSuccess: (s) => {
      const next = toDraft(s);
      setDraft(next);
      setSaved(JSON.stringify(next));
      setErrors({});
      void qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Impostazioni salvate", { description: "Le modifiche sono già attive sul sito." });
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(firstErrors(e.fieldErrors));
      toast.error(e instanceof ApiError ? e.message : "Salvataggio non riuscito.");
    },
  });

  const text = (
    k: DraftKey,
    label: string,
    opts: {
      hint?: string;
      optional?: boolean;
      type?: string;
      inputMode?: "numeric" | "decimal" | "email" | "tel" | "url";
      className?: string;
    } = {},
  ) => (
    <Field
      label={label}
      hint={opts.hint}
      optional={opts.optional}
      error={errors[k]}
      className={opts.className}
    >
      {(p) => (
        <Input
          {...p}
          type={opts.type ?? "text"}
          inputMode={opts.inputMode}
          value={String(draft[k])}
          onChange={(e) => set(k, e.target.value)}
        />
      )}
    </Field>
  );
  const toggle = (k: DraftKey, label: string, hint?: ReactNode) => (
    <label className="flex items-center justify-between gap-4 rounded-xl bg-surface-2 px-4 py-3">
      <span className="text-body-sm">
        <span className="block font-semibold">{label}</span>
        {hint ? <span className="block text-caption text-fg-muted">{hint}</span> : null}
      </span>
      <Switch checked={draft[k] === true} onCheckedChange={(v) => set(k, v)} />
    </label>
  );

  return (
    <AdminPage
      title="Impostazioni"
      description="Valgono per sito, app e gestionale."
      actions={
        <Button loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>
          Salva modifiche
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Il ristorante">
          <div className="grid gap-4 sm:grid-cols-2">
            {text("name", "Nome")}
            {text("tagline", "Sottotitolo", { optional: true })}
            {text("phone", "Telefono", { type: "tel", optional: true })}
            {text("email", "E-mail", { type: "email", optional: true })}
            {text("supportEmail", "E-mail assistenza", {
              type: "email",
              optional: true,
              hint: "Riceve le richieste dei clienti.",
            })}
            {text("legalName", "Ragione sociale", { optional: true })}
            {text("vatNumber", "Partita IVA", { optional: true })}
          </div>
        </Panel>

        <Panel
          title="Indirizzo del locale"
          description="Punto di partenza per distanze, zone e tempi di consegna."
        >
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            {text("street", "Via")}
            {text("streetNumber", "Civico")}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {text("postalCode", "CAP", { inputMode: "numeric" })}
            {text("city", "Città")}
            {text("province", "Provincia")}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_140px_140px]">
            {text("formattedAddress", "Indirizzo completo")}
            {text("lat", "Latitudine", { inputMode: "decimal" })}
            {text("lng", "Longitudine", { inputMode: "decimal" })}
          </div>
        </Panel>

        <Panel title="Ordini">
          <div className="space-y-3">
            {toggle(
              "autoAcceptOrders",
              "Accetta automaticamente gli ordini",
              "Senza conferma della cucina, con il tempo di preparazione predefinito.",
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {text("defaultPrepMinutes", "Preparazione predefinita (min)", { inputMode: "numeric" })}
              {text("prepTimeOptions", "Tempi proposti alla cucina (min)", {
                hint: "Separati da virgola, es. 10, 15, 20, 30",
              })}
              {text("acceptanceEscalationMinutes", "Allarme se non accettato entro (min)", {
                inputMode: "numeric",
              })}
              {text("customerCancelWindowMinutes", "Annullabile dal cliente entro (min)", {
                inputMode: "numeric",
                hint: "Solo finché la cucina non accetta.",
              })}
              {text("orderNumberPrefix", "Prefisso numero ordine", { hint: "Es. DS → #DS1024" })}
            </div>
          </div>
        </Panel>

        <Panel title="Consegna e ritiro">
          <div className="space-y-3">
            {toggle("deliveryEnabled", "Consegna a domicilio")}
            {toggle("pickupEnabled", "Ritiro al locale")}
            {toggle("phoneRequiredForDelivery", "Telefono obbligatorio per la consegna")}
            {toggle("phoneRequiredForPickup", "Telefono obbligatorio per il ritiro")}
            <div className="grid gap-4 sm:grid-cols-2">
              {text("maxRouteKm", "Distanza massima su strada (km)", {
                optional: true,
                inputMode: "decimal",
              })}
              {text("maxTravelMinutes", "Tempo massimo di tragitto (min)", {
                optional: true,
                inputMode: "numeric",
              })}
            </div>
          </div>
        </Panel>

        <Panel title="Ordini programmati">
          <div className="space-y-3">
            {toggle("schedulingEnabled", "Permetti di scegliere l'orario")}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Intervallo tra le fasce">
                {(p) => (
                  <select
                    {...p}
                    value={String(draft.slotIntervalMinutes)}
                    onChange={(e) => set("slotIntervalMinutes", e.target.value)}
                    className="h-12 w-full rounded-md bg-surface px-3 ring-1 ring-line ring-inset"
                  >
                    {["10", "15", "20", "30"].map((v) => (
                      <option key={v} value={v}>
                        {v} minuti
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              {text("maxScheduleDays", "Giorni prenotabili in anticipo", { inputMode: "numeric" })}
              {text("deliveryLeadMinutes", "Anticipo minimo consegna (min)", { inputMode: "numeric" })}
              {text("pickupLeadMinutes", "Anticipo minimo ritiro (min)", { inputMode: "numeric" })}
              {text("lastOrderBufferMinutes", "Stop ordini prima della chiusura (min)", {
                inputMode: "numeric",
              })}
            </div>
          </div>
        </Panel>

        <Panel title="Pagamenti e mance">
          <div className="space-y-3">
            {!paymentsLive ? (
              <InlineAlert tone="warning" title="Pagamenti online in modalità di prova">
                Configura le chiavi Stripe per incassare con carta, Apple Pay e Google Pay.
              </InlineAlert>
            ) : null}
            {toggle("onlinePaymentsEnabled", "Pagamento online", "Carta, Apple Pay, Google Pay.")}
            {toggle("cashOnDeliveryEnabled", "Contanti alla consegna")}
            {toggle("cashOnPickupEnabled", "Contanti al ritiro")}
            {toggle("tipsEnabled", "Mance per i rider", "Interamente ai rider, separate dall'incasso.")}
            <div className="grid gap-4 sm:grid-cols-2">
              {text("tipOptions", "Mance proposte (€)", { hint: "Es. 1,00 · 2,00 · 3,00" })}
              {text("serviceFee", "Costo di servizio (€)", {
                inputMode: "decimal",
                hint: "0,00 per non applicarlo.",
              })}
            </div>
          </div>
        </Panel>

        <Panel title="Avvisi in cucina">
          <div className="space-y-3">
            {toggle("newOrderSoundEnabled", "Suono per i nuovi ordini")}
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Suono" className="w-48">
                {(p) => (
                  <select
                    {...p}
                    value={String(draft.newOrderSound)}
                    onChange={(e) => set("newOrderSound", e.target.value)}
                    className="h-12 w-full rounded-md bg-surface px-3 ring-1 ring-line ring-inset"
                  >
                    <option value="chime">Campanello</option>
                    <option value="bell">Campana</option>
                    <option value="gong">Gong</option>
                  </select>
                )}
              </Field>
              <Button
                variant="secondary"
                onClick={async () =>
                  (await unlockAudio()) && playAlert(String(draft.newOrderSound) as AlertSound, 0.5)
                }
              >
                <Volume2 className="size-4" /> Prova
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title="Profili e recensioni">
          <div className="grid gap-4">
            {text("googleReviewUrl", "Link recensioni Google", {
              type: "url",
              optional: true,
              hint: "Proposto ai clienti dopo la consegna.",
            })}
            {text("instagramUrl", "Instagram", { type: "url", optional: true })}
            {text("facebookUrl", "Facebook", { type: "url", optional: true })}
          </div>
        </Panel>
      </div>
    </AdminPage>
  );
}
