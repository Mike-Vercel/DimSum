"use client";

import { formatEuro } from "@dimsum/domain";
import type { AnalyticsDTO } from "@dimsum/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { api } from "@/lib/api";
import { AdminPage, Panel, StatTile } from "../ui";

type Range = "today" | "7d" | "30d";
const RED = "#d82a1e";
const INK = "#2b2724";
const GRID = "rgba(120,110,100,0.18)";
const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const euroAxis = (cents: number) =>
  cents >= 100_000 ? `${Math.round(cents / 100_000)}k €` : `${Math.round(cents / 100)} €`;
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const mins = (v: number | null) => (v === null ? "—" : `${v} min`);

function ChartTooltip({
  active,
  payload,
  label,
  money,
}: {
  active?: boolean;
  payload?: { name: string; value: number; dataKey: string }[];
  label?: string | number;
  money?: string[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-ink-950 px-3 py-2 text-caption text-white shadow-lg">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="tabular-nums">
          {p.name}: {money?.includes(p.dataKey) ? formatEuro(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

export function AnalyticsView({ initial, timeZone }: { initial: AnalyticsDTO; timeZone: string }) {
  const [range, setRange] = useState<Range>("7d");
  const { data = initial, isFetching } = useQuery({
    queryKey: ["admin", "analytics", range],
    queryFn: () => api.admin.analytics(range),
    placeholderData: keepPreviousData,
    ...(range === "7d" ? { initialData: initial, initialDataUpdatedAt: 0 } : {}),
  });
  const t = data.totals;
  const dayLabel = (d: string) =>
    new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(`${d}T12:00:00Z`),
    );
  const daily = data.daily.map((d) => ({ ...d, label: dayLabel(d.date) }));
  const hourly = data.hourly
    .filter((h) => h.hour >= 10 && h.hour <= 23)
    .map((h) => ({ ...h, label: `${h.hour}:00` }));
  const weekday = data.weekday.map((w) => ({ ...w, label: WEEKDAYS[w.weekday - 1] }));
  const topMax = Math.max(1, ...data.topProducts.map((p) => p.quantity));
  const totalOrders = Math.max(
    1,
    data.fulfillment.reduce((s, f) => s + f.orders, 0),
  );

  return (
    <AdminPage
      title="Statistiche"
      description={`Dati del ${new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", timeZone }).format(new Date(data.from))} – ${new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", timeZone }).format(new Date(new Date(data.to).getTime() - 1))} · mance escluse dall'incasso`}
      actions={
        <Segmented
          ariaLabel="Periodo"
          value={range}
          onChange={setRange}
          options={[
            { value: "today", label: "Oggi" },
            { value: "7d", label: "7 giorni" },
            { value: "30d", label: "30 giorni" },
          ]}
          className="w-72"
        />
      }
    >
      <div className={isFetching ? "opacity-70 transition-opacity" : "transition-opacity"}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile
            label="Ordini"
            value={t.orders}
            hint={t.cancelled ? `${t.cancelled} annullati` : undefined}
          />
          <StatTile
            label="Incasso"
            value={formatEuro(t.revenueCents)}
            hint={t.refundedCents ? `Rimborsati ${formatEuro(t.refundedCents)}` : undefined}
          />
          <StatTile label="Scontrino medio" value={t.orders ? formatEuro(t.averageTicketCents) : "—"} />
          <StatTile label="Clienti" value={t.customers} hint={`${t.newCustomers} nuovi`} />
          <StatTile label="Sconti concessi" value={formatEuro(t.discountsCents)} />
          <StatTile label="Mance ai rider" value={formatEuro(t.tipsCents)} />
          <StatTile
            label="Preparazione media"
            value={mins(data.times.avgPrepMinutes)}
            hint={`Accettazione in ${mins(data.times.avgAcceptMinutes)}`}
          />
          <StatTile
            label="Consegna media"
            value={mins(data.times.avgDeliveryMinutes)}
            hint={`Puntualità ${pct(data.times.onTimeRate)}`}
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          {range !== "today" ? (
            <Panel title="Incasso e ordini per giorno" className="xl:col-span-2">
              <div className="h-72" role="img" aria-label="Grafico di incasso e ordini per giorno">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis
                      yAxisId="money"
                      tickFormatter={euroAxis}
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      width={56}
                    />
                    <YAxis
                      yAxisId="orders"
                      orientation="right"
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      width={32}
                    />
                    <Tooltip
                      content={<ChartTooltip money={["revenueCents"]} />}
                      cursor={{ fill: "rgba(216,42,30,0.06)" }}
                    />
                    <Bar
                      yAxisId="money"
                      dataKey="revenueCents"
                      name="Incasso"
                      fill={RED}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={36}
                    />
                    <Line
                      yAxisId="orders"
                      dataKey="orders"
                      name="Ordini"
                      stroke={INK}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      type="monotone"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          ) : null}

          <Panel title="Ordini per ora">
            <div className="h-60" role="img" aria-label="Ordini per fascia oraria">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval={1} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(216,42,30,0.06)" }} />
                  <Bar dataKey="orders" name="Ordini" fill={RED} radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Giorni della settimana">
            <div className="h-60" role="img" aria-label="Ordini per giorno della settimana">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekday} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
                  <Tooltip
                    content={<ChartTooltip money={["revenueCents"]} />}
                    cursor={{ fill: "rgba(216,42,30,0.06)" }}
                  />
                  <Bar dataKey="orders" name="Ordini" fill={INK} radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Piatti più venduti">
            {data.topProducts.length === 0 ? (
              <p className="text-body-sm text-fg-muted">Nessuna vendita nel periodo.</p>
            ) : null}
            <ol className="space-y-2.5">
              {data.topProducts.map((p, i) => (
                <li key={`${p.productId ?? p.name}-${i}`} className="text-body-sm">
                  <div className="flex justify-between gap-3">
                    <span className="truncate font-medium">
                      {i + 1}. {p.name}
                    </span>
                    <span className="shrink-0 text-fg-muted tabular-nums">
                      {p.quantity} · {formatEuro(p.revenueCents)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-red-500"
                      style={{ width: `${(p.quantity / topMax) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <div className="space-y-6">
            <Panel title="Consegna e ritiro">
              <div className="flex h-4 overflow-hidden rounded-full bg-surface-3">
                {data.fulfillment.map((f) => (
                  <div
                    key={f.type}
                    className={f.type === "DELIVERY" ? "bg-red-500" : "bg-ink-900"}
                    style={{ width: `${(f.orders / totalOrders) * 100}%` }}
                  />
                ))}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-body-sm">
                {data.fulfillment.map((f) => (
                  <div key={f.type}>
                    <dt className="text-fg-muted">{f.type === "DELIVERY" ? "Consegne" : "Ritiri"}</dt>
                    <dd className="font-semibold tabular-nums">
                      {f.orders} · {formatEuro(f.revenueCents)}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel title="Metodi di pagamento">
              <dl className="space-y-1.5 text-body-sm">
                {data.payments.map((p) => (
                  <div key={p.method} className="flex justify-between">
                    <dt>{p.method}</dt>
                    <dd className="tabular-nums">
                      {p.orders} ordini · {formatEuro(p.revenueCents)}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel title="Promozioni usate">
              {data.coupons.length === 0 ? (
                <p className="text-body-sm text-fg-muted">Nessuna promozione usata.</p>
              ) : null}
              <dl className="space-y-1.5 text-body-sm">
                {data.coupons.map((c) => (
                  <div key={`${c.code}-${c.name}`} className="flex justify-between gap-3">
                    <dt className="truncate">{c.code ?? c.name}</dt>
                    <dd className="shrink-0 tabular-nums">
                      {c.redemptions} × · −{formatEuro(c.discountCents)}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        </div>
      </div>
    </AdminPage>
  );
}
