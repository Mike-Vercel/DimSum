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
            "fixed top-1/2 left-1/2 z-50 flex max-h-[min(88dvh,860px)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-canvas shadow-lg outline-none data-[state=open]:animate-fade-in",
            width,
            className,
          )}
        >
          <div className={cn("flex items-start gap-4 px-6 pt-6 pb-2", hideHeader && "sr-only")}>
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
          {footer ? <div className="border-t border-line px-6 py-4">{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
