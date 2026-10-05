import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "bg-surface-3 text-fg",
        brand: "bg-brand-soft text-brand-ink",
        solid: "bg-brand text-on-brand",
        dark: "bg-ink-900 text-white",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        info: "bg-info-soft text-info",
        outline: "text-fg-muted ring-1 ring-line-strong ring-inset",
        glass: "bg-black/45 text-white backdrop-blur-md",
      },
      size: {
        sm: "h-5 px-2 text-micro",
        md: "h-6 px-2.5 text-caption",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  },
);

export function Badge({
  className,
  tone,
  size,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}

export interface ChipProps extends ComponentProps<"button"> {
  selected?: boolean;
}

/** Filter chip (search filters, quick replies). */
export function Chip({ className, selected, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 shrink-0 tap items-center gap-1.5 rounded-full px-4 text-body-sm font-semibold transition-colors",
        selected
          ? "bg-brand text-on-brand shadow-cta"
          : "bg-surface text-fg ring-1 ring-line hover:bg-surface-2",
        className,
      )}
      {...props}
    />
  );
}
