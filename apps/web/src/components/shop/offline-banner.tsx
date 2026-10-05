"use client";

import { WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useOffline } from "@/lib/connectivity";

/** Visible connectivity state: browsing works from cache, ordering waits for the network. */
export function OfflineBanner() {
  const offline = useOffline();
  return (
    <AnimatePresence>
      {offline ? (
        <motion.div
          role="status"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-ink-900 px-4 pt-[calc(var(--safe-top)+6px)] pb-1.5 text-caption font-semibold text-white"
        >
          <WifiOff className="size-4" aria-hidden />
          Sei offline: prezzi e disponibilità potrebbero non essere aggiornati.
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
