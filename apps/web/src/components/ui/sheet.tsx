"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/cn";

/**
 * While the sheet contains an element marked `data-sheet-anchor` (a search field), the sheet is
 * placed so that element sits in the middle of the visible screen: of the whole screen while the
 * keyboard is closed, of the part above it once it opens (visualViewport, iOS and Android alike).
 */
function useCenteredAnchor(enabled: boolean) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);
  useEffect(() => {
    if (!enabled || !node) return;
    const viewport = window.visualViewport;
    let offset: number | null = null;
    let frame = 0;
    const update = () => {
      const anchor = node.querySelector<HTMLElement>("[data-sheet-anchor]");
      if (!anchor) {
        offset = null;
        setStyle(undefined);
        return;
      }
      const a = anchor.getBoundingClientRect();
      // Distance from the top of the sheet to the middle of the field: fixed by the layout above it.
      offset ??= a.top + a.height / 2 - node.getBoundingClientRect().top;
      const visibleTop = viewport?.offsetTop ?? 0;
      const visibleHeight = viewport?.height ?? window.innerHeight;
      const top = Math.round(Math.max(visibleTop + 8, visibleTop + visibleHeight / 2 - offset));
      const bottom = Math.round(Math.max(0, window.innerHeight - visibleTop - visibleHeight));
      setStyle((prev) =>
        prev?.top === top && prev.bottom === bottom
          ? prev
          : { top, bottom, height: "auto", maxHeight: "none" },
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    schedule();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    // The anchor goes away when the content changes (an address was chosen): back to the tall sheet.
    const observer = new MutationObserver(schedule);
    observer.observe(node, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [enabled, node]);
  return [enabled ? style : undefined, setNode] as const;
}

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
  keepFieldCentered = false,
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
   * For content that starts with a search field (`data-sheet-anchor`): the field stays in the middle
   * of the visible screen, keyboard open or not. Without the field: about three quarters of the screen.
   */
  keepFieldCentered?: boolean;
}) {
  const [sheetStyle, setSheetNode] = useCenteredAnchor(keepFieldCentered);
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      dismissible={dismissible}
      shouldScaleBackground={false}
      repositionInputs={!keepFieldCentered}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]" />
        <Drawer.Content
          ref={setSheetNode}
          style={sheetStyle}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-canvas shadow-sheet outline-none",
            keepFieldCentered && "h-[76dvh] max-h-[calc(100dvh-var(--safe-top)-12px)]",
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
