"use client";

import type { TimelineStepDTO } from "@dimsum/types";
import {
  Bike,
  Check,
  ChefHat,
  CircleCheck,
  PackageCheck,
  ReceiptText,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

const ICONS: Record<string, LucideIcon> = {
  received: ReceiptText,
  confirmed: CircleCheck,
  preparing: ChefHat,
  ready: PackageCheck,
  rider: UserRound,
  on_the_way: Bike,
  delivered: Check,
};

const time = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
});

/** Live order timeline (reference screen 9). */
export function OrderTimeline({ steps, cancelled }: { steps: TimelineStepDTO[]; cancelled: boolean }) {
  return (
    <ol className="relative" aria-label="Stato dell'ordine">
      {steps.map((s, i) => {
        const Icon = ICONS[s.key] ?? Check;
        const done = s.state === "done";
        const current = s.state === "current" && !cancelled;
        return (
          <li
            key={s.key}
            className="relative flex gap-4 pb-5 last:pb-0"
            aria-current={current ? "step" : undefined}
          >
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className="absolute top-9 bottom-0 left-[17px] w-0.5 overflow-hidden rounded-full bg-line"
              >
                <motion.span
                  className="block w-full bg-jade-500"
                  initial={false}
                  animate={{ height: done ? "100%" : "0%" }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
            ) : null}
            <span
              className={cn(
                "relative z-10 grid size-9 shrink-0 place-items-center rounded-full ring-2 transition-colors duration-500",
                done
                  ? "bg-jade-500 text-white ring-jade-500"
                  : current
                    ? "bg-surface text-red-400 ring-red-400"
                    : "bg-surface text-fg-subtle ring-line",
              )}
            >
              {current ? (
                <span
                  className="absolute inset-0 animate-ping rounded-full ring-2 ring-red-400/50"
                  aria-hidden
                />
              ) : null}
              <Icon className="size-4.5" strokeWidth={2.2} />
            </span>
            <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3 pt-1.5">
              <p
                className={cn(
                  "text-body-sm",
                  done ? "font-semibold text-fg" : current ? "font-bold text-fg" : "text-fg-subtle",
                )}
              >
                {s.label}
                {current ? <span className="sr-only"> (in corso)</span> : null}
              </p>
              {s.at ? (
                <time className="shrink-0 text-caption text-fg-muted tabular-nums">
                  {time.format(new Date(s.at))}
                </time>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
