"use client";

import type { AdminLoyaltyResponse } from "@dimsum/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { InlineAlert } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { centsToInput, firstErrors, parseEuroToCents } from "@/lib/admin/forms";
import { AdminPage, Panel } from "../ui";

const key = ["admin", "loyalty"] as const;
type Reward = AdminLoyaltyResponse["rewards"][number];
type RewardType = "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_DELIVERY";

function RewardEditor({
  reward,
  open,
  onClose,
}: {
  reward: Reward | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(reward?.name ?? "");
  const [description, setDescription] = useState(reward?.description ?? "");
  const [points, setPoints] = useState(String(reward?.pointsCost ?? 100));
  const [type, setType] = useState<RewardType>(
    (reward?.couponType as RewardType | undefined) ?? "FIXED_AMOUNT",
  );
  const [percent, setPercent] = useState(reward?.percentBps ? String(reward.percentBps / 100) : "10");
  const [amount, setAmount] = useState(centsToInput(reward?.amountCents ?? 500));
  const [days, setDays] = useState(String(reward?.validDays ?? 30));
  const [active, setActive] = useState(reward?.isActive ?? true);
  const save = useMutation({
    mutationFn: () => {
      const input = {
        name: name.trim(),
        description: description.trim() || null,
        pointsCost: Number.parseInt(points, 10),
        couponType: type,
        percentBps: type === "PERCENTAGE" ? Math.round(Number(percent.replace(",", ".")) * 100) : null,
        amountCents: type === "FIXED_AMOUNT" ? parseEuroToCents(amount) : null,
        validDays: Number.parseInt(days, 10),
        isActive: active,
      };
      return reward
        ? api.admin.loyalty.updateReward(reward.id, input)
        : api.admin.loyalty.createReward(input);
    },
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      toast.success("Premio salvato");
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Salvataggio non riuscito."),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={reward ? `Premio · ${reward.name}` : "Nuovo premio"}
      size="md"
      footer={
        <div className="flex justify-end">
          <Button loading={save.isPending} disabled={name.trim().length < 2} onClick={() => save.mutate()}>
            Salva
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-6 pb-4">
        <Field label="Nome">
          {(p) => (
            <Input
              {...p}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Es. 5€ di sconto"
            />
          )}
        </Field>
        <Field label="Descrizione" optional>
          {(p) => (
            <Textarea {...p} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          )}
        </Field>
        <Segmented
          ariaLabel="Tipo di premio"
          value={type}
          onChange={setType}
          options={[
            { value: "FIXED_AMOUNT", label: "Euro" },
            { value: "PERCENTAGE", label: "Percentuale" },
            { value: "FREE_DELIVERY", label: "Consegna gratis" },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Costo in punti">
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                value={points}
                onChange={(e) => setPoints(e.target.value.replace(/\D/g, ""))}
              />
            )}
          </Field>
          {type === "FIXED_AMOUNT" ? (
            <Field label="Valore (€)">
              {(p) => (
                <Input
                  {...p}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              )}
            </Field>
          ) : null}
          {type === "PERCENTAGE" ? (
            <Field label="Sconto (%)">
              {(p) => (
                <Input
                  {...p}
                  inputMode="decimal"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                />
              )}
            </Field>
          ) : null}
          <Field label="Valido (giorni)">
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                value={days}
                onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
              />
            )}
          </Field>
        </div>
        <label className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-body-sm font-medium">
          Disponibile nel catalogo premi <Switch checked={active} onCheckedChange={setActive} />
        </label>
      </div>
    </Dialog>
  );
}

export function ClubManager({ initial }: { initial: AdminLoyaltyResponse }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => api.admin.loyalty.get(),
    initialData: initial,
    initialDataUpdatedAt: 0,
  });
  const c = data.config;
  const [enabled, setEnabled] = useState(c.enabled);
  const [programName, setProgramName] = useState(c.programName);
  const [perEuro, setPerEuro] = useState(String(c.pointsPerEuro));
  const [expiry, setExpiry] = useState(c.expiryMonths ? String(c.expiryMonths) : "");
  const [birthday, setBirthday] = useState(String(c.birthdayBonusPoints));
  const [signup, setSignup] = useState(String(c.signupBonusPoints));
  const [tiers, setTiers] = useState(
    c.tiers.map((t) => ({
      ...t,
      min: String(t.minLifetimePoints),
      mult: String(t.multiplierBps / 10_000).replace(".", ","),
    })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<{ reward: Reward | null; v: number } | null>(null);
  const [adjust, setAdjust] = useState({ email: "", points: "", description: "" });

  const save = useMutation({
    mutationFn: () =>
      api.admin.loyalty.update({
        enabled,
        programName: programName.trim(),
        pointsPerEuro: Number.parseInt(perEuro, 10),
        expiryMonths: expiry.trim() ? Number.parseInt(expiry, 10) : null,
        birthdayBonusPoints: Number.parseInt(birthday, 10) || 0,
        signupBonusPoints: Number.parseInt(signup, 10) || 0,
        tiers: tiers.map((t) => ({
          key: t.key,
          name: t.name.trim(),
          minLifetimePoints: Number.parseInt(t.min, 10) || 0,
          multiplierBps: Math.round(Number(t.mult.replace(",", ".")) * 10_000),
        })),
      }),
    onSuccess: (d) => {
      qc.setQueryData(key, d);
      setErrors({});
      toast.success(enabled ? "Club aggiornato" : "Impostazioni salvate (Club non ancora attivo)");
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(firstErrors(e.fieldErrors));
      toast.error(e instanceof ApiError ? e.message : "Salvataggio non riuscito.");
    },
  });
  const adjustMutation = useMutation({
    mutationFn: async () => {
      const found = await api.admin.customers.list(adjust.email.trim());
      const customer = found.items.find((x) => x.email.toLowerCase() === adjust.email.trim().toLowerCase());
      if (!customer)
        throw new ApiError(404, { code: "NOT_FOUND", message: "Nessun cliente con questa e-mail." });
      return api.admin.loyalty.adjust({
        userId: customer.id,
        points: Number.parseInt(adjust.points, 10),
        description: adjust.description.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Punti aggiornati");
      setAdjust({ email: "", points: "", description: "" });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Operazione non riuscita."),
  });

  return (
    <AdminPage
      title="Dimsum Club"
      description={`${data.members} clienti con punti`}
      actions={
        <Button loading={save.isPending} onClick={() => save.mutate()}>
          Salva
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Programma">
          <div className="space-y-4">
            {!enabled ? (
              <InlineAlert tone="info" title="Il Club è spento">
                I clienti non vedono punti né premi finché non lo attivi. Puoi prepararlo con calma.
              </InlineAlert>
            ) : null}
            <label className="flex items-center justify-between gap-4 rounded-xl bg-surface-2 px-4 py-3">
              <span className="text-body-sm">
                <span className="block font-semibold">Club attivo</span>
                <span className="block text-caption text-fg-muted">
                  Punti sugli ordini consegnati agli account registrati.
                </span>
              </span>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome del programma" error={errors.programName}>
                {(p) => <Input {...p} value={programName} onChange={(e) => setProgramName(e.target.value)} />}
              </Field>
              <Field label="Punti per ogni euro" hint="Sui prodotti, sconti esclusi.">
                {(p) => (
                  <Input
                    {...p}
                    inputMode="numeric"
                    value={perEuro}
                    onChange={(e) => setPerEuro(e.target.value.replace(/\D/g, ""))}
                  />
                )}
              </Field>
              <Field label="Scadenza punti (mesi di inattività)" optional>
                {(p) => (
                  <Input
                    {...p}
                    inputMode="numeric"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value.replace(/\D/g, ""))}
                    placeholder="Mai"
                  />
                )}
              </Field>
              <Field label="Bonus di benvenuto (punti)" hint="Dopo la conferma dell'e-mail.">
                {(p) => (
                  <Input
                    {...p}
                    inputMode="numeric"
                    value={signup}
                    onChange={(e) => setSignup(e.target.value.replace(/\D/g, ""))}
                  />
                )}
              </Field>
              <Field label="Bonus compleanno (punti)" hint="Se 0, la data di nascita non viene chiesta.">
                {(p) => (
                  <Input
                    {...p}
                    inputMode="numeric"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value.replace(/\D/g, ""))}
                  />
                )}
              </Field>
            </div>
          </div>
        </Panel>

        <Panel
          title="Livelli"
          description="Moltiplicano i punti guadagnati in base ai punti accumulati in totale."
        >
          <div className="space-y-2">
            {tiers.map((t, i) => (
              <div key={t.key} className="grid grid-cols-[1fr_120px_100px_auto] items-end gap-2">
                <Field label={i === 0 ? "Nome" : ""}>
                  {(p) => (
                    <Input
                      {...p}
                      aria-label="Nome livello"
                      value={t.name}
                      onChange={(e) =>
                        setTiers((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                      }
                    />
                  )}
                </Field>
                <Field label={i === 0 ? "Da punti" : ""}>
                  {(p) => (
                    <Input
                      {...p}
                      aria-label="Punti minimi"
                      inputMode="numeric"
                      value={t.min}
                      onChange={(e) =>
                        setTiers((l) =>
                          l.map((x, j) => (j === i ? { ...x, min: e.target.value.replace(/\D/g, "") } : x)),
                        )
                      }
                    />
                  )}
                </Field>
                <Field label={i === 0 ? "Moltiplicatore" : ""}>
                  {(p) => (
                    <Input
                      {...p}
                      aria-label="Moltiplicatore"
                      inputMode="decimal"
                      value={t.mult}
                      onChange={(e) =>
                        setTiers((l) => l.map((x, j) => (j === i ? { ...x, mult: e.target.value } : x)))
                      }
                    />
                  )}
                </Field>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Rimuovi livello"
                  onClick={() => setTiers((l) => l.filter((_, j) => j !== i))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="secondary"
              disabled={tiers.length >= 6}
              onClick={() =>
                setTiers((l) => [
                  ...l,
                  {
                    key: `livello-${l.length + 1}`,
                    name: "",
                    minLifetimePoints: 0,
                    multiplierBps: 10_000,
                    min: "0",
                    mult: "1",
                  },
                ])
              }
            >
              <Plus className="size-4" /> Aggiungi livello
            </Button>
          </div>
        </Panel>

        <Panel
          title="Premi"
          actions={
            <Button size="sm" onClick={() => setEditor({ reward: null, v: Date.now() })}>
              <Plus className="size-4" /> Premio
            </Button>
          }
        >
          {data.rewards.length === 0 ? (
            <p className="text-body-sm text-fg-muted">
              Nessun premio: aggiungine uno per dare valore ai punti.
            </p>
          ) : null}
          <ul className="space-y-2">
            {data.rewards.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
                <Sparkles className="size-4.5 text-red-500" />
                <span className="flex-1 text-body-sm">
                  <span className="block font-semibold">{r.name}</span>
                  <span className="block text-fg-muted">
                    {r.pointsCost} punti · valido {r.validDays} giorni
                  </span>
                </span>
                {!r.isActive ? <Badge tone="neutral">Nascosto</Badge> : null}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Modifica ${r.name}`}
                  onClick={() => setEditor({ reward: r, v: Date.now() })}
                >
                  <Pencil className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Correggi i punti di un cliente"
          description="Gesto di cortesia o correzione: resta nello storico del cliente."
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <Field label="E-mail del cliente">
              {(p) => (
                <Input
                  {...p}
                  type="email"
                  value={adjust.email}
                  onChange={(e) => setAdjust((a) => ({ ...a, email: e.target.value }))}
                />
              )}
            </Field>
            <Field label="Punti (±)">
              {(p) => (
                <Input
                  {...p}
                  inputMode="numeric"
                  value={adjust.points}
                  onChange={(e) =>
                    setAdjust((a) => ({ ...a, points: e.target.value.replace(/[^\d-]/g, "") }))
                  }
                  placeholder="50"
                />
              )}
            </Field>
            <Field label="Motivo" className="sm:col-span-2">
              {(p) => (
                <Input
                  {...p}
                  value={adjust.description}
                  onChange={(e) => setAdjust((a) => ({ ...a, description: e.target.value }))}
                  placeholder="Es. Scuse per il ritardo del 12/10"
                />
              )}
            </Field>
          </div>
          <Button
            className="mt-4"
            variant="secondary"
            loading={adjustMutation.isPending}
            disabled={
              !adjust.email || !Number.parseInt(adjust.points, 10) || adjust.description.trim().length < 3
            }
            onClick={() => adjustMutation.mutate()}
          >
            Aggiorna punti
          </Button>
        </Panel>
      </div>
      {editor ? (
        <RewardEditor key={editor.v} reward={editor.reward} open onClose={() => setEditor(null)} />
      ) : null}
    </AdminPage>
  );
}
