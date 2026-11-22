"use client";

import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { useBack } from "@/lib/nav-history";

/** The app's back arrow: returns to the previous page (see useBack), or to `fallback`. */
export function BackButton({
  fallback,
  label = "Indietro",
  className,
}: {
  fallback: string;
  label?: string;
  className?: string;
}) {
  const back = useBack(fallback);
  return (
    <button
      type="button"
      onClick={back}
      aria-label={label}
      className={cn("grid size-10 shrink-0 tap place-items-center rounded-full", className)}
    >
      <ArrowLeft className="size-5" />
    </button>
  );
}
