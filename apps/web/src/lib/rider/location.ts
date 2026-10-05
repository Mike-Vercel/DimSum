"use client";

import { haversineMeters } from "@dimsum/domain";
import { useEffect, useState, useSyncExternalStore } from "react";
import { api } from "../api";

const noopSubscribe = () => () => {};

export type LocationState = "off" | "starting" | "active" | "denied" | "unavailable";

interface Point {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  recordedAt: string;
}

interface BatteryLike {
  level: number;
  charging: boolean;
}

/**
 * Shares the rider position only while a delivery is in progress. Points are batched (one request
 * every 10 s, 30 s on low battery), duplicates within 15 m are skipped, and the server can tell the
 * app to stop at any time. Nothing is collected while off shift.
 */
export function useRiderLocation(options: {
  enabled: boolean;
  deliveryId: string | null;
  highAccuracy: boolean;
}): LocationState {
  const { enabled, deliveryId, highAccuracy } = options;
  const [state, setState] = useState<LocationState>("starting");
  // Assumed during server rendering, checked for real in the browser (no hydration mismatch).
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => "geolocation" in navigator,
    () => true,
  );

  useEffect(() => {
    if (!enabled || !supported) return;
    let buffer: Point[] = [];
    let last: Point | null = null;
    let lowPower = false;
    let stopped = false;

    void (navigator as Navigator & { getBattery?: () => Promise<BatteryLike> }).getBattery?.().then((b) => {
      lowPower = b.level < 0.2 && !b.charging;
    });

    const flush = async () => {
      if (!buffer.length || stopped) return;
      const points = buffer;
      buffer = [];
      try {
        const res = await api.rider.location({ deliveryId, points });
        if (!res.tracking) stop();
      } catch {
        // Offline for a moment: keep the most recent points for the next attempt.
        buffer = [...points.slice(-10), ...buffer].slice(-30);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setState("active");
        const p: Point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? Math.min(pos.coords.accuracy, 10_000) : null,
          heading:
            pos.coords.heading !== null && Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
          speed:
            pos.coords.speed !== null && Number.isFinite(pos.coords.speed)
              ? Math.min(pos.coords.speed, 100)
              : null,
          recordedAt: new Date(pos.timestamp).toISOString(),
        };
        const moved = last ? haversineMeters(last, p) : Infinity;
        const elapsed = last ? pos.timestamp - new Date(last.recordedAt).getTime() : Infinity;
        if (moved < 15 && elapsed < 25_000) return;
        last = p;
        buffer = [...buffer, p].slice(-30);
      },
      (error) => setState(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: highAccuracy, maximumAge: 5_000, timeout: 25_000 },
    );
    const interval = setInterval(() => void flush(), lowPower ? 30_000 : 10_000);

    function stop() {
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(interval);
    }

    return () => {
      void flush();
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(interval);
    };
  }, [enabled, supported, deliveryId, highAccuracy]);

  if (!enabled) return "off";
  if (!supported) return "unavailable";
  return state;
}

/** Turn-by-turn in the phone's navigator (Apple Maps on iOS, Google Maps elsewhere). */
export function navigationUrl(destination: { lat: number; lng: number }): string {
  const apple = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  return apple
    ? `https://maps.apple.com/?daddr=${destination.lat},${destination.lng}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`;
}
