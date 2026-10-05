import { formatEuro, initialsOf } from "@dimsum/domain";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Price({ cents, className, strike }: { cents: number; className?: string; strike?: boolean }) {
  return (
    <span className={cn("tabular-nums", strike && "text-fg-subtle line-through", className)}>
      {formatEuro(cents)}
    </span>
  );
}

export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-ink-900 text-body-sm font-bold text-white",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote avatars from OAuth providers
        <img src={src} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initialsOf(name) || "?"
      )}
    </span>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl bg-surface shadow-sm ring-1 ring-line/70", className)} {...props} />;
}

export function SectionTitle({
  title,
  action,
  className,
  as: As = "h2",
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <As className="text-title font-bold tracking-tight">{title}</As>
      {action}
    </div>
  );
}

/** Settings-style row with chevron (profile menu, reference screen 12). */
export function ListRow({
  href,
  icon,
  label,
  description,
  trailing,
  onClick,
  tone,
}: {
  href?: string;
  icon?: ReactNode;
  label: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  tone?: "danger";
}) {
  const content = (
    <>
      {icon ? (
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-fg",
            tone === "danger" && "bg-danger-soft text-danger",
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={cn("block font-medium", tone === "danger" ? "text-danger" : "text-fg")}>
          {label}
        </span>
        {description ? (
          <span className="block truncate text-caption text-fg-muted">{description}</span>
        ) : null}
      </span>
      {trailing ?? <ChevronRight className="size-4.5 text-fg-subtle" />}
    </>
  );
  const cls =
    "tap flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-surface-2";
  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  );
}

export function Divider({ className, label }: { className?: string; label?: string }) {
  if (!label) return <hr className={cn("border-line", className)} />;
  return (
    <div className={cn("flex items-center gap-3 text-caption text-fg-subtle", className)} role="separator">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
