"use client";

import { formatEuro } from "@dimsum/domain";
import type { AdminRiderDTO, GeoPoint } from "@dimsum/types";
import { riderInput } from "@dimsum/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bike, Mail, Pencil, Phone, Plus } from "lucide-react";
import { useState } from "react";
import { Map } from "@/components/maps/map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { firstErrors } from "@/lib/admin/forms";
import { useRealtime } from "@/lib/realtime";
import { AdminPage, Panel } from "../ui";

const key = ["admin", "riders"] as const;
const STATUS = {
  AVAILABLE: ["Libero", "success"],
  BUSY: ["In consegna", "warning"],
  OFFLINE: ["Fuori servizio", "neutral"],
} as const;

function minutesAgo(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  return m === 0 ? "adesso" : m === 1 ? "1 min fa" : `${m} min fa`;
}

function RiderEditor({
  rider,
  open,
  onClose,
}: {
  rider: AdminRiderDTO | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(rider?.name ?? "");
  const [email, setEmail] = useState(rider?.email ?? "");
  const [phone, setPhone] = useState(rider?.phone ?? "");
  const [vehicle, setVehicle] = useState(rider?.vehicle ?? "");
  const [active, setActive] = useState(rider?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: async () => {
      if (rider) {
        await api.admin.riders.update(rider.id, {
          displayName: name.trim(),
          phone: phone.trim() || null,
          vehicle: vehicle.trim() || null,
          isActive: active,
        });
        return { invited: false };
      }
      const input = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        vehicle: vehicle.trim() || null,
      };
      const parsed = riderInput.safeParse(input);
      if (!parsed.success) {
        setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
        throw new Error("validation");
      }
      return api.admin.riders.create(input);
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: key });
      toast.success(
        rider ? "Rider aggiornato" : "Rider creato",
        res.invited ? { description: "Gli abbiamo inviato l'e-mail per scegliere la password." } : undefined,
      );
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setErrors(firstErrors(e.fieldErrors));
        toast.error(e.message);
      }
    },
  });
  const invite = useMutation({
    mutationFn: () => api.admin.riders.resendInvite(rider!.id),
    onSuccess: () => toast.success("Invito inviato di nuovo"),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Invio non riuscito."),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={rider ? `Rider · ${rider.name}` : "Nuovo rider"}
      description={
        rider ? undefined : "Riceverà un'e-mail per scegliere la password e accedere all'app rider."
      }
      size="sm"
      footer={
        <div className="flex justify-between gap-2">
          {rider ? (
            <Button variant="ghost" loading={invite.isPending} onClick={() => invite.mutate()}>
              Reinvia invito
            </Button>
          ) : (
            <span />
          )}
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Salva
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-6 pb-4">
        <Field
          label={rider ? "Nome mostrato ai clienti" : "Nome e cognome"}
          error={errors.name ?? errors.displayName}
          hint={rider ? undefined : "Ai clienti mostriamo solo il nome."}
        >
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        {!rider ? (
          <Field label="E-mail" error={errors.email}>
            {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
        ) : null}
        <Field label="Telefono" optional error={errors.phone}>
          {(p) => (
            <Input
              {...p}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+39 …"
            />
          )}
        </Field>
        <Field label="Mezzo" optional>
          {(p) => (
            <Input
              {...p}
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="Scooter, bici elettrica…"
            />
          )}
        </Field>
        {rider ? (
          <label className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-body-sm">
            <span>
              <span className="block font-semibold">Account attivo</span>
              <span className="block text-caption text-fg-muted">
                Se disattivato non può più accedere all&apos;app.
              </span>
            </span>
            <Switch checked={active} onCheckedChange={setActive} />
          </label>
        ) : null}
      </div>
    </Dialog>
  );
}

export function RidersManager({
  initial,
  restaurant,
  canManage,
}: {
  initial: AdminRiderDTO[];
  restaurant: GeoPoint;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => api.admin.riders.list(),
    initialData: { riders: initial },
    initialDataUpdatedAt: 0,
    refetchInterval: 30_000,
  });
  const [editor, setEditor] = useState<{ rider: AdminRiderDTO | null; v: number } | null>(null);
  const [now] = useState(() => Date.now());
  useRealtime(["riders"], () => void qc.invalidateQueries({ queryKey: key }));
  const riders = data.riders;
  const live = riders.filter((r) => r.location && !r.location.stale);

  return (
    <AdminPage
      title="Rider"
      description={`${riders.filter((r) => r.availability !== "OFFLINE").length} in servizio · ${riders.filter((r) => r.availability === "BUSY").length} in consegna`}
      actions={
        canManage ? (
          <Button onClick={() => setEditor({ rider: null, v: Date.now() })}>
            <Plus className="size-4" /> Nuovo rider
          </Button>
        ) : null
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_480px]">
        <div className="space-y-3">
          {riders.length === 0 ? (
            <EmptyState
              icon={Bike}
              title="Nessun rider"
              description="Aggiungi i tuoi rider: riceveranno l'invito per l'app."
            />
          ) : null}
          {riders.map((r) => {
            const [label, tone] = STATUS[r.availability];
            return (
              <article key={r.id} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="grid size-11 place-items-center rounded-full bg-surface-2">
                    <Bike className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      {r.name}
                      <Badge tone={tone} size="md">
                        {label}
                      </Badge>
                      {!r.isActive ? (
                        <Badge tone="neutral" size="md">
                          Disattivato
                        </Badge>
                      ) : null}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-fg-muted">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="size-3.5" /> {r.email}
                      </span>
                      {r.phone ? (
                        <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 hover:text-fg">
                          <Phone className="size-3.5" /> {r.phone}
                        </a>
                      ) : null}
                      {r.vehicle ? <span>{r.vehicle}</span> : null}
                    </p>
                  </div>
                  {canManage ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Modifica ${r.name}`}
                      onClick={() => setEditor({ rider: r, v: Date.now() })}
                    >
                      <Pencil className="size-4.5" />
                    </Button>
                  ) : null}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-body-sm sm:grid-cols-4">
                  <div className="rounded-lg bg-surface-2 px-3 py-2">
                    <dt className="text-caption text-fg-muted">In corso</dt>
                    <dd className="font-semibold">
                      {r.activeDeliveries.length
                        ? r.activeDeliveries.map((d) => `#${d.number}`).join(", ")
                        : "—"}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-surface-2 px-3 py-2">
                    <dt className="text-caption text-fg-muted">Consegne oggi</dt>
                    <dd className="font-semibold tabular-nums">{r.deliveredToday}</dd>
                  </div>
                  <div className="rounded-lg bg-surface-2 px-3 py-2">
                    <dt className="text-caption text-fg-muted">Mance oggi</dt>
                    <dd className="font-semibold tabular-nums">{formatEuro(r.tipsTodayCents)}</dd>
                  </div>
                  <div className="rounded-lg bg-surface-2 px-3 py-2">
                    <dt className="text-caption text-fg-muted">Contanti da versare</dt>
                    <dd className="font-semibold tabular-nums">{formatEuro(r.cashToReturnCents)}</dd>
                  </div>
                </dl>
                {r.location ? (
                  <p className="mt-2 text-caption text-fg-subtle">
                    Posizione {r.location.stale ? "non aggiornata" : "aggiornata"} ·{" "}
                    {minutesAgo(r.location.at, now)}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
        <Panel
          title="Mappa"
          description="Solo i rider con una consegna in corso condividono la posizione."
          padded={false}
          className="xl:sticky xl:top-6 xl:self-start"
        >
          <div className="m-5 mt-4 h-96 overflow-hidden rounded-xl">
            <Map
              center={restaurant}
              zoom={14}
              ariaLabel="Posizione dei rider in consegna"
              markers={[
                { id: "restaurant", kind: "restaurant", position: restaurant },
                ...live.map((r) => ({
                  id: r.id,
                  kind: "rider" as const,
                  position: { lat: r.location!.lat, lng: r.location!.lng },
                  label: r.name,
                })),
              ]}
              fitTo={
                live.length
                  ? [restaurant, ...live.map((r) => ({ lat: r.location!.lat, lng: r.location!.lng }))]
                  : null
              }
            />
          </div>
        </Panel>
      </div>
      {editor ? (
        <RiderEditor key={editor.v} rider={editor.rider} open onClose={() => setEditor(null)} />
      ) : null}
    </AdminPage>
  );
}
