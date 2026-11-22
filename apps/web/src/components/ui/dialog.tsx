"use client";

import { X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  size = "md",
  hideHeader = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  hideHeader?: boolean;
}) {
  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <RadixDialog.Content
          className={cn(
            // Phones: a sheet from the bottom, full width and nearly full height (more room to work,
            // thumbs near the buttons). From sm up: the centred card.
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-canvas shadow-lg outline-none data-[state=open]:animate-sheet-up",
            "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[min(88dvh,860px)] sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:data-[state=open]:animate-fade-in",
            width,
            className,
          )}
        >
          <span aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-fg/15 sm:hidden" />
          <div className={cn("flex items-start gap-4 px-5 pt-4 pb-2 sm:px-6 sm:pt-6", hideHeader && "sr-only")}>
            <div className="min-w-0 flex-1">
              <RadixDialog.Title className="text-title font-bold">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-body-sm text-fg-muted">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close
              aria-label="Chiudi"
              className="grid size-9 shrink-0 tap place-items-center rounded-full bg-surface-3/70 text-fg hover:bg-surface-3"
            >
              <X className="size-4.5" />
            </RadixDialog.Close>
          </div>
          {!description ? (
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer ? (
            <div className="border-t border-line px-5 pt-3.5 pb-[calc(0.875rem+var(--safe-bottom))] sm:px-6 sm:py-4">
              {footer}
            </div>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
