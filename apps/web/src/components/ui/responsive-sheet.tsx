"use client";

import type { ReactNode } from "react";
import { useIsDesktop } from "@/lib/use-media-query";
import { Dialog } from "./dialog";
import { BottomSheet } from "./sheet";

/** Bottom sheet on phones, centred dialog on desktop — same content, native feel on each. */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  fullHeight,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Phones: open almost full screen (content that starts with a text field). */
  fullHeight?: boolean;
}) {
  const desktop = useIsDesktop();
  if (desktop) {
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={description}
        footer={footer}
        size="md"
      >
        <div className="pt-2">{children}</div>
      </Dialog>
    );
  }
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={footer}
      fullHeight={fullHeight}
    >
      <div className="pt-3">{children}</div>
    </BottomSheet>
  );
}
