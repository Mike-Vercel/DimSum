"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";

const COLORS = ["#d82a1e", "#ee5446", "#e8a317", "#1e9e5a", "#ffffff", "#f6aea6"];

function Confetti() {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        id: i,
        x: (i * 37) % 100,
        delay: (i % 7) * 0.05,
        rotate: (i * 47) % 360,
        color: COLORS[i % COLORS.length],
        size: 5 + (i % 3) * 2,
        drift: ((i % 5) - 2) * 18,
      })),
    [],
  );
  if (reduce) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-2/3 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 block rounded-[1px]"
          style={{ left: `${p.x}%`, width: p.size, height: p.size * 1.6, backgroundColor: p.color }}
          initial={{ y: -20, opacity: 0, rotate: p.rotate }}
          animate={{
            y: [-20, 260 + (p.id % 6) * 40],
            x: [0, p.drift],
            opacity: [0, 1, 1, 0],
            rotate: p.rotate + 260,
          }}
          transition={{ duration: 2.2, delay: 0.35 + p.delay, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </div>
  );
}

/** "Ordine confermato!" moment after payment (reference screen 8). */
export function SuccessOverlay({
  open,
  number,
  emailMasked,
  etaLabel,
  pendingPayment,
  isGuest,
  signupHref,
  onTrack,
}: {
  open: boolean;
  number: string;
  emailMasked: string;
  etaLabel: string | null;
  pendingPayment: boolean;
  isGuest: boolean;
  signupHref: string;
  onTrack: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          data-theme="dark"
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-title"
          className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-ink-950 px-6 pt-[calc(var(--safe-top)+24px)] pb-[calc(var(--safe-bottom)+24px)] text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
        >
          <Confetti />
          <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
            <motion.div
              className="grid size-24 place-items-center rounded-full bg-jade-500 shadow-[0_0_0_10px_rgba(30,158,90,0.18)]"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.1 }}
            >
              <svg viewBox="0 0 52 52" className="size-12" aria-hidden>
                <motion.path
                  d="M14 27l8 8 16-17"
                  fill="none"
                  stroke="white"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.45, delay: 0.38, ease: [0.65, 0, 0.35, 1] }}
                />
              </svg>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <h1 id="success-title" className="mt-8 text-display font-extrabold">
                {pendingPayment ? "Ci siamo quasi!" : "Ordine confermato!"}
              </h1>
              <p className="mt-2 text-body text-fg-muted">
                {pendingPayment
                  ? "Stiamo verificando il pagamento: ci vorrà un istante."
                  : "Grazie per aver scelto DIMSUM."}
              </p>
            </motion.div>
            <motion.dl
              className="mt-8 w-full divide-y divide-line rounded-2xl bg-surface text-left ring-1 ring-line"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.4 }}
            >
              <div className="flex items-center justify-between px-5 py-4">
                <dt className="text-body-sm text-fg-muted">N° ordine</dt>
                <dd className="text-title font-extrabold tabular-nums">#{number}</dd>
              </div>
              {etaLabel ? (
                <div className="flex items-center justify-between px-5 py-4">
                  <dt className="text-body-sm text-fg-muted">Tempo stimato</dt>
                  <dd className="font-semibold">{etaLabel}</dd>
                </div>
              ) : null}
            </motion.dl>
            <motion.p
              className="mt-5 text-body-sm text-fg-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              Abbiamo inviato la conferma a <strong className="text-fg">{emailMasked}</strong>
            </motion.p>
          </div>
          <motion.div
            className="relative mx-auto mt-8 w-full max-w-md space-y-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Button size="xl" block className="h-14" onClick={onTrack}>
              Segui il tuo ordine
            </Button>
            <Button asChild size="lg" variant="outline" block className="text-white ring-white/25">
              <Link href="/">Torna alla home</Link>
            </Button>
            {isGuest ? (
              <div className="mt-4 rounded-2xl bg-white/5 p-4 text-center ring-1 ring-white/10">
                <p className="text-body-sm font-semibold">
                  Vuoi rendere ancora più veloce il prossimo ordine?
                </p>
                <p className="mt-1 text-caption text-fg-muted">
                  Crea un account con la stessa e-mail: ritroverai anche questo ordine.
                </p>
                <Button asChild size="sm" variant="white" className="mt-3">
                  <Link href={signupHref}>Crea account</Link>
                </Button>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
