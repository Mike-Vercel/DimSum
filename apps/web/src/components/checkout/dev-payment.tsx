"use client";

import { formatEuro } from "@dimsum/domain";
import { FlaskConical, Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/feedback";
import { api, ApiError } from "@/lib/api";
import { haptics } from "@/lib/haptics";

/**
 * Test payment screen (no Stripe keys configured). Clearly labelled; the server confirms the
 * payment through the same code path as a verified Stripe webhook.
 */
export function DevPayment({
  publicId,
  amountCents,
  onSuccess,
}: {
  publicId: string;
  amountCents: number;
  onSuccess: () => void;
}) {
  const [busy, setBusy] = useState<"succeed" | "fail" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (outcome: "succeed" | "fail") => {
    setBusy(outcome);
    setError(null);
    try {
      await api.checkout.simulatePayment(publicId, outcome);
      if (outcome === "succeed") {
        haptics.success();
        onSuccess();
        return;
      }
      haptics.error();
      setError("Pagamento rifiutato dalla banca (simulazione). Riprova o scegli un altro metodo.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore di rete.");
    }
    setBusy(null);
  };

  return (
    <div className="space-y-5">
      <InlineAlert tone="warning" title="Modalità di prova">
        I pagamenti online non sono ancora collegati a Stripe in questo ambiente: nessun addebito reale.
      </InlineAlert>
      <div className="relative overflow-hidden rounded-2xl bg-ink-900 p-5 text-white shadow-lg" aria-hidden>
        <div className="flex items-center justify-between text-caption text-white/60">
          <span>CARTA DI PROVA</span>
          <FlaskConical className="size-4" />
        </div>
        <p className="mt-8 font-mono text-title-sm tracking-[0.2em]">4242 4242 4242 4242</p>
        <div className="mt-4 flex justify-between text-caption text-white/70">
          <span>MARIO ROSSI</span>
          <span>12/34</span>
        </div>
        <span className="absolute -top-10 -right-10 size-32 rounded-full bg-red-500/30 blur-2xl" />
      </div>
      {error ? <InlineAlert tone="danger" title={error} /> : null}
      <Button
        size="xl"
        block
        className="h-14"
        loading={busy === "succeed"}
        disabled={busy !== null}
        onClick={() => void run("succeed")}
      >
        <Lock className="size-4" /> Paga {formatEuro(amountCents)}
      </Button>
      <Button
        variant="ghost"
        block
        disabled={busy !== null}
        loading={busy === "fail"}
        onClick={() => void run("fail")}
      >
        Simula un pagamento rifiutato
      </Button>
    </div>
  );
}
