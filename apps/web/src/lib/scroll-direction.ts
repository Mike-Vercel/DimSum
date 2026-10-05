"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the customer is scrolling down (reading) or up. The tab bar hides while reading and the
 * cart bar takes its place; both read this one value, so they always move together. Near the top
 * of the page nothing is hidden, and small movements (a finger resting, the iOS bounce) are ignored.
 */
export type ScrollDirection = "up" | "down";

const THRESHOLD = 8;
const TOP_ZONE = 64;

let direction: ScrollDirection = "up";
let anchorY = 0;
const listeners = new Set<() => void>();

function emit(next: ScrollDirection) {
  if (next === direction) return;
  direction = next;
  for (const listener of listeners) listener();
}

function onScroll() {
  const y = Math.max(0, window.scrollY);
  if (y <= TOP_ZONE) {
    anchorY = y;
    emit("up");
    return;
  }
  // Slow scrolls accumulate from the last turning point until they pass the threshold.
  const delta = y - anchorY;
  if (Math.abs(delta) < THRESHOLD) return;
  anchorY = y;
  emit(delta > 0 ? "down" : "up");
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    anchorY = Math.max(0, window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("scroll", onScroll);
  };
}

export function useScrollDirection(): ScrollDirection {
  return useSyncExternalStore(
    subscribe,
    () => direction,
    () => "up",
  );
}

/** A new page always starts with the tab bar visible. */
export function resetScrollDirection(): void {
  anchorY = typeof window === "undefined" ? 0 : Math.max(0, window.scrollY);
  emit("up");
}
