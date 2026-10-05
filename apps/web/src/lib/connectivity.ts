"use client";

import { useSyncExternalStore } from "react";

/**
 * Connectivity state: browser online/offline events plus failures reported by our own API
 * calls (navigator.onLine alone lies on captive portals and flaky mobile networks).
 */
let offline = typeof navigator !== "undefined" ? !navigator.onLine : false;
const listeners = new Set<() => void>();
let probe: ReturnType<typeof setTimeout> | null = null;

function emit(next: boolean) {
  if (next === offline) return;
  offline = next;
  listeners.forEach((l) => l());
}

async function check() {
  try {
    // Any HTTP answer proves the network works, even an error status.
    await fetch("/api/v1/health", { cache: "no-store" });
    emit(false);
  } catch {
    emit(true);
    probe = setTimeout(check, 5_000);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    if (probe) clearTimeout(probe);
    void check();
  });
  window.addEventListener("offline", () => emit(true));
}

export function reportNetworkFailure() {
  emit(true);
  if (probe) clearTimeout(probe);
  probe = setTimeout(check, 3_000);
}

export function useOffline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => offline,
    () => false,
  );
}
