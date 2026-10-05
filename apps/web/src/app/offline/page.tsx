import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { RetryButton } from "@/components/shop/retry-button";

export const metadata: Metadata = { title: "Sei offline", robots: { index: false, follow: false } };

/** Fallback served by the service worker when there is no connection. Contains no prices. */
export default function OfflinePage() {
  return (
    <main
      id="contenuto"
      className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center"
    >
      <Logo className="h-7 text-fg" />
      <span className="mt-10 grid size-20 place-items-center rounded-full bg-surface ring-1 ring-line">
        <WifiOff className="size-9 text-fg-muted" />
      </span>
      <h1 className="mt-6 text-headline font-extrabold">Sei offline</h1>
      <p className="mt-2 max-w-sm text-body text-fg-muted">
        Controlla la connessione: il carrello resta salvato su questo dispositivo e riprendi da dove eri.
      </p>
      <RetryButton />
    </main>
  );
}
