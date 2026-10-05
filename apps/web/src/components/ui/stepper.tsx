"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";
import { AnimatedNumber } from "./animated-number";

/** Quantity stepper. When `removable`, decreasing from 1 shows a trash icon and removes the line. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 30,
  size = "md",
  removable = false,
  label = "Quantità",
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  removable?: boolean;
  label?: string;
  className?: string;
}) {
  const atMin = value <= min;
  const showTrash = removable && value <= 1;
  const dims =
    size === "lg"
      ? "h-13 [&_button]:size-13"
      : size === "sm"
        ? "h-8 [&_button]:size-8"
        : "h-10 [&_button]:size-10";
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex items-center rounded-full bg-surface ring-1 ring-line ring-inset",
        dims,
        className,
      )}
    >
      <button
        type="button"
        aria-label={showTrash ? "Rimuovi" : "Diminuisci"}
        disabled={atMin && !removable}
        onClick={() => {
          haptics.tap();
          onChange(value - 1);
        }}
        className="grid tap place-items-center rounded-full text-fg transition-colors hover:bg-surface-3 disabled:opacity-35"
      >
        {showTrash ? <Trash2 className="size-4 text-danger" /> : <Minus className="size-4" />}
      </button>
      <AnimatedNumber
        value={value}
        className={cn("min-w-7 justify-center font-bold", size === "lg" ? "text-title-sm" : "text-body")}
      />
      <button
        type="button"
        aria-label="Aumenta"
        disabled={value >= max}
        onClick={() => {
          haptics.tap();
          onChange(value + 1);
        }}
        className="grid tap place-items-center rounded-full text-fg transition-colors hover:bg-surface-3 disabled:opacity-35"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
