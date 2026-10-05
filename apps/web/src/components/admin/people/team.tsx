"use client";

import type { AdminStaffDTO, AuditEntryDTO, Paginated, Role } from "@dimsum/types";
import { staffInput } from "@dimsum/validation";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus, UserCog } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatOrderDate } from "@/lib/dates";
import { AdminPage } from "../ui";

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Titolare",
  ADMIN: "Amministratore",
  STAFF: "Staff",
  RIDER: "Rider",
  CUSTOMER: "Cliente",
};
const ROLE_HINT: Record<"STAFF" | "ADMIN", string> = {
  STAFF: "Cucina, ordini, disponibilità del menu, rider e assistenza.",
  ADMIN: "Tutto, tranne la gestione del team: menu, prezzi, zone, orari, coupon, statistiche, rimborsi.",
};

function NewMember({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"STAFF" | "ADMIN">("STAFF");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: () => {
      const parsed = staffInput.safeParse({ name, email, role });
      if (!parsed.success) {
        setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
        throw new Error("validation");
      }
      return api.admin.staff.create(parsed.data);
    },
    onSuccess: (data) => {
      qc.setQueryData(["admin", "staff"], data);
      toast.success("Invito inviato", {
        description: `${email} riceverà il link per scegliere la password.`,
      });
      onClose();
    },
    onError: (e) => e instanceof ApiError && toast.error(e.message),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Nuovo membro del team"
      size="sm"
      footer={
        <div className="flex justify-end">
          <Button loading={create.isPending} onClick={() => create.mutate()}>
            Invia invito
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-6 pb-4">
        <Field label="Nome e cognome" error={errors.name}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="E-mail di lavoro" error={errors.email}>
          {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Segmented
          ariaLabel="Ruolo"
          value={role}
          onChange={setRole}
          options={[
            { value: "STAFF", label: "Staff" },
            { value: "ADMIN", label: "Amministratore" },
          ]}
        />
        <p className="text-caption text-fg-muted">{ROLE_HINT[role]}</p>
      </div>
    </Dialog>
  );
}

export function TeamManager({
  initial,
  viewerId,
  timeZone,
}: {
  initial: AdminStaffDTO[];
  viewerId: string;
  timeZone: string;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: () => api.admin.staff.list(),
    initialData: { staff: initial },
    initialDataUpdatedAt: 0,
  });
  const [creating, setCreating] = useState(false);
  const update = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { role?: "STAFF" | "ADMIN" | "SUPER_ADMIN"; disabled?: boolean };
    }) => api.admin.staff.update(id, input),
    onSuccess: (d) => {
      qc.setQueryData(["admin", "staff"], d);
      toast.success("Account aggiornato");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Operazione non riuscita."),
  });
  return (
    <AdminPage
      title="Team"
      description="Chi accede al gestionale e con quali permessi. I rider si gestiscono da “Rider”."
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Invita
        </Button>
      }
    >
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        {data.staff.map((m) => (
          // Phones: who above, role and status below at full width. Desktop: one line.
          <li
            key={m.id}
            className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-x-4 sm:px-5"
          >
            <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-fg-muted">
              <UserCog className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                {m.name} {m.id === viewerId ? <Badge tone="neutral">Tu</Badge> : null}
                {m.disabled ? <Badge tone="warning">Disattivato</Badge> : null}
              </p>
              <p className="truncate text-body-sm text-fg-muted">{m.email}</p>
              <p className="text-caption text-fg-subtle">
                {m.lastSessionAt
                  ? `Ultimo accesso ${formatOrderDate(m.lastSessionAt, timeZone)}`
                  : "Non è mai entrato"}
              </p>
            </div>
            <div className="col-span-2 flex items-center gap-4 border-t border-line/70 pt-3 sm:col-span-1 sm:border-0 sm:pt-0">
              <select
                aria-label={`Ruolo di ${m.name}`}
                value={m.role}
                disabled={m.id === viewerId || update.isPending}
                onChange={(e) =>
                  update.mutate({
                    id: m.id,
                    input: { role: e.target.value as "STAFF" | "ADMIN" | "SUPER_ADMIN" },
                  })
                }
                className="h-10 min-w-0 flex-1 rounded-full bg-surface-2 px-3 text-body-sm font-semibold ring-1 ring-line sm:w-40 sm:flex-none"
              >
                {(["STAFF", "ADMIN", "SUPER_ADMIN"] as const).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <label className="flex shrink-0 items-center gap-2 text-body-sm whitespace-nowrap">
                Attivo
                <Switch
                  checked={!m.disabled}
                  disabled={m.id === viewerId || update.isPending}
                  onCheckedChange={(v) => update.mutate({ id: m.id, input: { disabled: !v } })}
                />
              </label>
            </div>
          </li>
        ))}
      </ul>
      {creating ? <NewMember open onClose={() => setCreating(false)} /> : null}
    </AdminPage>
  );
}

const ACTION_LABEL: Record<string, string> = {
  "order.confirm": "Ordine accettato",
  "order.reject": "Ordine rifiutato",
  "order.cancel": "Ordine annullato",
  "order.mark_ready": "Ordine pronto",
  "order.assign_rider": "Rider assegnato",
  "order.deliver": "Ordine consegnato",
  "order.refund": "Rimborso",
  "order.update_prep_time": "Tempo di preparazione cambiato",
  "product.available": "Prodotto disponibile",
  "product.sold_out": "Prodotto esaurito",
  "product.sold_out_until": "Esaurito fino a domani",
  "product.created": "Prodotto creato",
  "product.updated": "Prodotto modificato",
  "product.deleted": "Prodotto rimosso",
  "settings.updated": "Impostazioni modificate",
  "orders.paused": "Ordini bloccati",
  "orders.resumed": "Ordini riaperti",
  "hours.updated": "Orari modificati",
  "zone.created": "Zona creata",
  "zone.updated": "Zona modificata",
  "coupon.created": "Coupon creato",
  "coupon.updated": "Coupon modificato",
  "staff.created": "Membro del team invitato",
  "staff.updated": "Account del team modificato",
  "rider.created": "Rider creato",
  "account.deleted": "Account eliminato dal cliente",
};

export function AuditLog({ initial, timeZone }: { initial: Paginated<AuditEntryDTO>; timeZone: string }) {
  const list = useInfiniteQuery({
    queryKey: ["admin", "audit"],
    queryFn: ({ pageParam }) => api.admin.audit(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    initialData: { pages: [initial], pageParams: [null] },
    initialDataUpdatedAt: 0,
  });
  const [open, setOpen] = useState<string | null>(null);
  const rows = list.data.pages.flatMap((p) => p.items);
  return (
    <AdminPage
      title="Registro attività"
      description="Chi ha fatto cosa, con i valori prima e dopo. Non modificabile."
    >
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        {rows.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => setOpen(open === a.id ? null : a.id)}
              aria-expanded={open === a.id}
              // Phones: date and type on top, what happened below at full width. Desktop: one line.
              className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-surface-2 sm:flex-nowrap sm:px-5"
            >
              <span className="shrink-0 text-body-sm text-fg-muted tabular-nums sm:w-36">
                {formatOrderDate(a.createdAt, timeZone)}
              </span>
              <span className="order-last w-full min-w-0 text-body-sm sm:order-none sm:w-auto sm:flex-1">
                <span className="font-semibold">{ACTION_LABEL[a.action] ?? a.action}</span>
                <span className="text-fg-muted">
                  {" "}
                  · {a.actorName ?? "Sistema"}
                  {a.actorRole ? ` (${ROLE_LABEL[a.actorRole]})` : ""}
                </span>
              </span>
              <span className="ml-auto text-caption text-fg-subtle sm:ml-0">{a.entityType}</span>
              <ChevronDown
                className={cn("size-4 text-fg-subtle transition-transform", open === a.id && "rotate-180")}
              />
            </button>
            {open === a.id ? (
              <div className="grid gap-3 bg-surface-2 px-5 py-4 text-caption md:grid-cols-2">
                <div>
                  <p className="mb-1 font-semibold text-fg-muted">Prima</p>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-canvas p-3 whitespace-pre-wrap">
                    {a.before ? JSON.stringify(a.before, null, 2) : "—"}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 font-semibold text-fg-muted">Dopo</p>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-canvas p-3 whitespace-pre-wrap">
                    {a.after ? JSON.stringify(a.after, null, 2) : "—"}
                  </pre>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {list.hasNextPage ? (
        <Button
          variant="secondary"
          block
          className="mt-4"
          loading={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
        >
          Mostra altre attività
        </Button>
      ) : null}
    </AdminPage>
  );
}
