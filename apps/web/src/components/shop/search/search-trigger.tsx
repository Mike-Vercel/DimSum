"use client";

import { Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Dialog as RadixDialog } from "radix-ui";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { SearchPanel } from "./search-panel";

/** Opens the menu search. "icon" for the mobile header, "field" for desktop and the home page. */
export function SearchOverlayTrigger({
  variant,
  className,
}: {
  variant: "icon" | "field" | "bar";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Trigger asChild>
        {variant === "icon" ? (
          <button
            type="button"
            aria-label="Cerca nel menu"
            className={cn(
              "grid size-10 tap place-items-center rounded-full bg-surface ring-1 ring-line",
              className,
            )}
          >
            <Search className="size-5" />
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              "flex h-11 tap items-center gap-3 rounded-full bg-surface px-4 text-left text-body-sm text-fg-subtle ring-1 ring-line transition-shadow hover:shadow-sm",
              variant === "field" ? "w-44 xl:w-56" : "h-12 w-full",
              className,
            )}
          >
            <Search className="size-5 text-fg-muted" aria-hidden />
            Cerca nel menu
          </button>
        )}
      </RadixDialog.Trigger>
      <AnimatePresence>
        {open ? (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 hidden bg-overlay md:block"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </RadixDialog.Overlay>
            <RadixDialog.Content asChild forceMount>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={spring.smooth}
                className="fixed inset-0 z-50 bg-canvas outline-none md:inset-x-auto md:top-[8vh] md:left-1/2 md:h-[min(720px,84vh)] md:w-[min(640px,92vw)] md:-translate-x-1/2 md:rounded-3xl md:shadow-lg"
              >
                <RadixDialog.Title className="sr-only">Cerca nel menu</RadixDialog.Title>
                <RadixDialog.Description className="sr-only">
                  Risultati istantanei per nome, ingrediente o categoria
                </RadixDialog.Description>
                <SearchPanel onClose={() => setOpen(false)} />
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        ) : null}
      </AnimatePresence>
    </RadixDialog.Root>
  );
}
