"use client";

import type { ServiceStatusDTO } from "@dimsum/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pause, Play } from "lucide-react";
import { useState } from "react";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/cn";

const DURATIONS = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 ora" },
  { minutes: null, label: "Fino a riapertura" },
] as const;

/** Service state pill + "Blocca ordini" / "Riapri": stops new orders, orders in progress continue. */
export function PauseControl({ status, className }: { status: ServiceStatusDTO; className?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(30);
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: (input: { paused: boolean; minutes: number | null; reason: string | null }) =>
      api.admin.pause(input),
    onSuccess: (_d, input) => {
      toast.success(input.paused ? "Ordini bloccati" : "Ordini riaperti");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Operazione non riuscita."),
  });

  const label = status.isPaused ? "Ordini in pausa" : status.acceptingOrders ? "Ordini aperti" : "Chiuso";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-body-sm font-semibold",
          status.isPaused
            ? "bg-warning-soft text-warning"
            : status.acceptingOrders
              ? "bg-success-soft text-success"
              : "bg-surface-3 text-fg-muted",
        )}
        role="status"
      >
        <span className={cn("size-2 rounded-full bg-current", status.acceptingOrders && "animate-pulse")} />
        {label}
      </span>
      {status.isPaused ? (
        <Button
          size="sm"
          variant="secondary"
          loading={mutation.isPending}
          onClick={() => mutation.mutate({ paused: false, minutes: null, reason: null })}
        >
          <Play className="size-4" /> Riapri
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <Pause className="size-4" /> Blocca ordini
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Bloccare i nuovi ordini?"
        description="Il sito mostra che al momento non accettiamo ordini. Quelli già ricevuti proseguono normalmente."
        size="sm"
        footer={
          <Button
            block
            size="lg"
            variant="danger"
            loading={mutation.isPending}
            onClick={() => mutation.mutate({ paused: true, minutes, reason: reason.trim() || null })}
          >
            Blocca ordini
          </Button>
        }
      >
        <div className="space-y-5 px-6 pb-4">
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <Chip key={d.label} selected={minutes === d.minutes} onClick={() => setMinutes(d.minutes)}>
                {d.label}
              </Chip>
            ))}
          </div>
          <Field label="Messaggio per i clienti" optional hint="Es. Cucina al completo, riapriamo tra poco.">
            {(p) => (
              <Input {...p} maxLength={140} value={reason} onChange={(e) => setReason(e.target.value)} />
            )}
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
