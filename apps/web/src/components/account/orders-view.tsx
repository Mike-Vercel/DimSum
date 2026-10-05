"use client";

import type { OrderSummaryDTO, Paginated } from "@dimsum/types";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReceiptText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/segmented";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { useRealtime } from "@/lib/realtime";
import { useReorder } from "@/lib/reorder";
import { OrderCard } from "./order-card";

type Tab = "active" | "history";

/** "I miei ordini" (reference: Attivi / Cronologia with Riordina). */
export function OrdersView({
  initialActive,
  initialHistory,
}: {
  initialActive: Paginated<OrderSummaryDTO>;
  initialHistory: Paginated<OrderSummaryDTO>;
}) {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(initialActive.items.length ? "active" : "history");
  const { reorder, pendingId } = useReorder();

  const active = useQuery({
    queryKey: ["me", "orders", "active"],
    queryFn: () => api.me.orders(undefined, "active"),
    initialData: initialActive,
    initialDataUpdatedAt: 0,
    refetchInterval: 60_000,
  });
  const history = useInfiniteQuery({
    queryKey: ["me", "orders", "history"],
    queryFn: ({ pageParam }) => api.me.orders(pageParam ?? undefined, "history"),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    initialData: { pages: [initialHistory], pageParams: [null] },
    initialDataUpdatedAt: 0,
  });

  // Order updates reach the account channel as notifications: refresh both lists.
  useRealtime(session ? [`user:${session.user.id}`] : [], (event) => {
    if (event.type === "notification") void qc.invalidateQueries({ queryKey: ["me", "orders"] });
  });

  const activeOrders = active.data.items;
  const pastOrders = history.data.pages.flatMap((p) => p.items);
  const list = tab === "active" ? activeOrders : pastOrders;

  return (
    <div className="space-y-5">
      <Segmented
        ariaLabel="Ordini"
        value={tab}
        onChange={setTab}
        options={[
          { value: "active", label: `In corso${activeOrders.length ? ` (${activeOrders.length})` : ""}` },
          { value: "history", label: "Passati" },
        ]}
        className="max-w-sm"
      />
      {list.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={tab === "active" ? "Nessun ordine in corso" : "Ancora nessun ordine"}
          description={
            tab === "active"
              ? "Quando ordini, qui puoi seguire la preparazione e la consegna in tempo reale."
              : "I tuoi ordini consegnati appariranno qui, pronti da riordinare."
          }
          action={
            <Button asChild>
              <Link href="/menu">Sfoglia il menu</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {list.map((o) => (
            <li key={o.id}>
              <OrderCard order={o} onReorder={(id) => void reorder(id)} reordering={pendingId === o.id} />
            </li>
          ))}
        </ul>
      )}
      {tab === "history" && history.hasNextPage ? (
        <Button
          variant="secondary"
          block
          loading={history.isFetchingNextPage}
          onClick={() => void history.fetchNextPage()}
        >
          Mostra altri ordini
        </Button>
      ) : null}
    </div>
  );
}

/** Without an account: the orders placed from this browser, plus an invitation to sign in. */
export function GuestOrders({ orders }: { orders: OrderSummaryDTO[] }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-ink-950 p-5 text-white">
        <p className="font-bold">Accedi per vedere tutti i tuoi ordini</p>
        <p className="mt-1 text-body-sm text-white/70">
          Con un account ritrovi lo storico su ogni dispositivo e riordini in un tocco.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Button asChild variant="white" size="sm">
            <Link href="/login?next=/account/ordini">Accedi</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="text-white ring-white/30">
            <Link href="/registrati?next=/account/ordini">Crea account</Link>
          </Button>
        </div>
      </div>
      {orders.length ? (
        <section className="space-y-3">
          <h2 className="text-title font-bold">Ordinati da questo dispositivo</h2>
          <ul className="grid gap-3 xl:grid-cols-2">
            {orders.map((o) => (
              <li key={o.id}>
                <OrderCard order={o} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState
          icon={ReceiptText}
          title="Nessun ordine recente"
          description="Gli ordini fatti da questo dispositivo compaiono qui anche senza account."
        />
      )}
    </div>
  );
}
