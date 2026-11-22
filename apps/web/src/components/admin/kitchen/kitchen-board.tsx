"use client";

import type { KitchenBoardDTO, KitchenColumnKey, KitchenItemDTO, KitchenOrderDTO } from "@dimsum/types";
import { BellRing, CalendarClock, Maximize, Minimize, Volume2, VolumeX, WifiOff } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { unlockAudio, playAlert, type AlertSound } from "@/lib/admin/alert-sound";
import { isActionable, useKitchenBoard, useNewOrderAlerts, useOrderCommand } from "@/lib/admin/orders";
import { useWakeLock } from "@/lib/admin/wake-lock";
import { cn } from "@/lib/cn";
import { enablePush, pushState } from "@/lib/push";
import { PauseControl } from "../pause-control";
import { AcceptDialog, ReasonDialog, RiderPicker } from "./dialogs";
import { ItemDialog } from "./item-dialog";
import { OrderTicket, type TicketAction } from "./order-ticket";

const COLUMNS: { key: KitchenColumnKey; title: string; empty: string }[] = [
  { key: "NEW", title: "Nuovi", empty: "Nessun ordine da accettare" },
  { key: "ACCEPTED", title: "Accettati", empty: "—" },
  { key: "PREPARING", title: "In preparazione", empty: "—" },
  { key: "READY", title: "Pronti", empty: "—" },
  { key: "OUT", title: "In consegna", empty: "—" },
];

const MUTE_KEY = "dimsum.kitchen.muted";
const OPEN_KEY = "dimsum.kitchen.open";

/** Expanded/collapsed tickets chosen by hand, remembered on this device. */
function readOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

const time = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY);

/** Most urgent first in every column. */
function sortColumn(key: KitchenColumnKey, orders: KitchenOrderDTO[], now: number): KitchenOrderDTO[] {
  return orders.toSorted((a, b) => {
    if (key === "NEW") {
      // To accept now (longest waiting first), then scheduled ones by when they open.
      const aa = isActionable(a, now);
      const bb = isActionable(b, now);
      if (aa !== bb) return aa ? -1 : 1;
      return aa ? time(a.receivedAt) - time(b.receivedAt) : time(a.acceptFrom) - time(b.acceptFrom);
    }
    if (key === "READY") return time(a.readyAt) - time(b.readyAt);
    if (key === "OUT") return time(a.eta?.to) - time(b.eta?.to);
    return time(a.dueAt) - time(b.dueAt);
  });
}
const noop = () => () => {};
const WIDE = "(min-width: 1024px)";

function subscribeWide(onChange: () => void): () => void {
  const mql = window.matchMedia(WIDE);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** Per-device preference (kitchen tablet vs. the owner's phone). */
function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Ticking clock (5 s) for waiting times, countdowns and scheduled orders' acceptance windows. */
function useTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function KitchenBoard({ initial, timeZone }: { initial: KitchenBoardDTO; timeZone: string }) {
  const board = useKitchenBoard(initial);
  const data = board.data ?? initial;
  const command = useOrderCommand();
  const now = useTick();
  const [tab, setTab] = useState<KitchenColumnKey>("NEW");
  const [accepting, setAccepting] = useState<KitchenOrderDTO | null>(null);
  const [reason, setReason] = useState<{ order: KitchenOrderDTO; mode: "reject" | "cancel" } | null>(null);
  const [assigning, setAssigning] = useState<KitchenOrderDTO | null>(null);
  const [retiming, setRetiming] = useState<KitchenOrderDTO | null>(null);
  const [openItem, setOpenItem] = useState<KitchenItemDTO | null>(null);
  const [openState, setOpenState] = useState<Record<string, boolean> | null>(null);
  const stored = useSyncExternalStore(
    noop,
    () => localStorage.getItem(OPEN_KEY) ?? "{}",
    () => "{}",
  );
  const openMap = openState ?? (JSON.parse(stored) as Record<string, boolean>);
  // Default: orders to accept are open (their content matters), the others collapsed.
  const isOpen = (o: KitchenOrderDTO) => openMap[o.id] ?? isActionable(o, now);
  const setOpen = (changes: Record<string, boolean>) => {
    const ids = new Set(data.orders.map((o) => o.id));
    const next = Object.fromEntries(
      Object.entries({ ...readOpen(), ...openMap, ...changes }).filter(([id]) => ids.has(id)),
    );
    setOpenState(next);
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  };
  // The activation prompt goes away after one tap, even where the device refuses audio; automated
  // browsers (tests) never see it.
  const [promptDismissed, setPromptDismissed] = useState(false);
  const automated = useSyncExternalStore(
    noop,
    () => navigator.webdriver === true,
    () => true,
  );
  const [soundOn, setSoundOn] = useState(false);
  const storedMuted = useSyncExternalStore(noop, readMuted, () => false);
  const [mutedOverride, setMuted] = useState<boolean | null>(null);
  const muted = mutedOverride ?? storedMuted;
  const [fullscreen, setFullscreen] = useState(false);
  const push = useSyncExternalStore(noop, pushState, () => "default" as const);
  // One layout at a time, so tickets (and their timers) are never rendered twice. Unknown on the
  // server and during hydration: both layouts render and CSS shows the right one, without a flash.
  const wide = useSyncExternalStore<boolean | null>(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => null,
  );

  useWakeLock(true);
  const sound = data.settings.newOrderSound as AlertSound;
  const alerts = useNewOrderAlerts(data.orders, {
    enabled: soundOn && data.settings.newOrderSoundEnabled,
    muted,
    sound,
    now,
    title: "Cucina · Gestionale DIMSUM",
  });

  // Sound: unlocked by the first tap anywhere (browsers require a gesture), resumed when the tablet
  // wakes up. Until it is unlocked a full-screen prompt asks for that one tap.
  useEffect(() => {
    const tryUnlock = async () => setSoundOn(await unlockAudio());
    const onGesture = () => void tryUnlock();
    const onVisible = () => document.visibilityState === "visible" && void tryUnlock();
    for (const t of ["pointerdown", "keydown", "touchend"])
      window.addEventListener(t, onGesture, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      for (const t of ["pointerdown", "keydown", "touchend"]) window.removeEventListener(t, onGesture);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Push: a device already allowed (e.g. the owner's phone, allowed earlier as a customer) is
  // re-registered for the staff alerts without asking again.
  useEffect(() => {
    if (pushState() === "granted") void enablePush({ topic: "staff" }).catch(() => undefined);
  }, []);

  const activate = async () => {
    setPromptDismissed(true);
    const ok = await unlockAudio();
    setSoundOn(ok);
    if (ok) playAlert(sound, 0.6);
    else toast.error("Il browser non permette l'audio su questo dispositivo.");
    if (pushState() !== "denied" && pushState() !== "unsupported")
      void enablePush({ topic: "staff" }).catch(() => undefined);
  };

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const byColumn = (key: KitchenColumnKey) =>
    sortColumn(
      key,
      data.orders.filter((o) => o.column === key),
      now,
    );
  const run = (order: KitchenOrderDTO, a: TicketAction) => {
    switch (a.type) {
      case "accept":
        setAccepting(order);
        break;
      case "reject":
      case "cancel":
        setReason({ order, mode: a.type });
        break;
      case "assign":
        setAssigning(order);
        break;
      case "retime":
        setRetiming(order);
        break;
      case "delay":
        command.mutate({
          orderId: order.id,
          input: {
            command: "UPDATE_PREP_TIME",
            prepMinutes: (order.prepMinutes ?? data.settings.defaultPrepMinutes) + a.minutes,
          },
        });
        break;
      case "command":
        command.mutate({ orderId: order.id, input: { command: a.command } });
        break;
    }
  };
  const busyId = command.isPending ? command.variables?.orderId : null;

  const column = (key: KitchenColumnKey, title: string, empty: string, className?: string) => {
    const orders = byColumn(key);
    return (
      <section key={key} aria-label={title} className={cn("flex min-w-0 flex-col gap-3", className)}>
        <h2
          className={cn(
            "items-center justify-between px-1 text-body-sm font-bold tracking-wide text-fg-muted uppercase",
            wide === null ? "hidden lg:flex" : wide ? "flex" : "hidden",
          )}
        >
          {title}
          <span
            className={cn(
              "grid h-6 min-w-6 place-items-center rounded-full px-2 text-caption",
              key === "NEW" && orders.length ? "bg-warning text-white" : "bg-surface-3 text-fg",
            )}
          >
            {orders.length}
          </span>
        </h2>
        {orders.length > 1 ? (
          <div className="flex justify-end px-1">
            <button
              type="button"
              onClick={() => {
                const anyClosed = orders.some((o) => !isOpen(o));
                setOpen(Object.fromEntries(orders.map((o) => [o.id, anyClosed])));
              }}
              className="text-caption font-semibold text-fg-muted underline-offset-4 hover:text-fg hover:underline"
            >
              {orders.some((o) => !isOpen(o)) ? "Apri tutti" : "Chiudi tutti"}
            </button>
          </div>
        ) : null}
        {orders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-body-sm text-fg-subtle">
            {empty}
          </p>
        ) : null}
        {orders.map((o) => (
          <OrderTicket
            key={o.id}
            order={o}
            now={now}
            timeZone={timeZone}
            busy={busyId === o.id}
            onAction={(a) => run(o, a)}
            onOpenItem={setOpenItem}
            open={isOpen(o)}
            onToggle={() => setOpen({ [o.id]: !isOpen(o) })}
          />
        ))}
      </section>
    );
  };

  return (
    <div className={cn("flex min-h-dvh flex-col", alerts.flash && "animate-alert-flash")}>
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur-md lg:px-6">
        <h1 className="text-title-lg mr-auto font-extrabold">Cucina</h1>
        {board.realtime === "reconnecting" ? (
          <span className="flex items-center gap-1.5 text-caption font-semibold text-warning">
            <WifiOff className="size-4" /> Riconnessione…
          </span>
        ) : null}
        <PauseControl status={data.status} />
        {!soundOn ? (
          <Button size="sm" onClick={() => void activate()}>
            <Volume2 className="size-4" /> Attiva suoneria
          </Button>
        ) : (
          <Button
            size="icon"
            variant="secondary"
            aria-label={muted ? "Riattiva i suoni" : "Silenzia"}
            aria-pressed={muted}
            onClick={() => {
              const next = !muted;
              try {
                localStorage.setItem(MUTE_KEY, next ? "1" : "0");
              } catch {
                /* private mode */
              }
              setMuted(next);
            }}
          >
            {muted ? <VolumeX className="size-4.5" /> : <Volume2 className="size-4.5" />}
          </Button>
        )}
        {push === "default" ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              void enablePush({ topic: "staff" }).then(
                (s) => s === "granted" && toast.success("Notifiche attive su questo dispositivo"),
              )
            }
          >
            <BellRing className="size-4" /> Notifiche
          </Button>
        ) : null}
        <Button
          size="icon"
          variant="secondary"
          aria-label={fullscreen ? "Esci da schermo intero" : "Schermo intero"}
          onClick={() =>
            document.fullscreenElement
              ? void document.exitFullscreen()
              : void document.documentElement.requestFullscreen?.()
          }
        >
          {fullscreen ? <Minimize className="size-4.5" /> : <Maximize className="size-4.5" />}
        </Button>
      </div>

      {alerts.upcoming > 0 ? (
        <div className="flex items-center justify-center gap-2 bg-info-soft px-4 py-2 text-body-sm font-semibold text-info">
          <CalendarClock className="size-4.5" />
          {alerts.upcoming === 1 ? "1 ordine programmato" : `${alerts.upcoming} ordini programmati`} · si
          accettano 30 minuti prima, la suoneria parte da sola
        </div>
      ) : null}

      {alerts.waiting > 0 ? (
        <div
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-2.5 text-body-sm font-bold text-white",
            alerts.escalated ? "bg-danger" : "bg-warning",
          )}
          role="alert"
        >
          <BellRing className="size-4.5" />
          {alerts.waiting === 1 ? "1 ordine da accettare" : `${alerts.waiting} ordini da accettare`}
          {alerts.escalated ? " · in attesa da troppo tempo" : ""}
        </div>
      ) : null}

      {wide !== false ? (
        /* Desktop and kitchen screens: the whole flow at a glance. */
        <div
          className={cn(
            "flex-1 grid-cols-[repeat(5,minmax(250px,1fr))] gap-4 overflow-x-auto p-6 xl:gap-5",
            wide ? "grid" : "hidden lg:grid",
          )}
        >
          {COLUMNS.map((c) => column(c.key, c.title, c.empty))}
        </div>
      ) : null}
      {wide !== true ? (
        /* Tablets and phones: one column at a time. */
        <div className={cn("flex flex-1 flex-col", wide === null && "lg:hidden")}>
          {/* Full column names in a scrollable row: five equal pills do not fit a phone. */}
          <div
            role="radiogroup"
            aria-label="Colonne"
            className="scrollbar-none flex gap-2 overflow-x-auto px-4 pt-4"
          >
            {COLUMNS.map((c) => {
              const count = byColumn(c.key).length;
              const active = c.key === tab;
              return (
                <button
                  key={c.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTab(c.key)}
                  className={cn(
                    "flex h-9 shrink-0 tap items-center gap-1.5 rounded-full px-3.5 text-caption font-semibold ring-1 transition-colors ring-inset",
                    active
                      ? "bg-ink-900 text-white ring-ink-900 dark:bg-white dark:text-ink-900 dark:ring-white"
                      : "bg-surface text-fg-muted ring-line hover:text-fg",
                  )}
                >
                  {c.title}
                  {count ? (
                    <span
                      className={cn(
                        "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-micro tabular-nums",
                        c.key === "NEW"
                          ? "bg-warning text-white"
                          : active
                            ? "bg-white/20 dark:bg-ink-900/15"
                            : "bg-surface-3 text-fg",
                      )}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="flex-1 p-4">
            {COLUMNS.filter((c) => c.key === tab).map((c) => column(c.key, c.title, c.empty))}
          </div>
        </div>
      ) : null}

      {!soundOn && !promptDismissed && !automated && data.settings.newOrderSoundEnabled ? (
        <button
          type="button"
          onClick={() => void activate()}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-ink-950/92 px-6 text-center text-white backdrop-blur-sm"
        >
          <span className="grid size-24 animate-pulse place-items-center rounded-full bg-brand shadow-cta">
            <BellRing className="size-11" />
          </span>
          <span className="text-headline font-extrabold">Tocca per attivare la suoneria</span>
          <span className="max-w-md text-body text-white/70">
            Il browser blocca i suoni finché non tocchi lo schermo. Un tocco attiva la suoneria dei nuovi
            ordini e le notifiche su questo dispositivo.
          </span>
        </button>
      ) : null}

      <ItemDialog item={openItem} onClose={() => setOpenItem(null)} />
      <AcceptDialog
        key={`accept-${accepting?.id ?? "none"}`}
        order={accepting}
        options={data.settings.prepTimeOptions}
        defaultMinutes={data.settings.defaultPrepMinutes}
        timeZone={timeZone}
        busy={command.isPending}
        onClose={() => setAccepting(null)}
        onConfirm={(prepMinutes) =>
          accepting &&
          command.mutate(
            { orderId: accepting.id, input: { command: "CONFIRM", prepMinutes } },
            { onSuccess: () => setAccepting(null) },
          )
        }
      />
      <AcceptDialog
        key={`retime-${retiming?.id ?? "none"}`}
        mode="retime"
        order={retiming}
        options={data.settings.prepTimeOptions}
        defaultMinutes={data.settings.defaultPrepMinutes}
        timeZone={timeZone}
        busy={command.isPending}
        onClose={() => setRetiming(null)}
        onConfirm={(fromNow) => {
          if (!retiming) return;
          // The stored time counts from acceptance: elapsed minutes plus the new "ready in".
          const elapsed = retiming.confirmedAt
            ? Math.max(0, Math.floor((Date.now() - new Date(retiming.confirmedAt).getTime()) / 60_000))
            : 0;
          command.mutate(
            {
              orderId: retiming.id,
              input: {
                command: "UPDATE_PREP_TIME",
                prepMinutes: Math.min(240, Math.max(1, elapsed + fromNow)),
              },
            },
            { onSuccess: () => setRetiming(null) },
          );
        }}
      />
      <ReasonDialog
        key={`reason-${reason ? `${reason.order.id}-${reason.mode}` : "none"}`}
        order={reason?.order ?? null}
        mode={reason?.mode ?? "reject"}
        busy={command.isPending}
        onClose={() => setReason(null)}
        onConfirm={(text) =>
          reason &&
          command.mutate(
            {
              orderId: reason.order.id,
              input:
                reason.mode === "reject"
                  ? { command: "REJECT", reason: text }
                  : { command: "CANCEL", reason: text },
            },
            { onSuccess: () => setReason(null) },
          )
        }
      />
      <RiderPicker
        order={assigning}
        riders={data.riders}
        busy={command.isPending}
        onClose={() => setAssigning(null)}
        onAssign={(riderId) =>
          assigning &&
          command.mutate(
            { orderId: assigning.id, input: { command: "ASSIGN_RIDER", riderId } },
            { onSuccess: () => setAssigning(null) },
          )
        }
      />
    </div>
  );
}
