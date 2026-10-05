"use client";

import { formatEuro } from "@dimsum/domain";
import type { DashboardDTO } from "@dimsum/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BellRing, Bike, ChefHat } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatOrderDate } from "@/lib/dates";
import { useRealtime } from "@/lib/realtime";
import { PauseControl } from "./pause-control";
import { AdminPage, CollectionBadge, OrderStatusBadge, Panel, StatTile } from "./ui";

function delta(current: number, previous: number): string | undefined {
  if (!previous) return undefined;
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% rispetto a 7 giorni fa`;
}

export function Dashboard({
  initial,
  firstName,
  timeZone,
}: {
  initial: DashboardDTO;
  firstName: string;
  timeZone: string;
}) {
  const qc = useQueryClient();
  const { data = initial } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: ({ signal }) => api.admin.dashboard(signal),
    initialData: initial,
    initialDataUpdatedAt: 0,
    refetchInterval: 60_000,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useRealtime(["kitchen"], (event) => {
    if (!event.type.startsWith("order.") && event.type !== "restaurant.status") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void qc.invalidateQueries({ queryKey: ["admin", "dashboard"] }), 800);
  });
  const restock = useMutation({
    mutationFn: (productId: string) =>
      api.admin.catalog.availability({ productIds: [productId], isAvailable: true, until: null }),
    onSuccess: () => {
      toast.success("Di nuovo disponibile");
      void qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Operazione non riuscita."),
  });

  const hour = Number(
    new Intl.DateTimeFormat("it-IT", { hour: "numeric", hourCycle: "h23", timeZone }).format(
      new Date(data.serverTime),
    ),
  );
  const greeting = hour < 13 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";
  const live = data.live;

  return (
    <AdminPage
      title={`${greeting}, ${firstName}`}
      description={new Intl.DateTimeFormat("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone,
      }).format(new Date(data.serverTime))}
      actions={<PauseControl status={data.status} />}
    >
      {live.awaitingAcceptance > 0 ? (
        <Link
          href="/admin/cucina"
          className={cn(
            "mb-6 flex items-center gap-3 rounded-2xl px-5 py-4 font-bold text-white",
            live.escalated ? "animate-alert-flash bg-danger" : "bg-warning",
          )}
        >
          <BellRing className="size-5" />
          {live.awaitingAcceptance === 1
            ? "1 ordine da accettare"
            : `${live.awaitingAcceptance} ordini da accettare`}
          {live.escalated ? ` · ${live.escalated} in attesa da troppo tempo` : ""}
          <span className="ml-auto flex items-center gap-1 text-body-sm">
            Apri la cucina <ArrowRight className="size-4" />
          </span>
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Ordini oggi"
          value={data.today.orders}
          hint={delta(data.today.orders, data.lastWeek.orders)}
        />
        <StatTile
          label="Incasso"
          value={formatEuro(data.today.revenueCents)}
          hint={delta(data.today.revenueCents, data.lastWeek.revenueCents) ?? "Mance escluse"}
        />
        <StatTile
          label="Scontrino medio"
          value={data.today.orders ? formatEuro(data.today.averageTicketCents) : "—"}
        />
        <StatTile
          label="Preparazione media"
          value={data.today.avgPrepMinutes !== null ? `${data.today.avgPrepMinutes} min` : "—"}
          hint="Dall'accettazione al pronto"
        />
        <StatTile
          label="Consegna media"
          value={data.today.avgDeliveryMinutes !== null ? `${data.today.avgDeliveryMinutes} min` : "—"}
          hint="Dall'ordine alla porta"
        />
        <StatTile
          label="Puntualità"
          value={data.today.onTimeRate !== null ? `${Math.round(data.today.onTimeRate * 100)}%` : "—"}
          tone={data.today.onTimeRate !== null && data.today.onTimeRate < 0.8 ? "danger" : undefined}
          hint="Entro la finestra promessa"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Panel
            title="Adesso"
            actions={
              <Button asChild size="sm" variant="secondary">
                <Link href="/admin/cucina">
                  <ChefHat className="size-4" /> Cucina
                </Link>
              </Button>
            }
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Da accettare", live.awaitingAcceptance, live.awaitingAcceptance ? "text-warning" : ""],
                ["In preparazione", live.preparing, ""],
                ["Pronti", live.ready, ""],
                ["In consegna", live.outForDelivery, ""],
              ].map(([label, value, cls]) => (
                <div key={label as string} className="rounded-xl bg-surface-2 p-4">
                  <p className="text-caption text-fg-muted">{label}</p>
                  <p className={cn("text-display font-extrabold tabular-nums", cls as string)}>{value}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Ultimi ordini"
            padded={false}
            actions={
              <Link href="/admin/ordini" className="text-body-sm font-semibold text-brand-ink">
                Tutti gli ordini
              </Link>
            }
          >
            <ul className="divide-y divide-line">
              {data.latest.length === 0 ? (
                <li className="px-5 py-8 text-center text-body-sm text-fg-muted">
                  Ancora nessun ordine oggi.
                </li>
              ) : null}
              {data.latest.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/admin/ordini/${o.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="w-20 font-bold tabular-nums">#{o.number}</span>
                    <span className="min-w-0 flex-1 truncate text-body-sm">
                      {o.customerName}
                      <span className="text-fg-muted"> · {formatOrderDate(o.placedAt, timeZone)}</span>
                    </span>
                    <OrderStatusBadge status={o.status} fulfillmentType={o.fulfillmentType} />
                    <CollectionBadge collection={o.collection} totalCents={o.totalCents} />
                    <span className="w-20 text-right font-semibold tabular-nums">
                      {formatEuro(o.totalCents)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            title="Rider"
            actions={
              <Link href="/admin/rider" className="text-body-sm font-semibold text-brand-ink">
                Gestisci
              </Link>
            }
          >
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Liberi", data.riders.available, "text-success"],
                ["Occupati", data.riders.busy, "text-warning"],
                ["Offline", data.riders.offline, "text-fg-subtle"],
              ].map(([label, value, cls]) => (
                <div key={label as string} className="rounded-xl bg-surface-2 py-3">
                  <Bike className={cn("mx-auto size-5", cls as string)} />
                  <p className="mt-1 text-title font-extrabold tabular-nums">{value}</p>
                  <p className="text-caption text-fg-muted">{label}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Oggi in breve">
            <dl className="space-y-2 text-body-sm">
              <div className="flex justify-between">
                <dt className="text-fg-muted">Consegne</dt>
                <dd className="font-semibold tabular-nums">{data.today.delivery}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">Ritiri</dt>
                <dd className="font-semibold tabular-nums">{data.today.pickup}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">Annullati</dt>
                <dd className="font-semibold tabular-nums">{data.today.cancelled}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">Mance ai rider</dt>
                <dd className="font-semibold tabular-nums">{formatEuro(data.today.tipsCents)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel
            title="Esauriti"
            actions={
              <Link href="/admin/menu" className="text-body-sm font-semibold text-brand-ink">
                Menu
              </Link>
            }
          >
            {data.soldOut.length === 0 ? (
              <p className="text-body-sm text-fg-muted">Tutto il menu è disponibile.</p>
            ) : (
              <ul className="space-y-2">
                {data.soldOut.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 text-body-sm">
                      <span className="block truncate font-semibold">{p.name}</span>
                      <span className="block text-caption text-fg-muted">
                        {p.availableAgainAt
                          ? `Torna disponibile ${formatOrderDate(p.availableAgainAt, timeZone)}`
                          : "Esaurito"}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={restock.isPending && restock.variables === p.id}
                      onClick={() => restock.mutate(p.id)}
                    >
                      Disponibile
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
