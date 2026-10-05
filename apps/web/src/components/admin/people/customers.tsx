"use client";

import { formatEuro } from "@dimsum/domain";
import type { AdminCustomerDetailDTO, AdminCustomerListItemDTO, Paginated } from "@dimsum/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, Search } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatLongDate, formatOrderDate } from "@/lib/dates";
import { AdminPage, CollectionBadge, KeyValue, OrderStatusBadge, Panel, StatTile } from "../ui";

const CONSENT_LABEL: Record<string, string> = {
  TERMS: "Termini",
  PRIVACY: "Informativa privacy",
  MARKETING_EMAIL: "Offerte via e-mail",
  MARKETING_PUSH: "Offerte via notifica",
  PERSONALIZATION: "Personalizzazione",
  ANALYTICS: "Statistiche",
};

export function CustomersList({
  initial,
  timeZone,
}: {
  initial: Paginated<AdminCustomerListItemDTO>;
  timeZone: string;
}) {
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim());
  const list = useInfiniteQuery({
    queryKey: ["admin", "customers", query],
    queryFn: ({ pageParam }) => api.admin.customers.list(query || undefined, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    ...(query ? {} : { initialData: { pages: [initial], pageParams: [null] }, initialDataUpdatedAt: 0 }),
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <AdminPage
      title="Clienti"
      description="Clienti con account. Gli ordini come ospite restano consultabili da “Ordini”."
    >
      <div className="relative mb-4 w-full sm:w-96">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-fg-subtle"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nome, e-mail o telefono"
          className="pl-10"
          aria-label="Cerca clienti"
        />
      </div>
      <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <ul className="divide-y divide-line">
          {rows.length === 0 && !list.isFetching ? (
            <li className="px-5 py-12 text-center text-body-sm text-fg-muted">Nessun cliente trovato.</li>
          ) : null}
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/clienti/${c.id}`}
                className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5 transition-colors hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{c.name}</span>
                  <span className="block truncate text-body-sm text-fg-muted">{c.email}</span>
                </span>
                <span className="text-body-sm text-fg-muted">
                  Cliente dal {formatLongDate(c.createdAt, timeZone)}
                </span>
                <span className="w-24 text-right text-body-sm tabular-nums">{c.ordersCount} ordini</span>
                <span className="w-24 text-right font-semibold tabular-nums">
                  {formatEuro(c.totalSpentCents)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {list.hasNextPage ? (
        <Button
          variant="secondary"
          block
          className="mt-4"
          loading={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
        >
          Carica altri
        </Button>
      ) : null}
    </AdminPage>
  );
}

export function CustomerDetail({
  customer,
  timeZone,
}: {
  customer: AdminCustomerDetailDTO;
  timeZone: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-5 pb-16 lg:px-8 lg:pt-8">
      <Link
        href="/admin/clienti"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-semibold text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> Clienti
      </Link>
      <header className="mb-6">
        <h1 className="text-display font-extrabold">{customer.name}</h1>
        <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-body-sm text-fg-muted">
          <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1.5 hover:text-fg">
            <Mail className="size-4" /> {customer.email}
          </a>
          {customer.phone ? (
            <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1.5 hover:text-fg">
              <Phone className="size-4" /> {customer.phone}
            </a>
          ) : null}
          {customer.emailVerified ? (
            <Badge tone="success">E-mail verificata</Badge>
          ) : (
            <Badge tone="warning">E-mail da verificare</Badge>
          )}
        </p>
      </header>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Ordini consegnati" value={customer.ordersCount} />
        <StatTile label="Speso in totale" value={formatEuro(customer.totalSpentCents)} />
        <StatTile
          label="Ultimo ordine"
          value={customer.lastOrderAt ? formatLongDate(customer.lastOrderAt, timeZone) : "—"}
        />
        <StatTile label="Punti Club" value={customer.loyaltyPoints} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Panel title="Ordini" padded={false}>
          <ul className="divide-y divide-line">
            {customer.orders.length === 0 ? (
              <li className="px-5 py-8 text-center text-body-sm text-fg-muted">Nessun ordine.</li>
            ) : null}
            {customer.orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/admin/ordini/${o.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-2"
                >
                  <span className="w-20 font-bold tabular-nums">#{o.number}</span>
                  <span className="flex-1 text-body-sm text-fg-muted">
                    {formatOrderDate(o.placedAt, timeZone)}
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
        <div className="space-y-6">
          <Panel title="Indirizzi salvati">
            {customer.addresses.length ? (
              <ul className="space-y-1.5 text-body-sm">
                {customer.addresses.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-fg-muted">Nessuno.</p>
            )}
          </Panel>
          <Panel title="Consensi" description="Storico completo, il più recente in alto.">
            <KeyValue
              rows={customer.consents
                .slice(0, 12)
                .map((c) => [
                  `${CONSENT_LABEL[c.type] ?? c.type} · ${formatOrderDate(c.createdAt, timeZone)}`,
                  c.granted ? "Sì" : "No",
                ])}
            />
            {customer.consents.length === 0 ? (
              <p className="text-body-sm text-fg-muted">Nessun consenso registrato.</p>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}
