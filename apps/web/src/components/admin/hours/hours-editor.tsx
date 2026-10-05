"use client";

import { TZDate } from "@date-fns/tz";
import type { AdminHoursDTO, FulfillmentType, ServiceStatusDTO } from "@dimsum/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Copy, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { PauseControl } from "../pause-control";
import { AdminPage, Panel } from "../ui";

type Kind = "VENUE" | "DELIVERY" | "PICKUP";
type Range = { weekday: number; opensAt: string; closesAt: string };
const DAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const KIND_LABEL: Record<Kind, string> = { VENUE: "Locale", DELIVERY: "Consegna", PICKUP: "Ritiro" };
const key = ["admin", "hours"] as const;

function WeekEditor({ kind, initial, timezone }: { kind: Kind; initial: Range[]; timezone: string }) {
  const qc = useQueryClient();
  const [ranges, setRanges] = useState<Range[]>(initial);
  const dirty = JSON.stringify(ranges) !== JSON.stringify(initial);
  const save = useMutation({
    mutationFn: () => api.admin.hours.replace({ kind, ranges }),
    onSuccess: (h) => {
      qc.setQueryData(key, h);
      toast.success(`Orari ${KIND_LABEL[kind].toLowerCase()} salvati`);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Salvataggio non riuscito."),
  });
  const update = (index: number, patch: Partial<Range>) =>
    setRanges((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const copyMonday = () => {
    const monday = ranges.filter((r) => r.weekday === 1);
    setRanges([1, 2, 3, 4, 5, 6, 7].flatMap((weekday) => monday.map((r) => ({ ...r, weekday }))));
  };
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-line">
        {DAYS.map((day, i) => {
          const weekday = i + 1;
          const dayRanges = ranges.map((r, index) => ({ r, index })).filter(({ r }) => r.weekday === weekday);
          return (
            <li key={day} className="flex flex-wrap items-center gap-3 py-3">
              <span className="w-28 font-semibold">{day}</span>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {dayRanges.length === 0 ? <span className="text-body-sm text-fg-muted">Chiuso</span> : null}
                {dayRanges.map(({ r, index }) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 py-1 pr-1 pl-2"
                  >
                    <input
                      type="time"
                      aria-label={`${day} apertura`}
                      value={r.opensAt}
                      onChange={(e) => update(index, { opensAt: e.target.value })}
                      className="rounded-md bg-transparent px-1 py-1 tabular-nums"
                    />
                    –
                    <input
                      type="time"
                      aria-label={`${day} chiusura`}
                      value={r.closesAt}
                      onChange={(e) => update(index, { closesAt: e.target.value })}
                      className="rounded-md bg-transparent px-1 py-1 tabular-nums"
                    />
                    <button
                      type="button"
                      aria-label="Rimuovi fascia"
                      onClick={() => setRanges((rs) => rs.filter((_, j) => j !== index))}
                      className="grid size-7 place-items-center rounded-full hover:bg-surface-3"
                    >
                      <X className="size-4" />
                    </button>
                  </span>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setRanges((rs) => [
                      ...rs,
                      {
                        weekday,
                        opensAt: dayRanges.length ? "18:30" : "11:30",
                        closesAt: dayRanges.length ? "22:30" : "14:30",
                      },
                    ])
                  }
                >
                  <Plus className="size-4" /> Fascia
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-caption text-fg-subtle">
        Orari nel fuso {timezone}. Una fascia che finisce dopo mezzanotte (es. 19:00–01:00) vale fino al
        giorno dopo.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={copyMonday}>
          <Copy className="size-4" /> Copia il lunedì su tutti i giorni
        </Button>
        <Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
          Salva orari
        </Button>
      </div>
    </div>
  );
}

function Closures({ hours }: { hours: AdminHoursDTO }) {
  const qc = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [applies, setApplies] = useState<FulfillmentType[]>([]);
  const toIso = (local: string) => {
    const [d, t] = local.split("T");
    const [y, m, day] = (d ?? "").split("-").map(Number);
    const [h, min] = (t ?? "00:00").split(":").map(Number);
    return new TZDate(y!, m! - 1, day!, h!, min!, hours.timezone).toISOString();
  };
  const add = useMutation({
    mutationFn: () =>
      api.admin.hours.addClosure({
        startsAt: toIso(from),
        endsAt: toIso(to),
        reason: reason.trim() || null,
        appliesTo: applies,
        isHoliday: false,
      }),
    onSuccess: (h) => {
      qc.setQueryData(key, h);
      setFrom("");
      setTo("");
      setReason("");
      toast.success("Chiusura aggiunta");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Salvataggio non riuscito."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.admin.hours.removeClosure(id),
    onSuccess: (h) => qc.setQueryData(key, h),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Eliminazione non riuscita."),
  });
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("it-IT", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: hours.timezone,
    }).format(new Date(iso));
  return (
    <div className="space-y-5">
      {hours.closures.length === 0 ? (
        <p className="text-body-sm text-fg-muted">Nessuna chiusura programmata.</p>
      ) : null}
      <ul className="space-y-2">
        {hours.closures.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3 text-body-sm">
            <CalendarOff className="size-4.5 text-fg-muted" />
            <span className="flex-1">
              <span className="font-semibold">
                {fmt(c.startsAt)} → {fmt(c.endsAt)}
              </span>
              <span className="block text-fg-muted">
                {c.reason ?? "Chiusura"} ·{" "}
                {c.appliesTo.length === 1
                  ? c.appliesTo[0] === "DELIVERY"
                    ? "solo consegne"
                    : "solo ritiro"
                  : "consegna e ritiro"}
              </span>
            </span>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Elimina chiusura"
              loading={remove.isPending && remove.variables === c.id}
              onClick={() => remove.mutate(c.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 rounded-2xl p-4 ring-1 ring-line sm:grid-cols-2">
        <Field label="Dal">
          {(p) => (
            <Input {...p} type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          )}
        </Field>
        <Field label="Al">
          {(p) => <Input {...p} type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />}
        </Field>
        <Field label="Motivo (visibile ai clienti)" optional className="sm:col-span-2">
          {(p) => (
            <Input
              {...p}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Es. Chiusura per ferie"
              maxLength={140}
            />
          )}
        </Field>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <span className="text-body-sm text-fg-muted">Vale per:</span>
          <Chip selected={applies.length === 0} onClick={() => setApplies([])}>
            Tutto
          </Chip>
          <Chip
            selected={applies.length === 1 && applies[0] === "DELIVERY"}
            onClick={() => setApplies(["DELIVERY"])}
          >
            Solo consegne
          </Chip>
          <Chip
            selected={applies.length === 1 && applies[0] === "PICKUP"}
            onClick={() => setApplies(["PICKUP"])}
          >
            Solo ritiro
          </Chip>
        </div>
        <div className="sm:col-span-2">
          <Button disabled={!from || !to} loading={add.isPending} onClick={() => add.mutate()}>
            <Plus className="size-4" /> Aggiungi chiusura
          </Button>
        </div>
      </div>
    </div>
  );
}

export function HoursEditor({ initial, status }: { initial: AdminHoursDTO; status: ServiceStatusDTO }) {
  const { data: hours } = useQuery({
    queryKey: key,
    queryFn: () => api.admin.hours.get(),
    initialData: initial,
    initialDataUpdatedAt: 0,
  });
  const [kind, setKind] = useState<Kind>("DELIVERY");
  const ranges = kind === "VENUE" ? hours.venue : kind === "DELIVERY" ? hours.delivery : hours.pickup;
  return (
    <AdminPage
      title="Orari e chiusure"
      description="Gli orari di consegna e ritiro decidono quando si può ordinare online."
      actions={<PauseControl status={status} />}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Panel title="Orari settimanali">
          <Segmented
            ariaLabel="Tipo di orario"
            value={kind}
            onChange={setKind}
            options={(["DELIVERY", "PICKUP", "VENUE"] as Kind[]).map((k) => ({
              value: k,
              label: KIND_LABEL[k],
            }))}
            className="mb-4 max-w-md"
          />
          <WeekEditor
            key={kind + JSON.stringify(ranges)}
            kind={kind}
            initial={ranges}
            timezone={hours.timezone}
          />
        </Panel>
        <Panel
          title="Chiusure straordinarie"
          description="Ferie, festività o imprevisti: gli ordini online si fermano automaticamente."
        >
          <Closures hours={hours} />
        </Panel>
      </div>
    </AdminPage>
  );
}
