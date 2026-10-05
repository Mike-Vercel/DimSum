"use client";

import { Check } from "lucide-react";
import { Checkbox as RadixCheckbox, RadioGroup, Switch as RadixSwitch } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Checkbox({ className, ...props }: ComponentProps<typeof RadixCheckbox.Root>) {
  return (
    <RadixCheckbox.Root
      className={cn(
        "grid size-5.5 shrink-0 tap place-items-center rounded-[7px] bg-surface ring-1 ring-line-strong transition-colors ring-inset data-[state=checked]:bg-brand data-[state=checked]:ring-brand",
        className,
      )}
      {...props}
    >
      <RadixCheckbox.Indicator>
        <Check className="size-3.5 text-white" strokeWidth={3.5} />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}

export function Switch({ className, ...props }: ComponentProps<typeof RadixSwitch.Root>) {
  return (
    <RadixSwitch.Root
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full bg-surface-3 ring-1 ring-line transition-colors ring-inset disabled:opacity-50 data-[state=checked]:bg-jade-500 data-[state=checked]:ring-jade-500",
        className,
      )}
      {...props}
    >
      <RadixSwitch.Thumb className="block size-6 translate-x-0.5 rounded-full bg-white shadow-md transition-transform duration-200 ease-[var(--ease-out-quint)] data-[state=checked]:translate-x-[22px]" />
    </RadixSwitch.Root>
  );
}

export const RadioCardGroup = RadioGroup.Root;

/** Selectable card used for delivery time, payment method and tip choices (reference screens 6–7). */
export function RadioCard({
  value,
  title,
  description,
  icon,
  trailing,
  disabled,
  className,
}: {
  value: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <RadioGroup.Item
      value={value}
      disabled={disabled}
      className={cn(
        "group flex w-full tap items-center gap-3.5 rounded-lg bg-surface p-4 text-left ring-1 ring-line transition-[box-shadow,background-color] ring-inset disabled:opacity-50 data-[state=checked]:bg-brand-soft/40 data-[state=checked]:ring-2 data-[state=checked]:ring-brand",
        className,
      )}
    >
      <span className="grid size-5.5 shrink-0 place-items-center rounded-full ring-2 ring-line-strong transition-colors ring-inset group-data-[state=checked]:ring-brand">
        <RadioGroup.Indicator className="size-2.5 rounded-full bg-brand" />
      </span>
      {icon ? (
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-fg">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-fg">{title}</span>
        {description ? <span className="block text-caption text-fg-muted">{description}</span> : null}
      </span>
      {trailing}
    </RadioGroup.Item>
  );
}
