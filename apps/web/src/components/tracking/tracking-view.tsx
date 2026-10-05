"use client";

import { formatEuro, ORDER_STATUS_LABELS } from "@dimsum/domain";
import type { OrderTrackingDTO, RiderLocationDTO } from "@dimsum/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, ChevronDown, Headset, Link2, Phone, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Map, type MapMarker } from "@/components/maps/map";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { InlineAlert } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { toast } from "@/components/ui/toaster";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { enablePush, pushState } from "@/lib/push";
import { useRealtime } from "@/lib/realtime";
import { SuccessOverlay } from "./success-overlay";
import { OrderTimeline } from "./timeline";

const noopSubscribe = () => () => {};

const hm = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

function headline(o: OrderTrackingDTO): { title: string; subtitle: string | null } {
  const delivery = o.fulfillmentType === "DELIVERY";
  const window = o.eta ? `${hm.format(new Date(o.eta.from))}–${hm.format(new Date(o.eta.to))}` : null;
  switch (o.status) {
    case "PENDING_PAYMENT":
      return {
        title: "In attesa del pagamento",
        subtitle: "Completa il pagamento per inviare l'ordine in cucina.",
      };
    case "CANCELLED":
      return { title: "Ordine annullato", subtitle: o.cancellationReason };
    case "REFUNDED":
      return { title: "Ordine rimborsato", subtitle: o.cancellationReason };
    case "DELIVERED":
      return { title: delivery ? "Consegnato. Buon appetito!" : "Ritirato. Buon appetito!", subtitle: null };
    case "PICKED_UP":
    case "ON_THE_WAY":
      return {
        title: o.eta ? `Arriva tra circa ${o.eta.minutes} min` : "In consegna",
        subtitle: window ? `Arrivo previsto ${window}` : null,
      };
    case "READY_FOR_PICKUP":
      if (!delivery) return { title: "Pronto per il ritiro!", subtitle: "Ti aspettiamo al banco." };
      return {
        title: "Pronto, il rider sta arrivando",
        subtitle: window ? `Arrivo previsto ${window}` : null,
      };
    default:
      return delivery
        ? {
            title: o.eta ? `Arrivo previsto ${window}` : "Ordine ricevuto",
            subtitle: ORDER_STATUS_LABELS[o.status],
          }
        : {
            title: o.eta ? `Pronto per le ${hm.format(new Date(o.eta.to))}` : "Ordine ricevuto",
            subtitle: ORDER_STATUS_LABELS[o.status],
          };
  }
}

export function TrackingView({ initial }: { initial: OrderTrackingDTO }) {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const key = ["order", initial.publicId];
  const [riderLocation, setRiderLocation] = useState<RiderLocationDTO | null>(null);
  const searchParams = useSearchParams();
  const [successDismissed, setSuccessDismissed] = useState(false);
  const showSuccess = searchParams.get("placed") === "1" && !successDismissed;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const browserPush = useSyncExternalStore(noopSubscribe, pushState, () => "unsupported" as const);
  const [pushOverride, setPush] = useState<ReturnType<typeof pushState> | null>(null);
  const push = pushOverride ?? browserPush;

  const realtime = useRealtime(
    [`order:${initial.publicId}`],
    (event) => {
      if (event.type === "order.updated" || event.type === "order.eta")
        void qc.invalidateQueries({ queryKey: key });
      if (event.type === "rider.location") setRiderLocation(event.location);
    },
    { onReconnect: () => void qc.invalidateQueries({ queryKey: key }) },
  );

  const { data: order } = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.orders.track(initial.publicId, signal),
    initialData: initial,
    initialDataUpdatedAt: 0,
    // Realtime first; slow polling only while the stream is down.
    refetchInterval: realtime === "open" ? false : 20_000,
  });

  const live = !!order.delivery?.liveTrackingActive;
  useQuery({
    queryKey: ["order", initial.publicId, "rider"],
    queryFn: async () => {
      const { location } = await api.orders.riderLocation(initial.publicId);
      if (location) setRiderLocation(location);
      return location;
    },
    enabled: live,
    refetchInterval: realtime === "open" ? 60_000 : 12_000,
  });
  const { data: route } = useQuery({
    queryKey: ["order", initial.publicId, "route"],
    queryFn: () => api.orders.routeGeometry(initial.publicId),
    enabled:
      order.fulfillmentType === "DELIVERY" && order.status !== "DELIVERED" && order.status !== "CANCELLED",
    staleTime: Infinity,
  });

  const closeSuccess = () => {
    setSuccessDismissed(true);
    window.history.replaceState(null, "", `/order/${initial.publicId}`);
  };

  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [
      {
        id: "restaurant",
        kind: "restaurant",
        position: order.restaurant.location,
        label: order.restaurant.name,
      },
    ];
    if (order.delivery)
      m.push({
        id: "destination",
        kind: "destination",
        position: order.delivery.destination,
        label: "La tua destinazione",
      });
    if (live && riderLocation)
      m.push({
        id: "rider",
        kind: "rider",
        position: { lat: riderLocation.lat, lng: riderLocation.lng },
        heading: riderLocation.heading,
        label: "Rider",
      });
    return m;
  }, [order.restaurant, order.delivery, live, riderLocation]);

  const { title, subtitle } = headline(order);
  const rider = order.delivery?.rider;
  const cancelled = order.status === "CANCELLED" || order.status === "REFUNDED";

  const cancel = async () => {
    try {
      await api.orders.cancel(order.publicId, cancelReason.trim() || "Annullato dal cliente");
      setCancelOpen(false);
      toast.success("Ordine annullato");
      void qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Annullamento non riuscito.");
    }
  };

  const claim = async () => {
    try {
      await api.orders.claim(order.publicId);
      toast.success("Ordine collegato al tuo account");
      void qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Operazione non riuscita.");
    }
  };

  const etaLabel = order.eta
    ? `${hm.format(new Date(order.eta.from))} – ${hm.format(new Date(order.eta.to))}`
    : null;

  return (
    <div data-theme="dark" className="min-h-dvh bg-canvas text-fg">
      <SuccessOverlay
        open={showSuccess}
        number={order.number}
        emailMasked={order.customer.email}
        etaLabel={etaLabel}
        pendingPayment={order.status === "PENDING_PAYMENT"}
        isGuest={order.isClaimable && !session}
        signupHref={`/registrati?ordine=${order.publicId}`}
        onTrack={closeSuccess}
      />

      <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-8 lg:px-8 lg:py-8">
        {/* Map */}
        {order.delivery ? (
          <div className="relative h-[42dvh] min-h-72 lg:sticky lg:top-8 lg:h-[calc(100dvh-4rem)] lg:overflow-hidden lg:rounded-3xl">
            <Map
              center={order.delivery.destination}
              theme="dark"
              markers={markers}
              route={route?.geometry ?? null}
              fitTo={
                live && riderLocation
                  ? [{ lat: riderLocation.lat, lng: riderLocation.lng }, order.delivery.destination]
                  : [order.restaurant.location, order.delivery.destination]
              }
              padding={{ top: 90, bottom: 60, left: 48, right: 48 }}
              ariaLabel="Mappa della consegna"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-canvas to-transparent lg:hidden" />
            {!live && !cancelled && order.status !== "DELIVERED" ? (
              <p className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3.5 py-1.5 text-caption whitespace-nowrap text-white backdrop-blur">
                Vedrai il rider sulla mappa appena ritira l&apos;ordine
              </p>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            "relative space-y-5 bg-canvas px-5 pb-[calc(var(--safe-bottom)+32px)] lg:mt-0 lg:rounded-none lg:px-0 lg:pt-0",
            order.delivery ? "-mt-6 rounded-t-3xl pt-5" : "pt-[calc(var(--safe-top)+20px)]",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-caption font-semibold tracking-wide text-fg-muted uppercase">
                Ordine #{order.number}
              </p>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.h1
                  key={title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-1 text-display leading-tight font-extrabold"
                >
                  {title}
                </motion.h1>
              </AnimatePresence>
              {subtitle ? <p className="mt-1 text-body text-fg-muted">{subtitle}</p> : null}
            </div>
            <Link
              href="/"
              aria-label="Chiudi"
              className="grid size-10 shrink-0 tap place-items-center rounded-full bg-surface ring-1 ring-line"
            >
              <X className="size-5" />
            </Link>
          </div>

          {realtime === "reconnecting" ? (
            <p className="flex items-center gap-2 text-caption text-warning" role="status">
              <span className="size-2 animate-pulse rounded-full bg-warning" /> Riconnessione in corso: gli
              aggiornamenti potrebbero arrivare con qualche secondo di ritardo.
            </p>
          ) : null}

          {order.status === "PENDING_PAYMENT" ? (
            <InlineAlert
              tone="warning"
              title="Pagamento non completato"
              action={
                <Button asChild size="sm" variant="secondary">
                  <Link href="/checkout">Completa il pagamento</Link>
                </Button>
              }
            />
          ) : null}

          {rider && !cancelled && order.status !== "DELIVERED" ? (
            <div className="flex items-center gap-3.5 rounded-2xl bg-surface p-4 ring-1 ring-line">
              <Avatar name={rider.firstName} src={rider.avatarUrl} className="bg-red-500" />
              <div className="min-w-0 flex-1">
                <p className="text-caption text-fg-muted">Il tuo rider</p>
                <p className="font-bold">{live ? `${rider.firstName} sta arrivando` : rider.firstName}</p>
              </div>
              <Button asChild size="icon" variant="secondary" aria-label="Assistenza">
                <Link href={`/order/${order.publicId}/assistenza`}>
                  <Headset className="size-5" />
                </Link>
              </Button>
            </div>
          ) : null}

          <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
            <OrderTimeline steps={order.timeline} cancelled={cancelled} />
          </section>

          {!cancelled && order.status !== "DELIVERED" && push !== "unsupported" ? (
            <button
              type="button"
              disabled={push === "granted" || push === "denied"}
              onClick={async () => setPush(await enablePush({ orderPublicId: order.publicId }))}
              className="flex w-full tap items-center gap-3 rounded-2xl bg-surface p-4 text-left ring-1 ring-line disabled:opacity-70"
            >
              {push === "granted" ? (
                <BellRing className="size-5 text-success" />
              ) : (
                <Bell className="size-5 text-red-400" />
              )}
              <span className="text-body-sm">
                <span className="block font-semibold">
                  {push === "granted"
                    ? "Notifiche attive"
                    : push === "denied"
                      ? "Notifiche bloccate dal browser"
                      : "Avvisami a ogni passaggio"}
                </span>
                <span className="block text-fg-muted">
                  {push === "granted"
                    ? "Ti avviseremo anche a schermo spento."
                    : push === "denied"
                      ? "Puoi riattivarle dalle impostazioni del browser."
                      : order.fulfillmentType === "DELIVERY"
                        ? "Ricevi una notifica quando il rider è in arrivo."
                        : "Ricevi una notifica quando l'ordine è pronto."}
                </span>
              </span>
            </button>
          ) : null}

          <section className="rounded-2xl bg-surface ring-1 ring-line">
            <button
              type="button"
              onClick={() => setDetailsOpen((o) => !o)}
              aria-expanded={detailsOpen}
              className="flex w-full items-center justify-between p-4 font-semibold"
            >
              Dettagli dell&apos;ordine · {formatEuro(order.totals.totalCents)}
              <ChevronDown className={cn("size-5 transition-transform", detailsOpen && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {detailsOpen ? (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-4 border-t border-line p-4 text-body-sm">
                    <ul className="space-y-2">
                      {order.items.map((i) => (
                        <li key={i.id} className="flex justify-between gap-3">
                          <span>
                            {i.quantity}× {i.name}
                            {i.modifiers.length ? (
                              <span className="block text-caption text-fg-muted">
                                {i.modifiers.map((m) => m.name).join(", ")}
                              </span>
                            ) : null}
                            {i.notes ? (
                              <span className="block text-caption text-fg-muted">“{i.notes}”</span>
                            ) : null}
                          </span>
                          <span className="tabular-nums">{formatEuro(i.lineTotalCents)}</span>
                        </li>
                      ))}
                    </ul>
                    <dl className="space-y-1 border-t border-line pt-3">
                      <div className="flex justify-between">
                        <dt className="text-fg-muted">Subtotale</dt>
                        <dd className="tabular-nums">{formatEuro(order.totals.subtotalCents)}</dd>
                      </div>
                      {order.totals.discountCents ? (
                        <div className="flex justify-between">
                          <dt className="text-fg-muted">Sconto</dt>
                          <dd className="text-success tabular-nums">
                            −{formatEuro(order.totals.discountCents)}
                          </dd>
                        </div>
                      ) : null}
                      {order.fulfillmentType === "DELIVERY" ? (
                        <div className="flex justify-between">
                          <dt className="text-fg-muted">Consegna</dt>
                          <dd className="tabular-nums">
                            {order.totals.deliveryFeeCents
                              ? formatEuro(order.totals.deliveryFeeCents)
                              : "Gratis"}
                          </dd>
                        </div>
                      ) : null}
                      {order.totals.tipCents ? (
                        <div className="flex justify-between">
                          <dt className="text-fg-muted">Mancia al rider</dt>
                          <dd className="tabular-nums">{formatEuro(order.totals.tipCents)}</dd>
                        </div>
                      ) : null}
                      <div className="flex justify-between pt-1 font-bold">
                        <dt>Totale</dt>
                        <dd className="tabular-nums">{formatEuro(order.totals.totalCents)}</dd>
                      </div>
                    </dl>
                    <p className="text-caption text-fg-muted">
                      {order.payment.method === "CASH_ON_DELIVERY"
                        ? "Pagamento in contanti"
                        : order.payment.brand
                          ? `Pagato con ${order.payment.brand.toUpperCase()} •••• ${order.payment.last4}`
                          : "Pagamento online"}
                      {order.delivery
                        ? ` · Consegna a ${order.delivery.addressLine}`
                        : ` · Ritiro da ${order.restaurant.addressLine}`}
                    </p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <Button asChild variant="secondary" block>
              <Link href={`/order/${order.publicId}/assistenza`}>
                <Headset className="size-4.5" /> Contatta assistenza
              </Link>
            </Button>
            {order.restaurant.phone ? (
              <Button asChild variant="secondary" block>
                <a href={`tel:${order.restaurant.phone}`}>
                  <Phone className="size-4.5" /> Chiama il ristorante
                </a>
              </Button>
            ) : null}
          </div>

          {session && order.isClaimable ? (
            <Button variant="soft" block onClick={() => void claim()}>
              <Link2 className="size-4.5" /> Collega l&apos;ordine al mio account
            </Button>
          ) : null}

          {order.canCancel ? (
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="mx-auto block text-body-sm font-semibold text-danger underline-offset-4 hover:underline"
            >
              Annulla ordine
            </button>
          ) : null}
        </div>
      </div>

      <Dialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Annullare l'ordine?"
        description="Puoi annullare finché la cucina non lo conferma. Se hai già pagato riceverai il rimborso completo."
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" block onClick={() => setCancelOpen(false)}>
              No, tienilo
            </Button>
            <Button variant="danger" block onClick={() => void cancel()}>
              Sì, annulla
            </Button>
          </div>
        }
      >
        <div className="px-6 pb-4">
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            maxLength={300}
            placeholder="Motivo (facoltativo)"
            aria-label="Motivo dell'annullamento"
          />
        </div>
      </Dialog>
    </div>
  );
}
