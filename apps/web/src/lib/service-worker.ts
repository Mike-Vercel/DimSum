"use client";

import { useEffect } from "react";
import { toast } from "@/components/ui/toaster";
import { registerServiceWorker } from "./push";

/**
 * Installs the service worker in production (offline page, installable app, push) and offers new
 * versions without forcing a reload in the middle of an order.
 */
export function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    const offer = (worker: ServiceWorker) =>
      toast("Nuova versione disponibile", {
        description: "Aggiorna per avere le ultime novità.",
        duration: Infinity,
        action: { label: "Aggiorna", onClick: () => worker.postMessage("SKIP_WAITING") },
      });

    const start = async () => {
      const registration = await registerServiceWorker();
      if (!registration) return;
      if (registration.waiting && navigator.serviceWorker.controller) offer(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) offer(worker);
        });
      });
      // Long-lived tabs (kitchen screens) check for updates every hour.
      const timer = setInterval(() => void registration.update().catch(() => undefined), 60 * 60_000);
      return () => clearInterval(timer);
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    let stop: (() => void) | undefined;
    const run = () => void start().then((s) => (stop = s));
    if (document.readyState === "complete") run();
    else window.addEventListener("load", run, { once: true });
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      stop?.();
    };
  }, []);
}
