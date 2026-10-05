"use client";

import { formatEuro } from "@dimsum/domain";
import type { RiderActionKey, RiderDeliveryDTO, RiderHomeDTO } from "@dimsum/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  BellRing,
  Bike,
  ChefHat,
  CircleCheck,
  LocateFixed,
  LocateOff,
  LogOut,
  Navigation,
  Phone,
  Store,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Seal } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";
import { enablePush, pushState } from "@/lib/push";
import { useRealtime } from "@/lib/realtime";
import { navigationUrl, useRiderLocation } from "@/lib/rider/location";

const homeKey = ["rider", "home"] as const;
const noop = () => () => {};

const ACTION_LABEL: Record<RiderActionKey, string> = {
  TO_RESTAURANT: "Vado al ristorante",
  ARRIVED: "Sono al ristorante",
  PICKED_UP: "Ho ritirato l'ordine",
  START_DELIVERY: "Parto per la consegna",
  DELIVERED: "Consegnato",
};

const STEP_LABEL: Record<RiderDeliveryDTO["status"], string> = {
  UNASSIGNED: "Da assegnare",
  ASSIGNED: "Nuova consegna",
  TO_RESTAURANT: "Verso il ristorante",
  AT_RESTAURANT: "Al ristorante",
  PICKED_UP: "Ritirato",
  ON_THE_WAY: "In consegna",
  DELIVERED: "Consegnato",
  CANCELLED: "Annullato",
};

function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone }).format(
    new Date(iso),
  );
}

function openNavigation(destination: { lat: number; lng: number }) {
  window.open(navigationUrl(destination), "_blank", "noopener");
}

function DeliveryCard({
  d,
  restaurant,
  busy,
  onAction,
}: {
  d: RiderDeliveryDTO;
  restaurant: RiderHomeDTO["restaurant"];
  busy: boolean;
  onAction: (a: RiderActionKey) => void;
}) {
  const pickedUp = d.status === "PICKED_UP" || d.status === "ON_THE_WAY";
  // The next step follows where the rider is, not just what the rules allow.
  const byStep: Record<RiderDeliveryDTO["status"], RiderActionKey[]> = {
    UNASSIGNED: [],
    ASSIGNED: ["TO_RESTAURANT", "ARRIVED"],
    TO_RESTAURANT: ["ARRIVED", "PICKED_UP"],
    AT_RESTAURANT: ["PICKED_UP"],
    PICKED_UP: ["START_DELIVERY", "DELIVERED"],
    ON_THE_WAY: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
  };
  const primary = byStep[d.status].find((a) => d.actions.includes(a));
  const extraDetails = [
    d.destination.staircase && `Scala ${d.destination.staircase}`,
    d.destination.floor && `Piano ${d.destination.floor}`,
    d.destination.apartment && `Int. ${d.destination.apartment}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
      <header className="flex items-center justify-between gap-3 px-5 pt-5">
        <div>
          <p className="text-caption font-semibold tracking-wide text-fg-muted uppercase">
            {STEP_LABEL[d.status]}
          </p>
          <h2 className="text-headline font-extrabold tabular-nums">#{d.number}</h2>
        </div>
        <div className="text-right text-body-sm">
          <p className="font-semibold">{d.itemCount} articoli</p>
          {d.tipCents ? <p className="text-success">Mancia {formatEuro(d.tipCents)}</p> : null}
        </div>
      </header>

      <ol className="mt-4 space-y-px">
        <li className={cn("flex gap-4 px-5 py-4", pickedUp ? "opacity-55" : "bg-white/3")}>
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-surface-3">
            <Store className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Ritiro · {restaurant.name}</p>
            <p className="text-body-sm text-fg-muted">{restaurant.addressLine}</p>
            <p className="mt-1 flex items-center gap-1.5 text-body-sm">
              <ChefHat className="size-4 text-fg-muted" />
              {d.readyAt ? (
                <span className="font-semibold text-success">Pronto</span>
              ) : d.readyBy ? (
                <span>Pronto verso le {clock(d.readyBy, restaurant.timezone)}</span>
              ) : (
                <span className="text-fg-muted">In attesa della cucina</span>
              )}
            </p>
          </div>
          {!pickedUp ? (
            <button
              type="button"
              onClick={() => openNavigation(restaurant.location)}
              aria-label="Naviga verso il ristorante"
              className="grid size-11 shrink-0 tap place-items-center rounded-full bg-surface-3"
            >
              <Navigation className="size-5" />
            </button>
          ) : null}
        </li>
        <li className={cn("flex gap-4 px-5 py-4", pickedUp && "bg-white/3")}>
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-red-500 text-white">
            <Bike className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Consegna · {d.customer.firstName}</p>
            <p className="text-body-sm">{d.destination.addressLine}</p>
            {extraDetails ? <p className="text-body-sm text-fg-muted">{extraDetails}</p> : null}
            {d.destination.intercom ? (
              <p className="text-body-sm text-fg-muted">Citofono: {d.destination.intercom}</p>
            ) : null}
            {d.destination.notes ? (
              <p className="mt-1 rounded-lg bg-warning-soft px-2.5 py-1.5 text-body-sm">
                “{d.destination.notes}”
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            {d.destination.location ? (
              <button
                type="button"
                onClick={() => openNavigation(d.destination.location!)}
                aria-label="Naviga verso il cliente"
                className="grid size-11 tap place-items-center rounded-full bg-surface-3"
              >
                <Navigation className="size-5" />
              </button>
            ) : null}
            {d.customer.phone ? (
              <a
                href={`tel:${d.customer.phone}`}
                aria-label={`Chiama ${d.customer.firstName}`}
                className="grid size-11 tap place-items-center rounded-full bg-surface-3"
              >
                <Phone className="size-5" />
              </a>
            ) : null}
          </div>
        </li>
      </ol>

      {d.collectCents !== null ? (
        <p className="mx-5 mt-1 flex items-center gap-2 rounded-xl bg-warning-soft px-4 py-3 font-bold">
          <Banknote className="size-5 text-warning" /> Incassa {formatEuro(d.collectCents)} in contanti
        </p>
      ) : (
        <p className="mx-5 mt-1 flex items-center gap-2 text-body-sm text-fg-muted">
          <CircleCheck className="size-4 text-success" /> Già pagato online
        </p>
      )}

      <details className="mx-5 mt-3 text-body-sm">
        <summary className="cursor-pointer font-semibold text-fg-muted">Controlla la busta</summary>
        <ul className="mt-2 space-y-1">
          {d.items.map((i, idx) => (
            <li key={idx}>
              <span className="font-semibold tabular-nums">{i.quantity}×</span> {i.name}
            </li>
          ))}
        </ul>
      </details>

      {primary ? (
        <div className="p-5">
          <Button
            size="xl"
            block
            className="h-15 text-title"
            loading={busy}
            onClick={() => onAction(primary)}
          >
            {ACTION_LABEL[primary]}
          </Button>
        </div>
      ) : (
        <p className="p-5 text-center text-body-sm text-fg-muted">
          La cucina sta ancora preparando l&apos;ordine.
        </p>
      )}
    </article>
  );
}

export function RiderApp({ initial }: { initial: RiderHomeDTO }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { data = initial } = useQuery({
    queryKey: homeKey,
    queryFn: ({ signal }) => api.rider.home(signal),
    initialData: initial,
    initialDataUpdatedAt: 0,
    refetchInterval: 30_000,
  });
  const [confirming, setConfirming] = useState<RiderDeliveryDTO | null>(null);
  const push = useSyncExternalStore(noop, pushState, () => "default" as const);
  const known = useRef(new Set(initial.deliveries.map((d) => d.orderId)));

  useRealtime([`rider:${data.rider.id}`], () => void qc.invalidateQueries({ queryKey: homeKey }), {
    onReconnect: () => void qc.invalidateQueries({ queryKey: homeKey }),
  });

  // A new assignment: vibrate and announce it.
  useEffect(() => {
    const fresh = data.deliveries.filter((d) => !known.current.has(d.orderId));
    if (fresh.length) {
      if ("vibrate" in navigator) navigator.vibrate?.([300, 120, 300]);
      toast.success(`Nuova consegna #${fresh[0]!.number}`);
    }
    known.current = new Set(data.deliveries.map((d) => d.orderId));
  }, [data.deliveries]);

  const current = data.deliveries.find((d) => d.status !== "ASSIGNED") ?? null;
  const location = useRiderLocation({
    enabled: data.shareLocation,
    deliveryId: current?.deliveryId ?? null,
    highAccuracy: current?.status === "PICKED_UP" || current?.status === "ON_THE_WAY",
  });

  const shift = useMutation({
    mutationFn: (online: boolean) => api.rider.setOnline(online),
    onSuccess: (home) => {
      qc.setQueryData(homeKey, home);
      haptics.success();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Operazione non riuscita."),
  });
  const action = useMutation({
    mutationFn: ({ orderId, a }: { orderId: string; a: RiderActionKey }) =>
      api.rider.action(
        orderId,
        a === "DELIVERED" ? { action: "DELIVERED", cashCollectedCents: null } : { action: a },
      ),
    onSuccess: (home) => {
      qc.setQueryData(homeKey, home);
      haptics.success();
      setConfirming(null);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Operazione non riuscita. Riprova."),
  });

  const online = data.rider.availability !== "OFFLINE";

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pt-[calc(var(--safe-top)+12px)] pb-[calc(var(--safe-bottom)+32px)]">
      <header className="flex items-center gap-3">
        <Seal className="h-9 text-red-500" />
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold tracking-[0.2em] text-fg-muted uppercase">Rider</p>
          <p className="truncate text-title font-extrabold">Ciao, {data.rider.name}</p>
        </div>
        <label className="flex items-center gap-2.5 rounded-full bg-surface px-3.5 py-2 ring-1 ring-line">
          <span className={cn("text-body-sm font-semibold", online ? "text-success" : "text-fg-muted")}>
            {online ? "In servizio" : "Fuori servizio"}
          </span>
          <Switch
            checked={online}
            disabled={shift.isPending}
            onCheckedChange={(v) => shift.mutate(v)}
            aria-label="In servizio"
          />
        </label>
      </header>

      <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[
          ["Consegne oggi", String(data.today.delivered)],
          ["Mance", formatEuro(data.today.tipsCents)],
          ["Contanti", formatEuro(data.today.cashCollectedCents)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-surface py-3 ring-1 ring-line">
            <dt className="text-caption text-fg-muted">{k}</dt>
            <dd className="text-title font-extrabold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      {data.shareLocation ? (
        <p
          className={cn(
            "mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-body-sm",
            location === "denied" || location === "unavailable"
              ? "bg-danger-soft text-danger"
              : "bg-surface text-fg-muted ring-1 ring-line",
          )}
          role="status"
        >
          {location === "denied" || location === "unavailable" ? (
            <LocateOff className="size-4.5 shrink-0" />
          ) : (
            <LocateFixed className="size-4.5 shrink-0 text-success" />
          )}
          {location === "denied"
            ? "Posizione bloccata: il cliente non vede dove sei. Riattivala nelle impostazioni del browser."
            : location === "unavailable"
              ? "Posizione non disponibile su questo dispositivo."
              : "Posizione condivisa solo durante la consegna. Tieni l'app aperta per aggiornarla."}
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        {!online ? (
          <div className="rounded-3xl bg-surface p-6 text-center ring-1 ring-line">
            <Bike className="mx-auto size-10 text-fg-muted" />
            <p className="mt-3 text-title font-bold">Sei fuori servizio</p>
            <p className="mt-1 text-body-sm text-fg-muted">
              Quando inizi il turno il ristorante può assegnarti le consegne. La posizione non viene mai
              rilevata fuori servizio.
            </p>
            <Button
              size="xl"
              block
              className="mt-5 h-14"
              loading={shift.isPending}
              onClick={() => shift.mutate(true)}
            >
              Inizia il turno
            </Button>
          </div>
        ) : data.deliveries.length === 0 ? (
          <div className="rounded-3xl bg-surface p-6 text-center ring-1 ring-line">
            <span className="relative mx-auto grid size-16 place-items-center">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-success/30" />
              <Bike className="relative size-8 text-success" />
            </span>
            <p className="mt-3 text-title font-bold">In attesa di consegne</p>
            <p className="mt-1 text-body-sm text-fg-muted">
              Ti avvisiamo appena il ristorante ti assegna un ordine.
            </p>
            {push === "default" ? (
              <Button
                className="mt-5"
                variant="secondary"
                onClick={() =>
                  void enablePush({ topic: "rider" }).then(
                    (s) => s === "granted" && toast.success("Notifiche attive"),
                  )
                }
              >
                <BellRing className="size-4.5" /> Avvisami con una notifica
              </Button>
            ) : null}
          </div>
        ) : (
          data.deliveries.map((d) => (
            <DeliveryCard
              key={d.orderId}
              d={d}
              restaurant={data.restaurant}
              busy={action.isPending && action.variables?.orderId === d.orderId}
              onAction={(a) =>
                a === "DELIVERED" ? setConfirming(d) : action.mutate({ orderId: d.orderId, a })
              }
            />
          ))
        )}
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3 text-body-sm">
        {data.restaurant.phone ? (
          <a
            href={`tel:${data.restaurant.phone}`}
            className="inline-flex items-center gap-1.5 font-semibold text-fg-muted"
          >
            <Phone className="size-4" /> Chiama il ristorante
          </a>
        ) : null}
        {!online ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 font-semibold text-fg-muted"
            onClick={async () => {
              await signOut();
              router.replace("/rider/login");
            }}
          >
            <LogOut className="size-4" /> Esci
          </button>
        ) : null}
      </div>

      <Dialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming ? `Consegnato #${confirming.number}?` : ""}
        description={
          confirming?.collectCents !== null && confirming
            ? `Conferma di aver incassato ${formatEuro(confirming.collectCents)} in contanti.`
            : "Conferma solo dopo aver consegnato la busta al cliente."
        }
        size="sm"
        footer={
          <Button
            size="xl"
            block
            className="h-14"
            loading={action.isPending}
            onClick={() => confirming && action.mutate({ orderId: confirming.orderId, a: "DELIVERED" })}
          >
            {confirming?.collectCents !== null && confirming
              ? `Incassato ${formatEuro(confirming.collectCents)} · Consegnato`
              : "Sì, consegnato"}
          </Button>
        }
      >
        <span className="sr-only">Conferma consegna</span>
      </Dialog>
    </div>
  );
}
