"use client";

import type { AdminRiderDTO, KitchenOrderDTO } from "@dimsum/types";
import { Bike, CircleDot } from "lucide-react";
import { useState } from "react";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/cn";

/** "Accetta": the kitchen promises a preparation time (10/15/20/25/30/45 or custom). */
export function AcceptDialog({
  order,
  options,
  defaultMinutes,
  busy,
  onClose,
  onConfirm,
}: {
  order: KitchenOrderDTO | null;
  options: number[];
  defaultMinutes: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (minutes: number) => void;
}) {
  const [minutes, setMinutes] = useState(defaultMinutes);
  const [custom, setCustom] = useState("");
  const value = custom ? Number(custom) : minutes;
  const valid = Number.isInteger(value) && value >= 1 && value <= 240;

  return (
    <Dialog
      open={!!order}
      onOpenChange={(open) => !open && onClose()}
      title={order ? `Accetta #${order.number}` : "Accetta ordine"}
      description={
        order?.scheduledFor
          ? "Ordine programmato: il tempo serve a pianificare la preparazione."
          : "Tra quanti minuti sarà pronto?"
      }
      size="sm"
      footer={
        <Button size="lg" block disabled={!valid} loading={busy} onClick={() => onConfirm(value)}>
          Accetta · pronto in {valid ? value : "–"} min
        </Button>
      }
    >
      <div className="space-y-5 px-6 pb-4">
        <div className="grid grid-cols-3 gap-2">
          {options.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMinutes(m);
                setCustom("");
              }}
              aria-pressed={!custom && minutes === m}
              aria-label={`${m} minuti`}
              className={cn(
                "h-16 tap rounded-xl text-title font-extrabold tabular-nums ring-1 transition-colors",
                !custom && minutes === m
                  ? "bg-ink-950 text-white ring-ink-950"
                  : "bg-surface ring-line hover:bg-surface-2",
              )}
            >
              {m}
              <span className="ml-0.5 text-caption font-semibold">min</span>
            </button>
          ))}
        </div>
        <Field label="Altro tempo (minuti)" optional>
          {(p) => (
            <Input
              {...p}
              inputMode="numeric"
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="Es. 35"
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

const REJECT_REASONS = [
  "Prodotto esaurito",
  "Troppi ordini in questo momento",
  "Indirizzo non raggiungibile",
  "Chiusura imprevista",
];

/** Reject (before acceptance) or cancel (after): a reason is always recorded and sent to the customer. */
export function ReasonDialog({
  order,
  mode,
  busy,
  onClose,
  onConfirm,
}: {
  order: KitchenOrderDTO | null;
  mode: "reject" | "cancel";
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [preset, setPreset] = useState<string | null>(null);
  const text = preset ?? reason.trim();
  const refundNote =
    order && order.collection === "PAID" ? " Il pagamento online viene rimborsato automaticamente." : "";
  return (
    <Dialog
      open={!!order}
      onOpenChange={(open) => !open && onClose()}
      title={order ? `${mode === "reject" ? "Rifiuta" : "Annulla"} #${order.number}` : ""}
      description={`Il cliente riceve il motivo via e-mail e notifica.${refundNote}`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>
            Indietro
          </Button>
          <Button variant="danger" disabled={text.length < 3} loading={busy} onClick={() => onConfirm(text)}>
            {mode === "reject" ? "Rifiuta ordine" : "Annulla ordine"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-6 pb-4">
        <div className="flex flex-wrap gap-2">
          {REJECT_REASONS.map((r) => (
            <Chip key={r} selected={preset === r} onClick={() => setPreset(preset === r ? null : r)}>
              {r}
            </Chip>
          ))}
        </div>
        <Field label="Oppure scrivi il motivo">
          {(p) => (
            <Textarea
              {...p}
              rows={3}
              maxLength={300}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setPreset(null);
              }}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

const AVAILABILITY_LABEL: Record<AdminRiderDTO["availability"], string> = {
  AVAILABLE: "Libero",
  BUSY: "Occupato",
  OFFLINE: "Non in servizio",
};

/** Dispatch: free riders first; busy riders can still take a second order on the same route. */
export function RiderPicker({
  order,
  riders,
  busy,
  onClose,
  onAssign,
}: {
  order: KitchenOrderDTO | null;
  riders: AdminRiderDTO[];
  busy: boolean;
  onClose: () => void;
  onAssign: (riderId: string) => void;
}) {
  const sorted = riders
    .filter((r) => r.isActive)
    .toSorted(
      (a, b) =>
        ["AVAILABLE", "BUSY", "OFFLINE"].indexOf(a.availability) -
        ["AVAILABLE", "BUSY", "OFFLINE"].indexOf(b.availability),
    );
  return (
    <Dialog
      open={!!order}
      onOpenChange={(open) => !open && onClose()}
      title={order ? `Rider per #${order.number}` : ""}
      description={order?.addressLine ?? undefined}
      size="sm"
    >
      <ul className="space-y-2 px-6 pb-6">
        {sorted.length === 0 ? (
          <li className="py-6 text-center text-body-sm text-fg-muted">
            Nessun rider attivo. Aggiungili da “Rider”.
          </li>
        ) : null}
        {sorted.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              disabled={busy || r.id === order?.rider?.id}
              onClick={() => onAssign(r.id)}
              className="flex w-full tap items-center gap-3 rounded-xl bg-surface p-3.5 text-left ring-1 ring-line transition-colors hover:bg-surface-2 disabled:opacity-60"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2">
                <Bike className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{r.name}</span>
                <span className="flex items-center gap-1.5 text-caption text-fg-muted">
                  <CircleDot
                    className={cn(
                      "size-3",
                      r.availability === "AVAILABLE"
                        ? "text-success"
                        : r.availability === "BUSY"
                          ? "text-warning"
                          : "text-fg-subtle",
                    )}
                  />
                  {AVAILABILITY_LABEL[r.availability]}
                  {r.activeDeliveries.length
                    ? ` · ${r.activeDeliveries.map((d) => `#${d.number}`).join(", ")}`
                    : ""}
                </span>
              </span>
              {r.id === order?.rider?.id ? (
                <span className="text-caption font-semibold text-success">Assegnato</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
