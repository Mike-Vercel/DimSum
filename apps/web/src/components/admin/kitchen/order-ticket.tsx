"use client";

import { formatEuro } from "@dimsum/domain";
import type { KitchenItemDTO, KitchenOrderDTO, StaffOrderCommand } from "@dimsum/types";
import {
  Bike,
  CalendarClock,
  Clock,
  MessageSquareText,
  MoreHorizontal,
  Phone,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { CollectionBadge } from "../ui";
import { ItemThumb } from "./item-dialog";

export type TicketAction =
  | { type: "accept" }
  | { type: "reject" }
  | { type: "cancel" }
  | { type: "assign" }
  | { type: "command"; command: "START_PREPARING" | "MARK_READY" | "UNASSIGN_RIDER" | "PICK_UP" | "DELIVER" }
  | { type: "delay"; minutes: number };

const DELIVERY_STATUS: Record<string, string> = {
  ASSIGNED: "assegnato",
  TO_RESTAURANT: "in arrivo al locale",
  AT_RESTAURANT: "al locale",
  PICKED_UP: "ha ritirato",
  ON_THE_WAY: "in consegna",
};

/** "8′", "1 h 05′": countdowns stay readable for orders scheduled hours ahead. */
function duration(minutes: number): string {
  if (minutes < 60) return `${minutes}′`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}′`;
}

function minutesBetween(fromIso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60_000));
}

function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone }).format(
    new Date(iso),
  );
}

/** One order on the kitchen display: big readable items, the next action always in the same place. */
export function OrderTicket({
  order,
  now,
  timeZone,
  busy,
  onAction,
  onOpenItem,
}: {
  order: KitchenOrderDTO;
  now: number;
  timeZone: string;
  busy: boolean;
  onAction: (a: TicketAction) => void;
  onOpenItem: (item: KitchenItemDTO) => void;
}) {
  const has = (c: StaffOrderCommand) => order.commands.includes(c);
  const waited = order.receivedAt ? minutesBetween(order.receivedAt, now) : 0;
  const dueIn = order.dueAt ? Math.round((new Date(order.dueAt).getTime() - now) / 60_000) : null;
  const late = dueIn !== null && dueIn < 0 && !order.readyAt;
  const isDelivery = order.fulfillmentType === "DELIVERY";
  // Scheduled orders open for acceptance 30 minutes before they must be ready.
  const opensIn =
    order.status === "RECEIVED" && order.acceptFrom
      ? Math.ceil((new Date(order.acceptFrom).getTime() - now) / 60_000)
      : null;
  const locked = opensIn !== null && opensIn > 0;

  let primary: ReactNode = null;
  if (order.status === "RECEIVED" && locked) {
    primary = (
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2">
        <Button size="lg" variant="secondary" disabled>
          Accetta dalle {clock(order.acceptFrom!, timeZone)}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="px-3"
          disabled={busy}
          onClick={() => onAction({ type: "reject" })}
        >
          Rifiuta
        </Button>
      </div>
    );
  } else if (order.status === "RECEIVED") {
    primary = (
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2">
        <Button size="lg" loading={busy} onClick={() => onAction({ type: "accept" })}>
          Accetta
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="px-3"
          disabled={busy}
          onClick={() => onAction({ type: "reject" })}
        >
          Rifiuta
        </Button>
      </div>
    );
  } else if (has("MARK_READY")) {
    primary = (
      <div className={cn("grid gap-2", has("START_PREPARING") && "grid-cols-2")}>
        {has("START_PREPARING") ? (
          <Button
            size="lg"
            variant="secondary"
            disabled={busy}
            onClick={() => onAction({ type: "command", command: "START_PREPARING" })}
          >
            Inizia
          </Button>
        ) : null}
        <Button
          size="lg"
          variant="dark"
          loading={busy}
          onClick={() => onAction({ type: "command", command: "MARK_READY" })}
        >
          Pronto
        </Button>
      </div>
    );
  } else if (isDelivery && !order.rider && has("ASSIGN_RIDER")) {
    primary = (
      <Button size="lg" block loading={busy} onClick={() => onAction({ type: "assign" })}>
        <Bike className="size-4.5" /> Assegna rider
      </Button>
    );
  } else if (isDelivery && has("PICK_UP")) {
    primary = (
      <Button
        size="lg"
        block
        variant="secondary"
        loading={busy}
        onClick={() => onAction({ type: "command", command: "PICK_UP" })}
      >
        Consegnato al rider
      </Button>
    );
  } else if (has("DELIVER")) {
    primary = (
      <Button
        size="lg"
        block
        variant={isDelivery ? "secondary" : "dark"}
        loading={busy}
        onClick={() => onAction({ type: "command", command: "DELIVER" })}
      >
        {isDelivery ? "Segna come consegnato" : "Ritirato dal cliente"}
      </Button>
    );
  }

  const accent =
    order.status === "RECEIVED"
      ? locked
        ? "bg-info"
        : "bg-warning"
      : order.column === "READY"
        ? "bg-success"
        : order.column === "OUT"
          ? "bg-ink-900 dark:bg-white"
          : "bg-brand";

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-3xl bg-surface p-4 pt-5 shadow-sm ring-1 ring-line",
        order.status === "RECEIVED" && !locked && "ring-2 ring-warning",
        order.escalated && "animate-alert-flash ring-2 ring-danger",
        late && "ring-2 ring-danger",
      )}
    >
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1.5", accent)} />
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/ordini/${order.id}`}
              className="text-headline font-extrabold tabular-nums underline-offset-4 hover:underline"
              title="Apri il dettaglio dell'ordine"
            >
              #{order.number}
            </Link>
            <Badge tone={isDelivery ? "dark" : "info"} size="md">
              {isDelivery ? "Consegna" : "Ritiro"}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-body-sm font-semibold">
            {order.customerName}
            {order.zoneName ? <span className="font-normal text-fg-muted"> · {order.zoneName}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-caption font-bold tabular-nums",
              order.escalated ? "bg-danger text-white" : "bg-surface-2 text-fg-muted",
            )}
            title="Minuti dalla ricezione"
          >
            <Clock className="size-3.5" />
            {duration(waited)}
          </span>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              aria-label={`Altre azioni per #${order.number}`}
              className="grid size-8 tap place-items-center rounded-full hover:bg-surface-2"
            >
              <MoreHorizontal className="size-4.5" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 min-w-56 rounded-xl bg-canvas p-1.5 shadow-lg ring-1 ring-line"
              >
                <MenuItem href={`/admin/ordini/${order.id}`}>Dettagli ordine</MenuItem>
                {order.customerPhone ? (
                  <MenuItem href={`tel:${order.customerPhone}`}>
                    Chiama {order.customerName.split(" ")[0]}
                  </MenuItem>
                ) : null}
                {order.confirmedAt && !order.readyAt ? (
                  <MenuItem onSelect={() => onAction({ type: "delay", minutes: 5 })}>
                    +5 minuti di preparazione
                  </MenuItem>
                ) : null}
                {isDelivery && has("ASSIGN_RIDER") && order.rider ? (
                  <MenuItem onSelect={() => onAction({ type: "assign" })}>Cambia rider</MenuItem>
                ) : null}
                {isDelivery && !order.rider && has("ASSIGN_RIDER") && order.status !== "READY_FOR_PICKUP" ? (
                  <MenuItem onSelect={() => onAction({ type: "assign" })}>Assegna rider</MenuItem>
                ) : null}
                {has("UNASSIGN_RIDER") ? (
                  <MenuItem onSelect={() => onAction({ type: "command", command: "UNASSIGN_RIDER" })}>
                    Togli il rider
                  </MenuItem>
                ) : null}
                {has("CANCEL") && order.status !== "RECEIVED" ? (
                  <MenuItem danger onSelect={() => onAction({ type: "cancel" })}>
                    Annulla ordine
                  </MenuItem>
                ) : null}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {order.scheduledFor ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl bg-info-soft px-3 py-2 text-body-sm font-semibold text-info">
          <CalendarClock className="size-4" /> {isDelivery ? "Consegna" : "Ritiro"} alle{" "}
          {clock(order.scheduledFor, timeZone)}
          {locked ? (
            <span className="font-medium">
              · si accetta dalle {clock(order.acceptFrom!, timeZone)} (tra {duration(opensIn!)})
            </span>
          ) : null}
        </p>
      ) : null}

      <ul className="mt-3 space-y-1.5 border-t border-dashed border-line pt-3">
        {order.items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onOpenItem(item)}
              className="-mx-2 flex w-[calc(100%+1rem)] tap items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
            >
              <span className="relative">
                <ItemThumb item={item} />
                <span className="absolute -top-1.5 -right-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-ink-950 px-1.5 text-caption font-extrabold text-white tabular-nums ring-2 ring-surface">
                  {item.quantity}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body leading-snug font-semibold">
                  {item.name}
                  {item.variantName ? (
                    <span className="font-normal text-fg-muted"> · {item.variantName}</span>
                  ) : null}
                  {item.posCode ? (
                    <span className="ml-1.5 rounded bg-surface-2 px-1.5 py-0.5 align-middle text-micro font-bold text-fg-muted">
                      {item.posCode}
                    </span>
                  ) : null}
                </span>
                {item.modifiers.length ? (
                  <span className="block text-body-sm text-fg-muted">
                    +{" "}
                    {item.modifiers
                      .map((m) => `${m.quantity > 1 ? `${m.quantity}× ` : ""}${m.name}`)
                      .join(", ")}
                  </span>
                ) : null}
                {item.notes ? (
                  <span className="block text-body-sm font-semibold text-warning">“{item.notes}”</span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {order.kitchenNotes ? (
        <p className="mt-3 flex gap-2 rounded-lg bg-warning-soft px-3 py-2 text-body-sm font-medium">
          <MessageSquareText className="mt-0.5 size-4 shrink-0 text-warning" /> {order.kitchenNotes}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-body-sm">
        <CollectionBadge collection={order.collection} totalCents={order.totalCents} />
        {order.dueAt && !order.readyAt && (!order.scheduledFor || (dueIn !== null && dueIn <= 90)) ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 font-semibold",
              late ? "text-danger" : "text-fg-muted",
            )}
          >
            {late ? <TriangleAlert className="size-4" /> : null}
            Pronto entro {clock(order.dueAt, timeZone)}
            {dueIn !== null
              ? late
                ? ` · in ritardo di ${duration(-dueIn)}`
                : ` · tra ${duration(dueIn)}`
              : ""}
          </span>
        ) : null}
        {order.collection === "PAID" ? null : (
          <span className="text-caption text-fg-subtle">Totale {formatEuro(order.totalCents)}</span>
        )}
      </div>

      {isDelivery && order.rider ? (
        <p className="mt-2 flex items-center gap-2 text-body-sm">
          <Bike className="size-4 text-fg-muted" />
          <span className="font-semibold">{order.rider.name}</span>
          <span className="text-fg-muted">
            {order.deliveryStatus ? DELIVERY_STATUS[order.deliveryStatus] : ""}
          </span>
          {order.eta && order.column === "OUT" ? (
            <span className="ml-auto text-fg-muted">
              arrivo {clock(order.eta.from, timeZone)}–{clock(order.eta.to, timeZone)}
            </span>
          ) : null}
        </p>
      ) : null}

      {order.customerPhone && order.status === "RECEIVED" ? (
        <a
          href={`tel:${order.customerPhone}`}
          className="mt-2 inline-flex items-center gap-1.5 text-caption text-fg-muted hover:text-fg"
        >
          <Phone className="size-3.5" /> {order.customerPhone}
        </a>
      ) : null}

      {primary ? <div className="mt-4">{primary}</div> : null}
    </article>
  );
}

function MenuItem({
  children,
  onSelect,
  href,
  danger,
}: {
  children: ReactNode;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const cls = cn(
    "flex cursor-pointer rounded-lg px-3 py-2.5 text-body-sm font-medium outline-none data-[highlighted]:bg-surface-2",
    danger && "text-danger",
  );
  if (href) {
    return (
      <DropdownMenu.Item asChild className={cls}>
        {href.startsWith("tel:") ? <a href={href}>{children}</a> : <Link href={href}>{children}</Link>}
      </DropdownMenu.Item>
    );
  }
  return (
    <DropdownMenu.Item className={cls} onSelect={onSelect}>
      {children}
    </DropdownMenu.Item>
  );
}
