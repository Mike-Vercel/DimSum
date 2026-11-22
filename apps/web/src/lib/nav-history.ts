"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

/**
 * In-app page history, so the app's own back arrows behave like the system back button.
 *
 * The browser does not say whether the previous history entry belongs to this site (the PWA may
 * have been opened straight on a page, or the visitor came from Google). We keep our own stack of
 * the pages visited in this tab: a path equal to the one before the current is a back navigation
 * (pop), anything else is a forward one (push). The stack lives in sessionStorage so it survives a
 * reload of the same tab.
 */
const KEY = "dimsum-nav";
let stack: string[] | null = null;

function load(): string[] {
  if (stack) return stack;
  try {
    stack = JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    stack = [];
  }
  return stack;
}

function save() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack?.slice(-50) ?? []));
  } catch {}
}

/** Mounted once (Providers): records every page change. */
export function useTrackNavigation() {
  const pathname = usePathname();
  useEffect(() => {
    const s = load();
    if (s.at(-1) === pathname) return;
    if (s.at(-2) === pathname) s.pop();
    else s.push(pathname);
    save();
  }, [pathname]);
}

/**
 * Back to the previous page of this app (a real history back, never a new entry, so the system
 * back button can't bounce between two pages). When there is no previous in-app page — the app was
 * opened on this page — it goes to `fallback` and replaces the current entry.
 */
export function useBack(fallback: string) {
  const router = useRouter();
  return useCallback(() => {
    if (load().length > 1) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
