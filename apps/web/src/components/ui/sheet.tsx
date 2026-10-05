"use client";

import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/cn";

/**
 * Bottom sheet with native-feeling drag to dismiss (mobile). Desktop surfaces use `Dialog`.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  hideTitle = false,
  dismissible = true,
  fullHeight = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  hideTitle?: boolean;
  dismissible?: boolean;
  /**
   * Fixed height of about three quarters of the screen, for content that starts with a text field:
   * the field sits towards the middle, above the keyboard, and nothing jumps when it opens.
   */
  fullHeight?: boolean;
}) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      dismissible={dismissible}
      shouldScaleBackground={false}
      repositionInputs={!fullHeight}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-canvas shadow-sheet outline-none",
            fullHeight && "h-[76dvh] max-h-[calc(100dvh-var(--safe-top)-12px)]",
            className,
          )}
        >
          <div className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-line-strong" aria-hidden />
          <Drawer.Title className={cn("px-5 pt-2 pb-1 text-title font-bold", hideTitle && "sr-only")}>
            {title}
          </Drawer.Title>
          {description ? (
            <Drawer.Description className={cn("px-5 text-body-sm text-fg-muted", hideTitle && "sr-only")}>
              {description}
            </Drawer.Description>
          ) : (
            <Drawer.Description className="sr-only">{title}</Drawer.Description>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          {footer ? (
            <div className="shrink-0 border-t border-line bg-canvas px-5 pt-3 pb-[calc(var(--safe-bottom)+12px)]">
              {footer}
            </div>
          ) : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function SheetCloseButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <Drawer.Close asChild>
      <button
        type="button"
        aria-label="Chiudi"
        className={cn(
          "grid size-10 tap place-items-center rounded-full bg-black/45 text-white backdrop-blur-md",
          className,
        )}
        {...props}
      >
        <X className="size-5" />
      </button>
    </Drawer.Close>
  );
}
