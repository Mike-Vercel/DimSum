"use client";

import type { KitchenBoardDTO, KitchenOrderDTO } from "@dimsum/types";
import type { OrderCommandRequest } from "@dimsum/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "../api";
import { haptics } from "../haptics";
import { useRealtime } from "../realtime";
import { playAlert, type AlertSound } from "./alert-sound";

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
    refetchInterval: 20_000,
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
export function useNewOrderAlerts(
  orders: KitchenOrderDTO[],
  options: { enabled: boolean; sound: AlertSound; muted: boolean },
) {
  const waiting = orders.filter((o) => o.status === "RECEIVED");
  const escalated = waiting.some((o) => o.escalated);
  const ids = waiting.map((o) => o.id).join(",");
  const known = useRef<Set<string> | null>(null);
  const [flash, setFlash] = useState(false);

  // A brand-new order: immediate alert, vibration and a visual flash.
  useEffect(() => {
    const current = new Set(ids ? ids.split(",") : []);
    if (known.current) {
      const fresh = [...current].filter((id) => !known.current!.has(id));
      if (fresh.length) {
        if (options.enabled && !options.muted) playAlert(options.sound, 0.6);
        if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
        setFlash(true);
        setTimeout(() => setFlash(false), 2400);
      }
    }
    known.current = current;
  }, [ids, options.enabled, options.muted, options.sound]);

  // Reminder loop while something is still waiting.
  useEffect(() => {
    if (!waiting.length || !options.enabled || options.muted) return;
    const every = escalated ? 5_000 : 12_000;
    const t = setInterval(() => playAlert(options.sound, escalated ? 0.75 : 0.45), every);
    return () => clearInterval(t);
  }, [waiting.length, escalated, options.enabled, options.muted, options.sound]);

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
    }, 1200);
    return () => {
      clearInterval(t);
      document.title = base;
    };
  }, [waiting.length]);

  return { waiting: waiting.length, escalated, flash };
}
