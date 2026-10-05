"use client";

import { api } from "./api";
import { publicEnv } from "./public-env";

export type PushState = "unsupported" | "denied" | "default" | "granted";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!publicEnv.vapidPublicKey
  );
}

export function pushState(): PushState {
  if (!pushSupported()) return "unsupported";
  return Notification.permission as PushState;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    // In development the worker never caches assets (hot reload must always win).
    return await navigator.serviceWorker.register(`/sw.js?mode=${process.env.NODE_ENV}`, {
      scope: "/",
      updateViaCache: "none",
    });
  } catch {
    return null;
  }
}

/**
 * Asks permission (only after a user gesture) and registers the device for Web Push.
 * Guests subscribe to a single order; accounts and staff to their topic.
 */
export async function enablePush(
  options: { orderPublicId?: string | null; topic?: "customer" | "staff" | "rider" } = {},
): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission as PushState;
  const registration = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker());
  if (!registration) return "unsupported";
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicEnv.vapidPublicKey),
    }));
  const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await api.push.subscribe({
    endpoint: json.endpoint,
    keys: json.keys,
    orderPublicId: options.orderPublicId ?? null,
    topic: options.topic ?? "customer",
  });
  return "granted";
}
