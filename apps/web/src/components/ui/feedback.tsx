import { AlertTriangle, Info, RotateCw, WifiOff, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {Icon ? (
        <div className="mb-5 grid size-16 place-items-center rounded-full bg-surface text-fg-muted shadow-sm ring-1 ring-line">
          <Icon className="size-7" strokeWidth={1.6} />
        </div>
      ) : null}
      <h2 className="text-title-sm font-bold">{title}</h2>
      {description ? <p className="mt-1.5 max-w-sm text-body-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Qualcosa non ha funzionato",
  description = "Non siamo riusciti a caricare questa sezione. Riprova tra qualche istante.",
  onRetry,
  offline,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  offline?: boolean;
  className?: string;
}) {
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div role="alert" className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <div className="mb-5 grid size-16 place-items-center rounded-full bg-danger-soft text-danger">
        <Icon className="size-7" strokeWidth={1.7} />
      </div>
      <h2 className="text-title-sm font-bold">{offline ? "Sei offline" : title}</h2>
      <p className="mt-1.5 max-w-sm text-body-sm text-fg-muted">
        {offline ? "Controlla la connessione: riproveremo appena torni online." : description}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex h-11 tap items-center gap-2 rounded-full bg-surface px-5 text-body-sm font-semibold shadow-sm ring-1 ring-line"
        >
          <RotateCw className="size-4" /> Riprova
        </button>
      ) : null}
    </div>
  );
}

export function InlineAlert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const styles = {
    info: "bg-info-soft text-info",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
  }[tone];
  const Icon = tone === "info" || tone === "success" ? Info : AlertTriangle;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-md p-3.5", styles, className)}
    >
      <Icon className="mt-0.5 size-4.5 shrink-0" />
      <div className="min-w-0 flex-1 text-body-sm">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "text-fg/80")}>{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}
