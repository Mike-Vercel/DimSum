import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  "relative inline-flex tap items-center justify-center gap-2 font-semibold whitespace-nowrap outline-none select-none disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand text-on-brand shadow-cta hover:bg-red-600 active:bg-red-700",
        dark: "bg-ink-900 text-white hover:bg-ink-800 dark:bg-white dark:text-ink-900 dark:hover:bg-cream-100",
        secondary: "bg-surface text-fg shadow-sm ring-1 ring-line hover:bg-surface-2",
        outline: "bg-transparent text-fg ring-1 ring-line-strong ring-inset hover:bg-surface",
        ghost: "bg-transparent text-fg hover:bg-surface-3/60",
        soft: "bg-brand-soft text-brand-ink hover:bg-red-100 dark:hover:bg-red-500/25",
        danger: "bg-danger-soft text-danger hover:bg-red-100",
        white: "bg-white text-ink-900 shadow-sm hover:bg-cream-50",
        link: "h-auto rounded-none p-0 text-brand-ink underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 rounded-sm px-3.5 text-caption",
        md: "h-11 rounded-md px-5 text-body-sm",
        lg: "h-13 rounded-lg px-6 text-body",
        xl: "h-14 rounded-xl px-7 text-title-sm",
        icon: "size-11 rounded-full",
        "icon-sm": "size-9 rounded-full",
        "icon-lg": "size-13 rounded-full",
      },
      block: { true: "w-full" },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  block,
  asChild,
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-2">{children}</span>
          <span className="absolute inset-0 grid place-items-center">
            <Spinner className="size-5" />
          </span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
}
