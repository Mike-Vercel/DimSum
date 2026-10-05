"use client";

import type { GeoPoint } from "@dimsum/types";

export type GeoPermission = "granted" | "denied" | "prompt" | "unavailable";

export class GeolocationFailure extends Error {
  constructor(readonly kind: "denied" | "unavailable" | "timeout") {
    super(
      kind === "denied"
        ? "Permesso alla posizione negato. Puoi abilitarlo dalle impostazioni del browser oppure cercare l'indirizzo."
        : kind === "timeout"
          ? "La posizione non è arrivata in tempo. Riprova o cerca l'indirizzo."
          : "Posizione non disponibile su questo dispositivo. Cerca l'indirizzo.",
    );
  }
}

export async function geoPermission(): Promise<GeoPermission> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return "unavailable";
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    return (status?.state as GeoPermission | undefined) ?? "prompt";
  } catch {
    return "prompt";
  }
}

/** One-shot high-accuracy position (customer "Usa la mia posizione"). */
export function currentPosition(timeoutMs = 12_000): Promise<GeoPoint & { accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new GeolocationFailure("unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) =>
        reject(
          new GeolocationFailure(
            e.code === e.PERMISSION_DENIED ? "denied" : e.code === e.TIMEOUT ? "timeout" : "unavailable",
          ),
        ),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}
