"use client";

import { ORDER_STATUS_LABELS, formatEuro } from "@dimsum/domain";
import type { CollectionState, FulfillmentType, OrderStatus } from "@dimsum/types";
import { Bike, Store } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

/** Page frame of the staff area: title row with actions, generous on desktop, tight on tablets. */
export function AdminPage({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1400px] px-4 pt-5 pb-16 lg:px-8 lg:pt-8", className)}>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-headline font-extrabold lg:text-display">{title}</h1>
          {description ? <p className="mt-1 text-body-sm text-fg-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn("rounded-2xl bg-surface ring-1 ring-line", className)}>
      {title || actions ? (
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title ? <h2 className="text-title font-bold">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-body-sm text-fg-muted">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={cn(padded && "p-5")}>{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "danger" | "success";
}) {
  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
      <p className="text-caption font-medium text-fg-muted">{label}</p>
      <p
        className={cn(
          "mt-1 text-headline font-extrabold tabular-nums",
          tone === "danger" && "text-danger",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-caption text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

const STATUS_TONE: Partial<
  Record<OrderStatus, "brand" | "warning" | "success" | "neutral" | "info" | "dark">
> = {
  PENDING_PAYMENT: "neutral",
  PAID: "info",
  RECEIVED: "warning",
  CONFIRMED: "info",
  PREPARING: "brand",
  READY_FOR_PICKUP: "success",
  RIDER_ASSIGNED: "success",
  RIDER_TO_RESTAURANT: "success",
  PICKED_UP: "dark",
  ON_THE_WAY: "dark",
  DELIVERED: "neutral",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
};

export function OrderStatusBadge({
  status,
  fulfillmentType,
  className,
}: {
  status: OrderStatus;
  fulfillmentType?: FulfillmentType;
  className?: string;
}) {
  const label =
    status === "RECEIVED"
      ? "Da accettare"
      : status === "DELIVERED" && fulfillmentType === "PICKUP"
        ? "Ritirato"
        : ORDER_STATUS_LABELS[status];
  return (
    <Badge
      tone={STATUS_TONE[status] ?? "neutral"}
      size="md"
      className={cn(status === "CANCELLED" && "line-through decoration-1", className)}
    >
      {label}
    </Badge>
  );
}

export function FulfillmentBadge({ type }: { type: FulfillmentType }) {
  return type === "DELIVERY" ? (
    <Badge tone="outline" size="md">
      <Bike /> Consegna
    </Badge>
  ) : (
    <Badge tone="outline" size="md">
      <Store /> Ritiro
    </Badge>
  );
}

export function CollectionBadge({
  collection,
  totalCents,
}: {
  collection: CollectionState;
  totalCents: number;
}) {
  switch (collection) {
    case "TO_COLLECT":
      return (
        <Badge tone="warning" size="md">
          Incassare {formatEuro(totalCents)}
        </Badge>
      );
    case "PENDING":
      return (
        <Badge tone="neutral" size="md">
          Pagamento in attesa
        </Badge>
      );
    case "REFUNDED":
      return (
        <Badge tone="neutral" size="md">
          Rimborsato
        </Badge>
      );
    default:
      return (
        <Badge tone="success" size="md">
          Pagato
        </Badge>
      );
  }
}

export function KeyValue({ rows, className }: { rows: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line text-body-sm", className)}>
      {rows.map(([k, v], i) => (
        <div key={i} className="flex justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="text-fg-muted">{k}</dt>
          <dd className="text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Confirmation for actions that are hard to undo (cancel order, refund, delete). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "danger",
  busy,
  onConfirm,
  children,
  disabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            loading={busy}
            disabled={disabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {children ? <div className="px-6 pb-4">{children}</div> : null}
    </Dialog>
  );
}
