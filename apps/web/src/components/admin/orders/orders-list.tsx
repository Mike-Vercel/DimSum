"use client";

import { formatEuro } from "@dimsum/domain";
import type { AdminOrderListItemDTO, Paginated } from "@dimsum/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatOrderDate } from "@/lib/dates";
import { useRealtime } from "@/lib/realtime";
import { CollectionBadge, FulfillmentBadge, OrderStatusBadge } from "../ui";

const FILTERS = [
  { key: "", label: "Tutti" },
  { key: "active", label: "In corso" },
  { key: "done", label: "Completati" },
  { key: "cancelled", label: "Annullati" },
] as const;

export function OrdersList({
  initial,
  timeZone,
}: {
  initial: Paginated<AdminOrderListItemDTO>;
  timeZone: string;
}) {
  const [status, setStatus] = useState<string>("");
  const [type, setType] = useState<"" | "DELIVERY" | "PICKUP">("");
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim());
  const pristine = !status && !type && !query;

  const orders = useInfiniteQuery({
    queryKey: ["admin", "orders", status, type, query],
    queryFn: ({ pageParam }) =>
      api.admin.orders.list({
        status: status || undefined,
        fulfillmentType: type || undefined,
        q: query || undefined,
        cursor: pageParam ?? undefined,
        limit: 50,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    ...(pristine ? { initialData: { pages: [initial], pageParams: [null] }, initialDataUpdatedAt: 0 } : {}),
  });
  useRealtime(["kitchen"], (e) => {
    if (e.type === "order.created" || e.type === "order.updated") void orders.refetch();
  });

  const rows = orders.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-fg-subtle"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Numero, nome, e-mail o telefono"
            className="pl-10"
            aria-label="Cerca ordini"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Chip key={f.key} selected={status === f.key} onClick={() => setStatus(f.key)}>
              {f.label}
            </Chip>
          ))}
          <Chip selected={type === "DELIVERY"} onClick={() => setType(type === "DELIVERY" ? "" : "DELIVERY")}>
            Consegne
          </Chip>
          <Chip selected={type === "PICKUP"} onClick={() => setType(type === "PICKUP" ? "" : "PICKUP")}>
            Ritiri
          </Chip>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <table className="w-full text-left text-body-sm">
          <thead className="hidden border-b border-line text-caption font-semibold text-fg-muted md:table-header-group">
            <tr>
              <th className="px-5 py-3">Ordine</th>
              <th className="px-3 py-3">Cliente</th>
              <th className="px-3 py-3">Tipo</th>
              <th className="px-3 py-3">Stato</th>
              <th className="px-3 py-3">Pagamento</th>
              <th className="px-5 py-3 text-right">Totale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((o) => (
              <tr
                key={o.id}
                className="group relative grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-5 py-3.5 transition-colors hover:bg-surface-2 md:table-row md:p-0"
              >
                <td className="md:px-5 md:py-3.5">
                  <Link
                    href={`/admin/ordini/${o.id}`}
                    className="font-bold tabular-nums after:absolute after:inset-0 after:content-['']"
                  >
                    #{o.number}
                  </Link>
                  <span className="block text-caption text-fg-muted">
                    {formatOrderDate(o.placedAt, timeZone)}
                  </span>
                </td>
                <td className="col-span-2 row-start-2 md:px-3 md:py-3.5">
                  <span className="font-medium">{o.customerName}</span>
                  {o.riderName ? (
                    <span className="block text-caption text-fg-muted">Rider: {o.riderName}</span>
                  ) : null}
                </td>
                <td className="hidden md:table-cell md:px-3 md:py-3.5">
                  <FulfillmentBadge type={o.fulfillmentType} />
                </td>
                <td className="row-start-3 md:px-3 md:py-3.5">
                  <OrderStatusBadge status={o.status} fulfillmentType={o.fulfillmentType} />
                </td>
                <td className="hidden md:table-cell md:px-3 md:py-3.5">
                  <CollectionBadge collection={o.collection} totalCents={o.totalCents} />
                </td>
                <td className="col-start-2 row-start-1 text-right font-semibold tabular-nums md:px-5 md:py-3.5">
                  {formatEuro(o.totalCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !orders.isFetching ? (
          <p className="px-5 py-12 text-center text-body-sm text-fg-muted">Nessun ordine trovato.</p>
        ) : null}
      </div>
      {orders.hasNextPage ? (
        <Button
          variant="secondary"
          block
          loading={orders.isFetchingNextPage}
          onClick={() => void orders.fetchNextPage()}
        >
          Carica altri ordini
        </Button>
      ) : null}
    </div>
  );
}
