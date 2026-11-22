"use client";

import type { KitchenBoardDTO, KitchenOrderDTO } from "@dimsum/types";
import type { OrderCommandRequest } from "@dimsum/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "../api";
import { haptics } from "../haptics";
import { useRealtime } from "../realtime";
import { playAlert, ringInterval, type AlertSound } from "./alert-sound";

export const kitchenKey = ["admin", "kitchen"] as const;

const SUCCESS: Partial<Record<OrderCommandRequest["command"], string>> = {
  CONFIRM: "Ordine accettato",
  REJECT: "Ordine rifiutato",
  START_PREPARING: "In preparazione",
  MARK_READY: "Segnato come pronto",
  ASSIGN_RIDER: "Rider assegnato",
  UNASSIGN_RIDER: "Rider rimosso",
  PICK_UP: "Consegnato al rider",
  DELIVER: "Ordine completato",
  CANCEL: "Ordine annullato",
  UPDATE_PREP_TIME: "Tempo aggiornato",
};

/** Live kitchen board: server snapshot, realtime refresh on every order event, polling as safety net. */
export function useKitchenBoard(initial?: KitchenBoardDTO) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: kitchenKey,
    queryFn: ({ signal }) => api.admin.kitchen(signal),
    ...(initial ? { initialData: initial, initialDataUpdatedAt: 0 } : {}),
    // Realtime events refresh it at once; polling every 4 s is the safety net (serverless realtime
    // can drop), so a new order never shows up late.
    refetchInterval: 4_000,
    refetchOnWindowFocus: true,
  });
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const status = useRealtime(
    ["kitchen"],
    (event) => {
      if (
        event.type === "notification" ||
        event.type === "catalog.availability" ||
        event.type === "catalog.changed"
      )
        return;
      // Coalesce bursts (accept → ETA → rider) into one refetch.
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(() => void qc.invalidateQueries({ queryKey: kitchenKey }), 250);
    },
    { onReconnect: () => void qc.invalidateQueries({ queryKey: kitchenKey }) },
  );
  return { ...query, realtime: status };
}

export function useOrderCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, input }: { orderId: string; input: OrderCommandRequest }) =>
      api.admin.orders.command(orderId, input),
    onSuccess: (order, { input }) => {
      haptics.success();
      const message = SUCCESS[input.command];
      if (message) toast.success(`${message} · #${order.number}`, { duration: 2200 });
      qc.setQueryData(["admin", "order", order.id], order);
    },
    onError: (error) => {
      haptics.error();
      toast.error(error instanceof ApiError ? error.message : "Operazione non riuscita. Riprova.");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: kitchenKey });
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      void qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
}

/**
 * Sound + vibration + tab title while orders wait for acceptance. Repeats until someone acts;
 * faster once an order passes the escalation threshold.
 */
/** Orders that can be accepted right now: ASAP orders, and scheduled ones once their window opens. */
export function isActionable(o: KitchenOrderDTO, now: number): boolean {
  return o.status === "RECEIVED" && (!o.acceptFrom || new Date(o.acceptFrom).getTime() <= now);
}

/**
 * Glovo-style alarm: while an order is waiting to be accepted the ringtone keeps ringing (every
 * ~2 s, faster once overdue), with vibration, a flashing screen and a blinking tab title. A new
 * order — or a scheduled one whose acceptance window opens — starts it at once.
 */
export function useNewOrderAlerts(
  orders: KitchenOrderDTO[],
  options: { enabled: boolean; sound: AlertSound; muted: boolean; now: number },
) {
  const waiting = orders.filter((o) => isActionable(o, options.now));
  const upcoming = orders.filter((o) => o.status === "RECEIVED" && !isActionable(o, options.now)).length;
  const escalated = waiting.some((o) => o.escalated);
  const ids = waiting.map((o) => o.id).join(",");
  const known = useRef<Set<string> | null>(null);
  const [flash, setFlash] = useState(false);
  const [freshAt, setFreshAt] = useState(0);
  const ringing = waiting.length > 0 && options.enabled && !options.muted;

  // A brand-new actionable order: visual flash and an immediate restart of the ringtone.
  useEffect(() => {
    const current = new Set(ids ? ids.split(",") : []);
    if (known.current) {
      const fresh = [...current].filter((id) => !known.current!.has(id));
      if (fresh.length) {
        setFreshAt(Date.now());
        setFlash(true);
        setTimeout(() => setFlash(false), 2400);
      }
    }
    known.current = current;
  }, [ids]);

  // The ringtone loop: rings now, then again and again until nothing is waiting.
  useEffect(() => {
    if (!ringing) return;
    const ring = () => {
      playAlert(options.sound, 0.9);
      if ("vibrate" in navigator) navigator.vibrate?.([250, 120, 250, 120, 400]);
    };
    ring();
    const every = ringInterval(options.sound) * 1000 * (escalated ? 0.75 : 1);
    const t = setInterval(ring, every);
    return () => clearInterval(t);
  }, [ringing, escalated, options.sound, freshAt]);

  // Tab title: visible even when the board is in a background tab.
  useEffect(() => {
    const base = "Cucina · Gestionale DIMSUM";
    if (!waiting.length) {
      document.title = base;
      return;
    }
    let on = false;
    const t = setInterval(() => {
      on = !on;
      document.title = on ? `(${waiting.length}) Nuovi ordini!` : base;
    }, 1000);
    return () => {
      clearInterval(t);
      document.title = base;
    };
  }, [waiting.length]);

  return { waiting: waiting.length, upcoming, escalated, flash };
}
