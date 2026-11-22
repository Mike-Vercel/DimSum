"use client";

import { BellRing, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { audioUnlocked, unlockAudio, type AlertSound } from "@/lib/admin/alert-sound";
import { isActionable, kitchenKey, useNewOrderAlerts } from "@/lib/admin/orders";
import { cn } from "@/lib/cn";

const MUTE_KEY = "dimsum.kitchen.muted";
const noop = () => () => {};

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * New orders on every page of the back office, not only in the kitchen: the same ringtone keeps
 * ringing while an order waits to be accepted, with a banner that leads to the kitchen. The kitchen
 * page has its own (bigger) alarm, so this one stays quiet there.
 */
export function GlobalOrderAlert({ active }: { active: boolean }) {
  const { data } = useQuery({
    queryKey: kitchenKey,
    queryFn: ({ signal }) => api.admin.kitchen(signal),
    enabled: active,
    refetchInterval: 4_000,
    refetchIntervalInBackground: true,
  });
  const [now, setNow] = useState(() => Date.now());
  const [soundOn, setSoundOn] = useState(audioUnlocked);
  const muted = useSyncExternalStore(noop, readMuted, () => false);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, [active]);

  // Browsers only play sound after a gesture: the first tap anywhere in the back office unlocks it
  // (and unlocking it in the kitchen carries over, the audio context is shared).
  useEffect(() => {
    if (!active) return;
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
  }, [active]);

  const orders = active ? (data?.orders ?? []) : [];
  const alerts = useNewOrderAlerts(orders, {
    enabled: active && soundOn && (data?.settings.newOrderSoundEnabled ?? false),
    muted,
    sound: (data?.settings.newOrderSound ?? "ringtone") as AlertSound,
    now,
  });

  if (!active || alerts.waiting === 0) return null;
  const first = orders
    .filter((o) => isActionable(o, now))
    .toSorted((a, b) => (a.receivedAt ?? "").localeCompare(b.receivedAt ?? ""))[0];

  return (
    <div
      role="alert"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[calc(var(--safe-top)+10px)]"
    >
      <Link
        href="/admin/cucina"
        className={cn(
          "pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-sheet",
          // Flashing red, like the ringtone it keeps going until the order is accepted.
          "animate-alert bg-danger",
        )}
      >
        <span className="grid size-10 shrink-0 animate-pulse place-items-center rounded-full bg-white/20">
          <BellRing className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-extrabold">
            {alerts.waiting === 1 ? "Nuovo ordine" : `${alerts.waiting} nuovi ordini`}
            {first ? ` · #${first.number}` : ""}
          </span>
          <span className="block truncate text-caption font-semibold text-white/85">
            {alerts.escalated
              ? "In attesa da troppo tempo: accettalo ora"
              : soundOn || muted
                ? "Da accettare in cucina"
                : "Tocca per attivare il suono e aprire la cucina"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-white px-3 py-1.5 text-caption font-bold text-fg">
          Apri <ChevronRight className="size-3.5" />
        </span>
      </Link>
    </div>
  );
}
