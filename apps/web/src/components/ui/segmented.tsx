"use client";

import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";
import { spring } from "@/lib/motion";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

/** Pill segmented control (Consegna / Ritiro, Attivi / Cronologia). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
  ariaLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
  ariaLabel: string;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "relative grid auto-cols-fr grid-flow-col rounded-full bg-surface-3/80 p-1 dark:bg-white/8",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => {
              if (!active) {
                haptics.select();
                onChange(o.value);
              }
            }}
            className={cn(
              "relative z-0 flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors disabled:opacity-40",
              size === "sm" ? "h-8 px-3 text-caption" : "h-10 px-4 text-body-sm",
              active ? "text-on-brand" : "text-fg-muted hover:text-fg",
            )}
          >
            {active ? (
              <motion.span
                layoutId={`seg-${id}`}
                transition={spring.snappy}
                className="absolute inset-0 -z-10 rounded-full bg-brand shadow-cta"
              />
            ) : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
