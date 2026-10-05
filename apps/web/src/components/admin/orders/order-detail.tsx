"use client";

import { ORDER_STATUS_LABELS, formatEuro } from "@dimsum/domain";
import type { AdminOrderDetailDTO, AdminRiderDTO, KitchenOrderDTO } from "@dimsum/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Mail, MapPin, Phone, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Map } from "@/components/maps/map";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { useOrderCommand } from "@/lib/admin/orders";
import { formatOrderDate } from "@/lib/dates";
import { useRealtime } from "@/lib/realtime";
import { AcceptDialog, ReasonDialog, RiderPicker } from "../kitchen/dialogs";
import { CollectionBadge, ConfirmDialog, FulfillmentBadge, KeyValue, OrderStatusBadge, Panel } from "../ui";

const COMMAND_LABEL: Record<string, string> = {
  PLACE: "Ordine inviato",
  PAYMENT_SUCCEEDED: "Pagamento confermato",
  RECEIVE: "Ricevuto dalla cucina",
  CONFIRM: "Accettato",
  REJECT: "Rifiutato",
  START_PREPARING: "Preparazione iniziata",
  MARK_READY: "Pronto",
  ASSIGN_RIDER: "Rider assegnato",
  UNASSIGN_RIDER: "Rider rimosso",
  RIDER_TO_RESTAURANT: "Rider verso il locale",
  PICK_UP: "Ritirato dal rider",
  START_DELIVERY: "Consegna avviata",
  DELIVER: "Consegnato",
  CANCEL: "Annullato",
  REFUND_FULL: "Rimborsato",
  UPDATE_PREP_TIME: "Tempo di preparazione aggiornato",
};

const ACTOR_LABEL: Record<string, string> = {
  customer: "Cliente",
  staff: "Staff",
  rider: "Rider",
  system: "Automatico",
};

function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

function RefundDialog({
  order,
  open,
  onClose,
}: {
  order: AdminOrderDetailDTO;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState((order.refundableCents / 100).toFixed(2).replace(".", ","));
  const [reason, setReason] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const cents = Math.round(Number(amount.replace(",", ".")) * 100);
  const refund = useMutation({
    mutationFn: () => api.admin.orders.refund(order.id, { amountCents: cents, reason, idempotencyKey: key }),
    onSuccess: (o) => {
      qc.setQueryData(["admin", "order", o.id], o);
      toast.success(`Rimborso di ${formatEuro(cents)} avviato`);
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Rimborso non riuscito."),
  });
  const valid =
    Number.isFinite(cents) && cents > 0 && cents <= order.refundableCents && reason.trim().length >= 3;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Rimborso #${order.number}`}
      description={`Rimborsabile: ${formatEuro(order.refundableCents)}. Il cliente riceve una conferma via e-mail.`}
      confirmLabel={`Rimborsa ${Number.isFinite(cents) && cents > 0 ? formatEuro(cents) : ""}`}
      busy={refund.isPending}
      disabled={!valid}
      onConfirm={() => refund.mutate()}
    >
      <div className="space-y-4">
        <Field label="Importo (€)">
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ""))}
            />
          )}
        </Field>
        <Field label="Motivo">
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Es. prodotto mancante"
            />
          )}
        </Field>
      </div>
    </ConfirmDialog>
  );
}

export function OrderDetail({
  initial,
  riders,
  timeZone,
  canRefund,
}: {
  initial: AdminOrderDetailDTO;
  riders: AdminRiderDTO[];
  timeZone: string;
  canRefund: boolean;
}) {
  const qc = useQueryClient();
  const { data: order = initial } = useQuery({
    queryKey: ["admin", "order", initial.id],
    queryFn: ({ signal }) => api.admin.orders.get(initial.id, signal),
    initialData: initial,
    initialDataUpdatedAt: 0,
  });
  useRealtime(["kitchen"], (e) => {
    if ("orderId" in e && e.orderId === order.id)
      void qc.invalidateQueries({ queryKey: ["admin", "order", order.id] });
  });
  const command = useOrderCommand();
  const [dialog, setDialog] = useState<null | "accept" | "reject" | "cancel" | "rider" | "refund">(null);
  const has = (c: string) => order.commands.includes(c as KitchenOrderDTO["commands"][number]);
  const run = (input: Parameters<typeof command.mutate>[0]["input"]) =>
    command.mutate({ orderId: order.id, input }, { onSuccess: () => setDialog(null) });
  const destination = order.address?.location ?? null;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-5 pb-16 lg:px-8 lg:pt-8">
      <Link
        href="/admin/ordini"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-semibold text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> Ordini
      </Link>
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-display font-extrabold tabular-nums">#{order.number}</h1>
        <OrderStatusBadge status={order.status} fulfillmentType={order.fulfillmentType} />
        <FulfillmentBadge type={order.fulfillmentType} />
        <CollectionBadge collection={order.collection} totalCents={order.totalCents} />
        <span className="text-body-sm text-fg-muted">{formatOrderDate(order.placedAt, timeZone)}</span>
        <Link
          href={`/order/${order.publicId}`}
          target="_blank"
          className="ml-auto inline-flex items-center gap-1.5 text-body-sm font-semibold text-brand-ink"
        >
          Pagina di tracking <ExternalLink className="size-4" />
        </Link>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {order.status === "RECEIVED" ? (
          <>
            <Button onClick={() => setDialog("accept")}>Accetta</Button>
            <Button variant="secondary" onClick={() => setDialog("reject")}>
              Rifiuta
            </Button>
          </>
        ) : null}
        {has("START_PREPARING") ? (
          <Button
            variant="secondary"
            loading={command.isPending}
            onClick={() => run({ command: "START_PREPARING" })}
          >
            Inizia preparazione
          </Button>
        ) : null}
        {has("MARK_READY") ? (
          <Button variant="dark" loading={command.isPending} onClick={() => run({ command: "MARK_READY" })}>
            Segna pronto
          </Button>
        ) : null}
        {has("ASSIGN_RIDER") ? (
          <Button variant="secondary" onClick={() => setDialog("rider")}>
            {order.rider ? "Cambia rider" : "Assegna rider"}
          </Button>
        ) : null}
        {has("PICK_UP") && order.fulfillmentType === "DELIVERY" ? (
          <Button variant="secondary" loading={command.isPending} onClick={() => run({ command: "PICK_UP" })}>
            Consegnato al rider
          </Button>
        ) : null}
        {has("DELIVER") ? (
          <Button variant="secondary" loading={command.isPending} onClick={() => run({ command: "DELIVER" })}>
            {order.fulfillmentType === "DELIVERY" ? "Segna consegnato" : "Ritirato dal cliente"}
          </Button>
        ) : null}
        {has("CANCEL") && order.status !== "RECEIVED" ? (
          <Button variant="ghost" className="text-danger" onClick={() => setDialog("cancel")}>
            Annulla ordine
          </Button>
        ) : null}
        {canRefund && order.refundableCents > 0 ? (
          <Button variant="ghost" onClick={() => setDialog("refund")}>
            <RotateCcw className="size-4" /> Rimborso
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <Panel title="Prodotti">
            <ul className="divide-y divide-line">
              {order.lines.map((l) => (
                <li key={l.id} className="flex gap-4 py-3 first:pt-0">
                  <span className="w-8 shrink-0 font-bold tabular-nums">{l.quantity}×</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {l.name}
                      {l.variantName ? (
                        <span className="font-normal text-fg-muted"> · {l.variantName}</span>
                      ) : null}
                    </p>
                    {l.modifiers.map((m, i) => (
                      <p key={i} className="text-body-sm text-fg-muted">
                        + {m.quantity > 1 ? `${m.quantity}× ` : ""}
                        {m.name} {m.unitPriceCents ? `(${formatEuro(m.unitPriceCents)})` : ""}
                      </p>
                    ))}
                    {l.notes ? <p className="text-body-sm font-semibold text-warning">“{l.notes}”</p> : null}
                  </div>
                  <div className="text-right text-body-sm tabular-nums">
                    <p className="font-semibold">{formatEuro(l.lineTotalCents)}</p>
                    <p className="text-caption text-fg-muted">IVA {l.vatRateBps / 100}%</p>
                  </div>
                </li>
              ))}
            </ul>
            {order.kitchenNotes ? (
              <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-body-sm">
                Note per la cucina: {order.kitchenNotes}
              </p>
            ) : null}
            <div className="mt-4 border-t border-line pt-4">
              <KeyValue
                rows={[
                  ["Subtotale", formatEuro(order.totals.subtotalCents)],
                  ...(order.totals.discountCents
                    ? ([
                        [
                          order.coupon ? `Sconto (${order.coupon.code ?? order.coupon.name})` : "Sconto",
                          `−${formatEuro(order.totals.discountCents)}`,
                        ],
                      ] as [string, string][])
                    : []),
                  ...(order.fulfillmentType === "DELIVERY"
                    ? ([
                        [
                          "Consegna",
                          order.totals.deliveryFeeCents
                            ? formatEuro(order.totals.deliveryFeeCents)
                            : "Gratis",
                        ],
                      ] as [string, string][])
                    : []),
                  ...(order.totals.serviceFeeCents
                    ? ([["Servizio", formatEuro(order.totals.serviceFeeCents)]] as [string, string][])
                    : []),
                  ...(order.totals.tipCents
                    ? ([["Mancia rider (fuori IVA)", formatEuro(order.totals.tipCents)]] as [
                        string,
                        string,
                      ][])
                    : []),
                  ...order.totals.vatBreakdown.map(
                    (v) => [`di cui IVA ${v.rateBps / 100}%`, formatEuro(v.vatCents)] as [string, string],
                  ),
                  [
                    <strong key="t">Totale</strong>,
                    <strong key="v">{formatEuro(order.totals.totalCents)}</strong>,
                  ],
                ]}
              />
            </div>
          </Panel>

          <Panel title="Cronologia">
            <ol className="space-y-3">
              {order.history.map((h) => (
                <li key={h.id} className="flex gap-3 text-body-sm">
                  <span className="w-20 shrink-0 text-fg-muted tabular-nums">
                    {clock(h.createdAt, timeZone)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{COMMAND_LABEL[h.command] ?? h.command}</span>
                    <span className="text-fg-muted">
                      {" "}
                      · {h.actorName ?? ACTOR_LABEL[h.actorType] ?? h.actorType}
                    </span>
                    {h.note ? <span className="block text-fg-muted">“{h.note}”</span> : null}
                  </span>
                  <span className="hidden text-caption text-fg-subtle sm:block">
                    {ORDER_STATUS_LABELS[h.status]}
                  </span>
                </li>
              ))}
            </ol>
          </Panel>

          {order.emails.length ? (
            <Panel title="E-mail inviate">
              <ul className="space-y-1.5 text-body-sm">
                {order.emails.map((e, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{e.subject}</span>
                    <span className="shrink-0 text-fg-muted">
                      {clock(e.createdAt, timeZone)} ·{" "}
                      {e.status === "SENT"
                        ? "inviata"
                        : e.status === "FAILED"
                          ? "non riuscita"
                          : e.status === "SKIPPED"
                            ? "anteprima (sviluppo)"
                            : "in coda"}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-6">
          <Panel title="Cliente">
            <p className="font-semibold">{order.customerName}</p>
            <div className="mt-2 space-y-1.5 text-body-sm">
              <a
                href={`mailto:${order.customerEmail}`}
                className="flex items-center gap-2 text-fg-muted hover:text-fg"
              >
                <Mail className="size-4" /> {order.customerEmail}
              </a>
              {order.customerPhone ? (
                <a
                  href={`tel:${order.customerPhone}`}
                  className="flex items-center gap-2 text-fg-muted hover:text-fg"
                >
                  <Phone className="size-4" /> {order.customerPhone}
                </a>
              ) : null}
              {order.customerUserId ? (
                <Link
                  href={`/admin/clienti/${order.customerUserId}`}
                  className="inline-block pt-1 font-semibold text-brand-ink"
                >
                  Scheda cliente
                </Link>
              ) : (
                <p className="pt-1 text-caption text-fg-subtle">Ordine come ospite</p>
              )}
            </div>
          </Panel>

          {order.address ? (
            <Panel title="Consegna" padded={false}>
              {destination ? (
                <div className="mx-5 mt-4 h-52 overflow-hidden rounded-xl">
                  <Map
                    center={destination}
                    zoom={15}
                    interactive={false}
                    ariaLabel="Destinazione della consegna"
                    markers={[
                      { id: "destination", kind: "destination", position: destination },
                      ...(order.riderLocation
                        ? [
                            {
                              id: "rider",
                              kind: "rider" as const,
                              position: { lat: order.riderLocation.lat, lng: order.riderLocation.lng },
                              heading: order.riderLocation.heading,
                            },
                          ]
                        : []),
                    ]}
                    fitTo={
                      order.riderLocation
                        ? [destination, { lat: order.riderLocation.lat, lng: order.riderLocation.lng }]
                        : null
                    }
                  />
                </div>
              ) : null}
              <div className="space-y-1 p-5 text-body-sm">
                <p className="flex items-start gap-2 font-semibold">
                  <MapPin className="mt-0.5 size-4 shrink-0" /> {order.address.line}
                </p>
                <p className="text-fg-muted">
                  {[
                    order.address.staircase && `Scala ${order.address.staircase}`,
                    order.address.floor && `Piano ${order.address.floor}`,
                    order.address.apartment && `Int. ${order.address.apartment}`,
                    order.address.intercom && `Citofono ${order.address.intercom}`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Nessun dettaglio aggiuntivo"}
                </p>
                {order.address.riderNotes ? <p>“{order.address.riderNotes}”</p> : null}
                <p className="pt-2 text-fg-muted">
                  {order.zoneName ? `${order.zoneName} · ` : ""}
                  {order.routeDistanceMeters
                    ? `${(order.routeDistanceMeters / 1000).toFixed(1).replace(".", ",")} km`
                    : ""}
                  {order.routeDurationSeconds
                    ? ` · ${Math.round(order.routeDurationSeconds / 60)} min di strada`
                    : ""}
                </p>
                <p className="pt-2">
                  Rider: <strong>{order.rider?.name ?? "non assegnato"}</strong>
                </p>
              </div>
            </Panel>
          ) : null}

          <Panel title="Pagamento">
            {order.payments.length === 0 ? (
              <p className="text-body-sm text-fg-muted">Nessun pagamento registrato.</p>
            ) : null}
            <ul className="space-y-3 text-body-sm">
              {order.payments.map((p) => (
                <li key={p.id} className="rounded-xl bg-surface-2 p-3">
                  <p className="flex justify-between font-semibold">
                    <span>
                      {p.provider === "CASH"
                        ? "Contanti"
                        : p.wallet === "apple_pay"
                          ? "Apple Pay"
                          : p.wallet === "google_pay"
                            ? "Google Pay"
                            : p.cardBrand
                              ? `${p.cardBrand.toUpperCase()} •••• ${p.cardLast4}`
                              : p.provider === "DEV"
                                ? "Pagamento di prova"
                                : "Carta"}
                    </span>
                    <span className="tabular-nums">{formatEuro(p.amountCents)}</span>
                  </p>
                  <p className="text-caption text-fg-muted">
                    {p.status}
                    {p.refundedCents ? ` · rimborsati ${formatEuro(p.refundedCents)}` : ""}
                    {p.failureMessage ? ` · ${p.failureMessage}` : ""}
                  </p>
                  {p.providerPaymentId && p.provider === "STRIPE" ? (
                    <a
                      href={`https://dashboard.stripe.com/payments/${p.providerPaymentId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-caption font-semibold text-brand-ink"
                    >
                      Apri su Stripe <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
            {order.refunds.length ? (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 text-caption font-semibold text-fg-muted uppercase">Rimborsi</p>
                <ul className="space-y-1.5 text-body-sm">
                  {order.refunds.map((r) => (
                    <li key={r.id} className="flex justify-between gap-3">
                      <span>
                        {formatOrderDate(r.createdAt, timeZone)} · {r.reason ?? "—"}{" "}
                        {r.createdBy ? `(${r.createdBy})` : ""}
                      </span>
                      <span className="tabular-nums">
                        {formatEuro(r.amountCents)} ·{" "}
                        {r.status === "SUCCEEDED" ? "ok" : r.status === "FAILED" ? "fallito" : "in corso"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {order.cancellationReason ? (
              <p className="mt-3 text-body-sm text-danger">Motivo annullamento: {order.cancellationReason}</p>
            ) : null}
          </Panel>

          {order.supportTickets.length ? (
            <Panel title="Assistenza">
              <ul className="space-y-1.5 text-body-sm">
                {order.supportTickets.map((t) => (
                  <li key={t.id}>
                    <Link href={`/admin/assistenza/${t.id}`} className="font-semibold text-brand-ink">
                      {t.reference}
                    </Link>{" "}
                    · {t.subject}
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>

      <AcceptDialog
        key={`accept-${dialog}`}
        order={dialog === "accept" ? order : null}
        options={[10, 15, 20, 25, 30, 45]}
        defaultMinutes={15}
        busy={command.isPending}
        onClose={() => setDialog(null)}
        onConfirm={(m) => run({ command: "CONFIRM", prepMinutes: m })}
      />
      <ReasonDialog
        key={`reason-${dialog}`}
        order={dialog === "reject" || dialog === "cancel" ? order : null}
        mode={dialog === "cancel" ? "cancel" : "reject"}
        busy={command.isPending}
        onClose={() => setDialog(null)}
        onConfirm={(reason) =>
          run(dialog === "cancel" ? { command: "CANCEL", reason } : { command: "REJECT", reason })
        }
      />
      <RiderPicker
        order={dialog === "rider" ? order : null}
        riders={riders}
        busy={command.isPending}
        onClose={() => setDialog(null)}
        onAssign={(riderId) => run({ command: "ASSIGN_RIDER", riderId })}
      />
      {dialog === "refund" ? <RefundDialog order={order} open onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
