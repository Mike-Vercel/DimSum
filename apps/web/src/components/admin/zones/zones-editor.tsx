"use client";

import { formatEuro } from "@dimsum/domain";
import type { AdminZoneDTO, DeliveryZoneType, GeoPoint } from "@dimsum/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { Map } from "@/components/maps/map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { centsToInput, firstErrors, parseEuroToCents } from "@/lib/admin/forms";
import { cn } from "@/lib/cn";
import { AdminPage, ConfirmDialog, Panel } from "../ui";

const key = ["admin", "zones"] as const;
const COLORS = ["#1e9e5a", "#e8a317", "#d82a1e", "#2f6fdb", "#8b5cf6", "#0e0d0c"];
const TYPE_LABEL: Record<DeliveryZoneType, string> = {
  DISTANCE_BAND: "Fascia di distanza",
  CIRCLE: "Cerchio",
  POLYGON: "Area disegnata",
};

interface ZoneDraft {
  id: string | null;
  name: string;
  type: DeliveryZoneType;
  isActive: boolean;
  priority: string;
  fee: string;
  minimum: string;
  freeFrom: string;
  etaAdjustment: string;
  minKm: string;
  maxKm: string;
  radius: string;
  center: GeoPoint | null;
  polygon: GeoPoint[];
  color: string;
}

function draftOf(z: AdminZoneDTO | null, restaurant: GeoPoint, count: number): ZoneDraft {
  const km = (m: number | null) => (m === null ? "" : String(m / 1000).replace(".", ","));
  return {
    id: z?.id ?? null,
    name: z?.name ?? `Zona ${count + 1}`,
    type: z?.type ?? "DISTANCE_BAND",
    isActive: z?.isActive ?? true,
    priority: String(z?.priority ?? 10),
    fee: centsToInput(z?.deliveryFeeCents ?? 250),
    minimum: centsToInput(z?.minimumOrderCents ?? 1500),
    freeFrom: centsToInput(z?.freeDeliveryThresholdCents ?? null),
    etaAdjustment: String(z?.etaAdjustmentMinutes ?? 0),
    minKm: km(z?.minDistanceMeters ?? 0),
    maxKm: km(z?.maxDistanceMeters ?? 2000),
    radius: String(z?.radiusMeters ?? 1500),
    center: z?.center ?? restaurant,
    polygon: z?.polygon ?? [],
    color: z?.color ?? COLORS[count % COLORS.length]!,
  };
}

function toMeters(km: string): number | null {
  const v = km.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 1000) : null;
}

/** Geometry preview: bands and circles as rings around their centre, polygons as drawn. */
function preview(
  z: {
    type: DeliveryZoneType;
    center: GeoPoint | null;
    radiusMeters: number | null;
    maxDistanceMeters: number | null;
    minDistanceMeters: number | null;
    polygon: GeoPoint[] | null;
    color: string | null;
    id: string;
  },
  restaurant: GeoPoint,
  active: boolean,
) {
  const color = z.color ?? "#d82a1e";
  if (z.type === "POLYGON")
    return {
      polygons: (z.polygon?.length ?? 0) >= 3 ? [{ id: z.id, coordinates: z.polygon!, color, active }] : [],
      circles: [],
    };
  if (z.type === "CIRCLE")
    return {
      polygons: [],
      circles: z.radiusMeters
        ? [{ id: z.id, center: z.center ?? restaurant, radiusMeters: z.radiusMeters, color, active }]
        : [],
    };
  return {
    polygons: [],
    circles: z.maxDistanceMeters
      ? [{ id: z.id, center: restaurant, radiusMeters: z.maxDistanceMeters, color, active }]
      : [],
  };
}

export function ZonesEditor({ initial, restaurant }: { initial: AdminZoneDTO[]; restaurant: GeoPoint }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => api.admin.zones.list(),
    initialData: { zones: initial },
    initialDataUpdatedAt: 0,
  });
  const zones = data.zones;
  const [draft, setDraft] = useState<ZoneDraft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<AdminZoneDTO | null>(null);
  const set = <K extends keyof ZoneDraft>(k: K, v: ZoneDraft[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  const save = useMutation({
    mutationFn: (d: ZoneDraft) => {
      const input = {
        name: d.name.trim(),
        type: d.type,
        isActive: d.isActive,
        priority: Number.parseInt(d.priority, 10) || 10,
        deliveryFeeCents: parseEuroToCents(d.fee) ?? -1,
        minimumOrderCents: parseEuroToCents(d.minimum) ?? -1,
        freeDeliveryThresholdCents: d.freeFrom.trim() ? (parseEuroToCents(d.freeFrom) ?? -1) : null,
        etaAdjustmentMinutes: Number.parseInt(d.etaAdjustment, 10) || 0,
        polygon: d.type === "POLYGON" ? d.polygon : null,
        center: d.type === "CIRCLE" ? d.center : null,
        radiusMeters: d.type === "CIRCLE" ? Number.parseInt(d.radius, 10) || null : null,
        minDistanceMeters: d.type === "DISTANCE_BAND" ? (toMeters(d.minKm) ?? 0) : null,
        maxDistanceMeters: d.type === "DISTANCE_BAND" ? toMeters(d.maxKm) : null,
        color: d.color,
      };
      return d.id ? api.admin.zones.update(d.id, input) : api.admin.zones.create(input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      toast.success("Zona salvata", { description: "I nuovi preventivi usano già questa configurazione." });
      setDraft(null);
      setErrors({});
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(firstErrors(e.fieldErrors));
      toast.error(e instanceof ApiError ? e.message : "Salvataggio non riuscito.");
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.admin.zones.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      setDeleting(null);
      toast("Zona eliminata");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Eliminazione non riuscita."),
  });

  const shown = zones.filter((z) => z.id !== draft?.id).map((z) => preview(z, restaurant, false));
  const editing = draft
    ? preview(
        {
          id: "draft",
          type: draft.type,
          center: draft.center,
          radiusMeters: Number.parseInt(draft.radius, 10) || null,
          maxDistanceMeters: toMeters(draft.maxKm),
          minDistanceMeters: toMeters(draft.minKm),
          polygon: draft.polygon,
          color: draft.color,
        },
        restaurant,
        true,
      )
    : { polygons: [], circles: [] };

  return (
    <AdminPage
      title="Zone di consegna"
      description="Costo, minimo d'ordine e soglia di consegna gratuita per zona. Vince la zona con priorità più alta (numero più basso)."
      actions={
        draft ? null : (
          <Button onClick={() => setDraft(draftOf(null, restaurant, zones.length))}>
            <Plus className="size-4" /> Nuova zona
          </Button>
        )
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Panel padded={false} className="overflow-hidden">
          <div className="h-[560px]">
            <Map
              center={restaurant}
              zoom={13}
              ariaLabel="Mappa delle zone di consegna"
              markers={[
                { id: "restaurant", kind: "restaurant", position: restaurant },
                ...(draft?.type === "CIRCLE" && draft.center
                  ? [{ id: "center", kind: "destination" as const, position: draft.center }]
                  : []),
              ]}
              polygons={[...shown.flatMap((p) => p.polygons), ...editing.polygons]}
              circles={[...shown.flatMap((p) => p.circles), ...editing.circles]}
              onMapClick={
                draft?.type === "POLYGON"
                  ? (point) => set("polygon", [...draft.polygon, point])
                  : draft?.type === "CIRCLE"
                    ? (point) => set("center", point)
                    : undefined
              }
            />
          </div>
          {draft?.type === "POLYGON" ? (
            <p className="flex items-center gap-2 border-t border-line px-5 py-3 text-body-sm text-fg-muted">
              <MapPin className="size-4" /> Clicca sulla mappa per aggiungere i vertici dell&apos;area (
              {draft.polygon.length} punti).
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                disabled={!draft.polygon.length}
                onClick={() => set("polygon", draft.polygon.slice(0, -1))}
              >
                <Undo2 className="size-4" /> Annulla ultimo
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!draft.polygon.length}
                onClick={() => set("polygon", [])}
              >
                Ricomincia
              </Button>
            </p>
          ) : draft?.type === "CIRCLE" ? (
            <p className="border-t border-line px-5 py-3 text-body-sm text-fg-muted">
              Clicca sulla mappa per spostare il centro del cerchio.
            </p>
          ) : (
            <p className="border-t border-line px-5 py-3 text-caption text-fg-subtle">
              Le fasce di distanza usano i km su strada: i cerchi sulla mappa sono indicativi.
            </p>
          )}
        </Panel>

        {draft ? (
          <Panel title={draft.id ? "Modifica zona" : "Nuova zona"}>
            <div className="space-y-4">
              <Field label="Nome" error={errors.name}>
                {(p) => <Input {...p} value={draft.name} onChange={(e) => set("name", e.target.value)} />}
              </Field>
              <Segmented
                ariaLabel="Tipo di zona"
                size="sm"
                value={draft.type}
                onChange={(t) => set("type", t)}
                options={(Object.keys(TYPE_LABEL) as DeliveryZoneType[]).map((t) => ({
                  value: t,
                  label: TYPE_LABEL[t],
                }))}
              />
              {draft.type === "DISTANCE_BAND" ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Da (km)">
                    {(p) => (
                      <Input
                        {...p}
                        inputMode="decimal"
                        value={draft.minKm}
                        onChange={(e) => set("minKm", e.target.value)}
                      />
                    )}
                  </Field>
                  <Field label="A (km)" error={errors.maxDistanceMeters}>
                    {(p) => (
                      <Input
                        {...p}
                        inputMode="decimal"
                        value={draft.maxKm}
                        onChange={(e) => set("maxKm", e.target.value)}
                      />
                    )}
                  </Field>
                </div>
              ) : null}
              {draft.type === "CIRCLE" ? (
                <Field label="Raggio (metri)" error={errors.radiusMeters}>
                  {(p) => (
                    <Input
                      {...p}
                      inputMode="numeric"
                      value={draft.radius}
                      onChange={(e) => set("radius", e.target.value)}
                    />
                  )}
                </Field>
              ) : null}
              {draft.type === "POLYGON" && errors.polygon ? (
                <p className="text-caption text-danger">{errors.polygon}</p>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Costo consegna (€)" error={errors.deliveryFeeCents}>
                  {(p) => (
                    <Input
                      {...p}
                      inputMode="decimal"
                      value={draft.fee}
                      onChange={(e) => set("fee", e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Ordine minimo (€)" error={errors.minimumOrderCents}>
                  {(p) => (
                    <Input
                      {...p}
                      inputMode="decimal"
                      value={draft.minimum}
                      onChange={(e) => set("minimum", e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Gratis da (€)" optional error={errors.freeDeliveryThresholdCents}>
                  {(p) => (
                    <Input
                      {...p}
                      inputMode="decimal"
                      value={draft.freeFrom}
                      onChange={(e) => set("freeFrom", e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Minuti in più" hint="Aggiunti alla stima di consegna.">
                  {(p) => (
                    <Input
                      {...p}
                      inputMode="numeric"
                      value={draft.etaAdjustment}
                      onChange={(e) => set("etaAdjustment", e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Priorità" hint="1 = valutata per prima.">
                  {(p) => (
                    <Input
                      {...p}
                      inputMode="numeric"
                      value={draft.priority}
                      onChange={(e) => set("priority", e.target.value)}
                    />
                  )}
                </Field>
              </div>
              <div className="flex items-center gap-2" role="radiogroup" aria-label="Colore">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={draft.color === c}
                    aria-label={c}
                    onClick={() => set("color", c)}
                    className={cn(
                      "size-8 rounded-full ring-offset-2 ring-offset-surface",
                      draft.color === c && "ring-2 ring-fg",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <label className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-body-sm font-medium">
                Zona attiva <Switch checked={draft.isActive} onCheckedChange={(v) => set("isActive", v)} />
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDraft(null);
                    setErrors({});
                  }}
                >
                  Annulla
                </Button>
                <Button loading={save.isPending} onClick={() => save.mutate(draft)}>
                  Salva zona
                </Button>
              </div>
            </div>
          </Panel>
        ) : (
          <div className="space-y-3">
            {zones.map((z) => (
              <article key={z.id} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 size-3.5 shrink-0 rounded-full"
                    style={{ backgroundColor: z.color ?? "#d82a1e" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      {z.name}
                      {!z.isActive ? <Badge tone="neutral">Disattivata</Badge> : null}
                    </p>
                    <p className="text-body-sm text-fg-muted">
                      {TYPE_LABEL[z.type]}
                      {z.type === "DISTANCE_BAND" && z.maxDistanceMeters
                        ? ` · ${((z.minDistanceMeters ?? 0) / 1000).toLocaleString("it-IT")}–${(z.maxDistanceMeters / 1000).toLocaleString("it-IT")} km`
                        : ""}
                      {z.type === "CIRCLE" && z.radiusMeters ? ` · raggio ${z.radiusMeters} m` : ""}
                    </p>
                    <p className="mt-1 text-body-sm">
                      Consegna{" "}
                      <strong>{z.deliveryFeeCents ? formatEuro(z.deliveryFeeCents) : "gratis"}</strong> ·
                      minimo <strong>{formatEuro(z.minimumOrderCents)}</strong>
                      {z.freeDeliveryThresholdCents ? (
                        <>
                          {" "}
                          · gratis da <strong>{formatEuro(z.freeDeliveryThresholdCents)}</strong>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Modifica ${z.name}`}
                    onClick={() => setDraft(draftOf(z, restaurant, zones.length))}
                  >
                    <Pencil className="size-4.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Elimina ${z.name}`}
                    onClick={() => setDeleting(z)}
                  >
                    <Trash2 className="size-4.5" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Eliminare ${deleting?.name ?? "la zona"}?`}
        description="Gli indirizzi coperti solo da questa zona non potranno più ricevere consegne."
        confirmLabel="Elimina zona"
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </AdminPage>
  );
}
