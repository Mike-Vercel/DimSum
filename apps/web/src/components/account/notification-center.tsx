"use client";

import type { NotificationDTO, Paginated } from "@dimsum/types";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Bell, BellOff, BellRing } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRestaurant } from "@/components/shop/restaurant-context";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatOrderDate } from "@/lib/dates";
import { enablePush, pushState, type PushState } from "@/lib/push";
import { useRealtime } from "@/lib/realtime";

type Page = Paginated<NotificationDTO> & { unread: number };
const key = ["me", "notifications"] as const;

const noopSubscribe = () => () => {};

function DevicePush() {
  // Read the browser permission after hydration only (it does not exist on the server).
  const initial = useSyncExternalStore<PushState>(noopSubscribe, pushState, () => "default");
  const [state, setState] = useState<PushState | null>(null);
  const current = state ?? initial;
  const copy: Record<PushState, { title: string; body: string }> = {
    granted: {
      title: "Notifiche attive su questo dispositivo",
      body: "Ti avvisiamo a ogni passaggio dei tuoi ordini, anche a schermo spento.",
    },
    default: {
      title: "Avvisi sugli ordini",
      body: "Ricevi una notifica quando l'ordine è confermato, in consegna e quando il rider sta arrivando.",
    },
    denied: {
      title: "Notifiche bloccate",
      body: "Le hai bloccate nelle impostazioni del browser: riattivale da lì per ricevere gli avvisi.",
    },
    unsupported: {
      title: "Notifiche non disponibili",
      body: "Questo browser non supporta le notifiche. Su iPhone aggiungi DIMSUM alla schermata Home.",
    },
  };
  const Icon = current === "granted" ? BellRing : current === "default" ? Bell : BellOff;
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-surface p-5 ring-1 ring-line sm:flex-row sm:items-center">
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full",
          current === "granted" ? "bg-success-soft text-success" : "bg-surface-2",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{copy[current].title}</p>
        <p className="text-body-sm text-fg-muted">{copy[current].body}</p>
      </div>
      {current === "default" ? (
        <Button size="sm" onClick={async () => setState(await enablePush({ topic: "customer" }))}>
          Attiva
        </Button>
      ) : null}
    </div>
  );
}

export function NotificationCenter({ initial, userId }: { initial: Page; userId: string }) {
  const qc = useQueryClient();
  const { timezone } = useRestaurant();
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => api.me.notifications(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    initialData: { pages: [initial], pageParams: [null] },
    initialDataUpdatedAt: 0,
  });

  useRealtime([`user:${userId}`], (event) => {
    if (event.type !== "notification") return;
    qc.setQueryData<InfiniteData<Page, string | null>>(key, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((p, i) =>
              i === 0 ? { ...p, items: [event.notification, ...p.items], unread: p.unread + 1 } : p,
            ),
          }
        : data,
    );
  });

  const items = query.data.pages.flatMap((p) => p.items);
  const unread = query.data.pages[0]?.unread ?? 0;

  // Opening the inbox marks what is on screen as read (the dots stay visible for this visit).
  useEffect(() => {
    if (unread === 0) return;
    const t = setTimeout(() => void api.me.markNotificationsRead().catch(() => undefined), 1500);
    return () => clearTimeout(t);
  }, [unread]);

  return (
    <div className="space-y-6">
      <DevicePush />
      <section className="space-y-3">
        <h2 className="text-title font-bold">Aggiornamenti</h2>
        {items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Nessuna notifica"
            description="Qui trovi gli aggiornamenti sui tuoi ordini."
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
            {items.map((n) => {
              const body = (
                <>
                  <span
                    className={cn(
                      "mt-2 size-2 shrink-0 rounded-full",
                      n.readAt ? "bg-transparent" : "bg-brand",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{n.title}</span>
                    <span className="block text-body-sm text-fg-muted">{n.body}</span>
                    <span className="mt-1 block text-caption text-fg-subtle">
                      {formatOrderDate(n.createdAt, timezone)}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={n.id}>
                  {n.url ? (
                    <Link href={n.url} className="flex gap-3 p-4 transition-colors hover:bg-surface-2">
                      {!n.readAt ? <span className="sr-only">Non letta: </span> : null}
                      {body}
                    </Link>
                  ) : (
                    <div className="flex gap-3 p-4">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {query.hasNextPage ? (
          <Button
            variant="secondary"
            block
            loading={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            Mostra altre
          </Button>
        ) : null}
      </section>
      <p className="text-body-sm text-fg-muted">
        Le comunicazioni promozionali si gestiscono da{" "}
        <Link href="/account/privacy" className="font-semibold text-fg underline underline-offset-4">
          Privacy e dati
        </Link>
        .
      </p>
    </div>
  );
}
