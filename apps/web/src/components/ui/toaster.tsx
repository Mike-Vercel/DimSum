"use client";

import { CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";
import { Toaster as Sonner } from "sonner";

export { toast } from "sonner";

/** Toasts styled with the design tokens (no default library look). */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      offset={{ top: "calc(var(--safe-top) + 12px)" }}
      mobileOffset={{ top: "calc(var(--safe-top) + 10px)" }}
      gap={8}
      visibleToasts={3}
      icons={{
        success: <CheckCircle2 className="size-5 text-jade-500" />,
        error: <XCircle className="size-5 text-red-400" />,
        warning: <TriangleAlert className="size-5 text-saffron-500" />,
        info: <Info className="size-5 text-sky-500" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-[min(92vw,380px)] items-center gap-3 rounded-2xl bg-ink-900/95 px-4 py-3.5 text-body-sm text-white shadow-lg backdrop-blur-md",
          title: "font-semibold",
          description: "text-caption text-white/70",
          actionButton: "ml-auto rounded-full bg-white px-3 py-1.5 text-caption font-semibold text-ink-900",
          cancelButton: "rounded-full px-3 py-1.5 text-caption text-white/70",
        },
      }}
    />
  );
}
