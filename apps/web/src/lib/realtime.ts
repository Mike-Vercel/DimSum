"use client";

import type { RealtimeEvent } from "@dimsum/types";
import { useEffect, useRef, useSyncExternalStore } from "react";

export type RealtimeStatus = "connecting" | "open" | "reconnecting";

interface Connection {
  source: EventSource;
  status: RealtimeStatus;
  wasOpen: boolean;
  handlers: Set<(e: RealtimeEvent) => void>;
  reconnectHandlers: Set<() => void>;
  statusListeners: Set<() => void>;
  refs: number;
}

const connections = new Map<string, Connection>();

function open(key: string): Connection {
  const existing = connections.get(key);
  if (existing) return existing;
  const source = new EventSource(`/api/v1/realtime?channels=${encodeURIComponent(key)}`, {
    withCredentials: true,
  });
  const conn: Connection = {
    source,
    status: "connecting",
    wasOpen: false,
    handlers: new Set(),
    reconnectHandlers: new Set(),
    statusListeners: new Set(),
    refs: 0,
  };
  const setStatus = (s: RealtimeStatus) => {
    conn.status = s;
    conn.statusListeners.forEach((l) => l());
  };
  source.onopen = () => {
    // Events may have been missed while disconnected: let consumers refetch.
    if (conn.wasOpen) conn.reconnectHandlers.forEach((h) => h());
    conn.wasOpen = true;
    setStatus("open");
  };
  source.onerror = () => setStatus(conn.wasOpen ? "reconnecting" : "connecting");
  source.onmessage = (msg) => {
    try {
      const event = JSON.parse(msg.data as string) as RealtimeEvent;
      conn.handlers.forEach((h) => h(event));
    } catch {
      /* ignore malformed frames */
    }
  };
  connections.set(key, conn);
  return conn;
}

function release(key: string) {
  const conn = connections.get(key);
  if (!conn) return;
  conn.refs--;
  if (conn.refs <= 0) {
    conn.source.close();
    connections.delete(key);
  }
}

/**
 * Subscribes to realtime channels. One EventSource per channel set is shared by every component
 * that asks for it; `onReconnect` fires after a dropped connection comes back.
 */
export function useRealtime(
  channels: string[] | null,
  onEvent: (event: RealtimeEvent) => void,
  options: { onReconnect?: () => void } = {},
): RealtimeStatus | "idle" {
  const key = channels && channels.length ? [...new Set(channels)].sort().join(",") : null;
  const handlerRef = useRef(onEvent);
  const reconnectRef = useRef(options.onReconnect);
  useEffect(() => {
    handlerRef.current = onEvent;
    reconnectRef.current = options.onReconnect;
  });

  useEffect(() => {
    if (!key || typeof EventSource === "undefined") return;
    const conn = open(key);
    conn.refs++;
    const h = (e: RealtimeEvent) => handlerRef.current(e);
    const r = () => reconnectRef.current?.();
    conn.handlers.add(h);
    conn.reconnectHandlers.add(r);
    return () => {
      conn.handlers.delete(h);
      conn.reconnectHandlers.delete(r);
      release(key);
    };
  }, [key]);

  return useSyncExternalStore(
    (cb) => {
      if (!key) return () => {};
      const conn = connections.get(key);
      conn?.statusListeners.add(cb);
      return () => conn?.statusListeners.delete(cb);
    },
    () => (key ? (connections.get(key)?.status ?? "connecting") : "idle"),
    () => "idle",
  );
}
