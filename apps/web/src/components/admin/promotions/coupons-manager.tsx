"use client";

import { TZDate } from "@date-fns/tz";
import { formatEuro } from "@dimsum/domain";
import type { AdminCatalogDTO, AdminCouponDTO, CouponType, FulfillmentType } from "@dimsum/types";
import type { CouponInput } from "@dimsum/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, TicketPercent } from "lucide-react";
import { useState } from "react";
import { Badge, Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { centsToInput, firstErrors, parseEuroToCents } from "@/lib/admin/forms";
import { formatOrderDate } from "@/lib/dates";
import { AdminPage, ConfirmDialog } from "../ui";

const key = ["admin", "coupons"] as const;

function toLocalInput(iso: string | null, tz: string): string {
  if (!iso) return "";
  const d = new TZDate(new Date(iso).getTime(), tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string, tz: string): string | null {
  if (!value) return null;
  const [d, t] = value.split("T");
  const [y, m, day] = (d ?? "").split("-").map(Number);
  const [h, min] = (t ?? "00:00").split(":").map(Number);
  return new TZDate(y!, m! - 1, day!, h!, min!, tz).toISOString();
}

function CouponEditor({
  coupon,
  categories,
  timeZone,
  open,
  onClose,
}: {
  coupon: AdminCouponDTO | null;
  categories: AdminCatalogDTO["categories"];
  timeZone: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<CouponType>(coupon?.type ?? "PERCENTAGE");
  const [name, setName] = useState(coupon?.name ?? "");
  const [description, setDescription] = useState(coupon?.description ?? "");
  const [auto, setAuto] = useState(coupon?.autoApply ?? false);
  const [code, setCode] = useState(coupon?.code ?? "");
  const [percent, setPercent] = useState(coupon?.percentBps ? String(coupon.percentBps / 100) : "10");
  const [amount, setAmount] = useState(centsToInput(coupon?.amountCents ?? 500));
  const [maxDiscount, setMaxDiscount] = useState(centsToInput(coupon?.maxDiscountCents ?? null));
  const [minSubtotal, setMinSubtotal] = useState(centsToInput(coupon?.minSubtotalCents ?? null));
  const [startsAt, setStartsAt] = useState(toLocalInput(coupon?.startsAt ?? null, timeZone));
  const [endsAt, setEndsAt] = useState(toLocalInput(coupon?.endsAt ?? null, timeZone));
  const [active, setActive] = useState(coupon?.isActive ?? true);
  const [isPublic, setPublic] = useState(coupon?.isPublic ?? true);
  const [maxRedemptions, setMaxRedemptions] = useState(
    coupon?.maxRedemptions ? String(coupon.maxRedemptions) : "",
  );
  const [perCustomer, setPerCustomer] = useState(
    coupon?.perCustomerLimit ? String(coupon.perCustomerLimit) : "1",
  );
  const [fulfillment, setFulfillment] = useState<FulfillmentType[]>(coupon?.fulfillmentTypes ?? []);
  const [newOnly, setNewOnly] = useState(coupon?.newCustomersOnly ?? false);
  const [cats, setCats] = useState<string[]>(coupon?.includedCategoryIds ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => {
      const input: CouponInput = {
        code: auto ? null : code.trim().toUpperCase() || null,
        name: name.trim(),
        description: description.trim() || null,
        type,
        percentBps: type === "PERCENTAGE" ? Math.round(Number(percent.replace(",", ".")) * 100) : null,
        amountCents: type === "FIXED_AMOUNT" ? parseEuroToCents(amount) : null,
        maxDiscountCents: type === "PERCENTAGE" && maxDiscount.trim() ? parseEuroToCents(maxDiscount) : null,
        minSubtotalCents: minSubtotal.trim() ? parseEuroToCents(minSubtotal) : null,
        startsAt: fromLocalInput(startsAt, timeZone),
        endsAt: fromLocalInput(endsAt, timeZone),
        isActive: active,
        autoApply: auto,
        isPublic,
        maxRedemptions: maxRedemptions.trim() ? Number.parseInt(maxRedemptions, 10) : null,
        perCustomerLimit: perCustomer.trim() ? Number.parseInt(perCustomer, 10) : null,
        fulfillmentTypes: fulfillment,
        newCustomersOnly: newOnly,
        includedProductIds: coupon?.includedProductIds ?? [],
        includedCategoryIds: cats,
      };
      return coupon ? api.admin.coupons.update(coupon.id, input) : api.admin.coupons.create(input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      toast.success(coupon ? "Coupon aggiornato" : "Coupon creato");
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(firstErrors(e.fieldErrors));
      toast.error(e instanceof ApiError ? e.message : "Salvataggio non riuscito.");
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={coupon ? `Coupon · ${coupon.name}` : "Nuova promozione"}
      size="lg"
      footer={
        <div className="flex justify-end">
          <Button loading={save.isPending} disabled={name.trim().length < 2} onClick={() => save.mutate()}>
            Salva
          </Button>
        </div>
      }
    >
      <div className="space-y-5 px-6 pb-4">
        <Field label="Nome (visibile ai clienti)" error={errors.name}>
          {(p) => (
            <Input
              {...p}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Es. Sconto 20% sopra i 30€"
            />
          )}
        </Field>
        <Field label="Descrizione" optional>
          {(p) => (
            <Textarea {...p} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          )}
        </Field>
        <Segmented
          ariaLabel="Tipo di sconto"
          value={type}
          onChange={setType}
          options={[
            { value: "PERCENTAGE", label: "Percentuale" },
            { value: "FIXED_AMOUNT", label: "Importo fisso" },
            { value: "FREE_DELIVERY", label: "Consegna gratis" },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {type === "PERCENTAGE" ? (
            <>
              <Field label="Sconto (%)" error={errors.percentBps}>
                {(p) => (
                  <Input
                    {...p}
                    inputMode="decimal"
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Sconto massimo (€)" optional>
                {(p) => (
                  <Input
                    {...p}
                    inputMode="decimal"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                  />
                )}
              </Field>
            </>
          ) : null}
          {type === "FIXED_AMOUNT" ? (
            <Field label="Sconto (€)" error={errors.amountCents}>
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
          <Field label="Spesa minima (€)" optional>
            {(p) => (
              <Input
                {...p}
                inputMode="decimal"
                value={minSubtotal}
                onChange={(e) => setMinSubtotal(e.target.value)}
              />
            )}
          </Field>
        </div>
        <label className="flex items-center justify-between gap-4 rounded-xl bg-surface-2 px-4 py-3 text-body-sm">
          <span>
            <span className="block font-semibold">Applica automaticamente</span>
            <span className="block text-caption text-fg-muted">
              Nessun codice: il carrello applica la promozione migliore per il cliente.
            </span>
          </span>
          <Switch checked={auto} onCheckedChange={setAuto} />
        </label>
        {!auto ? (
          <Field label="Codice" error={errors.code} hint="Lettere, numeri e trattini.">
            {(p) => (
              <Input
                {...p}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="BENVENUTO10"
              />
            )}
          </Field>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valido dal" optional>
            {(p) => (
              <Input
                {...p}
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            )}
          </Field>
          <Field label="Valido fino al" optional error={errors.endsAt}>
            {(p) => (
              <Input
                {...p}
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            )}
          </Field>
          <Field label="Utilizzi totali" optional>
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value.replace(/\D/g, ""))}
                placeholder="Illimitati"
              />
            )}
          </Field>
          <Field label="Utilizzi per cliente" optional>
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                value={perCustomer}
                onChange={(e) => setPerCustomer(e.target.value.replace(/\D/g, ""))}
                placeholder="Illimitati"
              />
            )}
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-sm text-fg-muted">Vale per:</span>
          <Chip selected={fulfillment.length === 0} onClick={() => setFulfillment([])}>
            Consegna e ritiro
          </Chip>
          <Chip
            selected={fulfillment.length === 1 && fulfillment[0] === "DELIVERY"}
            onClick={() => setFulfillment(["DELIVERY"])}
          >
            Solo consegna
          </Chip>
          <Chip
            selected={fulfillment.length === 1 && fulfillment[0] === "PICKUP"}
            onClick={() => setFulfillment(["PICKUP"])}
          >
            Solo ritiro
          </Chip>
        </div>
        <div className="space-y-2">
          <p className="text-body-sm text-fg-muted">Solo per queste categorie (nessuna = tutto il menu):</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Chip
                key={c.id}
                selected={cats.includes(c.id)}
                onClick={() =>
                  setCats((l) => (l.includes(c.id) ? l.filter((x) => x !== c.id) : [...l, c.id]))
                }
              >
                {c.name}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Attivo", active, setActive],
            ["Mostra in “Offerte”", isPublic, setPublic],
            ["Solo nuovi clienti", newOnly, setNewOnly],
          ].map(([label, value, set]) => (
            <label
              key={label as string}
              className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3 text-body-sm font-medium"
            >
              {label as string}
              <Switch checked={value as boolean} onCheckedChange={set as (v: boolean) => void} />
            </label>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

export function CouponsManager({
  initial,
  categories,
  timeZone,
}: {
  initial: AdminCouponDTO[];
  categories: AdminCatalogDTO["categories"];
  timeZone: string;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => api.admin.coupons.list(),
    initialData: { coupons: initial },
    initialDataUpdatedAt: 0,
  });
  const [editor, setEditor] = useState<{ coupon: AdminCouponDTO | null; v: number } | null>(null);
  const [archiving, setArchiving] = useState<AdminCouponDTO | null>(null);
  const archive = useMutation({
    mutationFn: (id: string) => api.admin.coupons.archive(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      setArchiving(null);
      toast("Promozione archiviata");
    },
  });
  return (
    <AdminPage
      title="Coupon e offerte"
      description="Le promozioni automatiche e pubbliche compaiono in home e in “Offerte”."
      actions={
        <Button onClick={() => setEditor({ coupon: null, v: Date.now() })}>
          <Plus className="size-4" /> Nuova promozione
        </Button>
      }
    >
      {data.coupons.length === 0 ? <EmptyState icon={TicketPercent} title="Nessuna promozione" /> : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {data.coupons.map((c) => (
          <article key={c.id} className="flex gap-4 rounded-2xl bg-surface p-4 ring-1 ring-line">
            <span className="grid h-14 min-w-14 place-items-center rounded-xl bg-red-500 px-2 text-center text-body-sm font-extrabold text-white">
              {c.valueLabel}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-bold">
                {c.name}
                {c.isActive ? <Badge tone="success">Attivo</Badge> : <Badge tone="neutral">Spento</Badge>}
                {c.autoApply ? <Badge tone="info">Automatico</Badge> : <Badge tone="dark">{c.code}</Badge>}
              </p>
              <p className="text-body-sm text-fg-muted">
                {c.minSubtotalCents ? `Da ${formatEuro(c.minSubtotalCents)} · ` : ""}
                {c.perCustomerLimit ? `${c.perCustomerLimit} per cliente · ` : ""}
                usato {c.redemptionsCount}
                {c.maxRedemptions ? `/${c.maxRedemptions}` : ""} volte
                {c.endsAt ? ` · fino al ${formatOrderDate(c.endsAt, timeZone)}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Modifica ${c.name}`}
                onClick={() => setEditor({ coupon: c, v: Date.now() })}
              >
                <Pencil className="size-4.5" />
              </Button>
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => setArchiving(c)}>
                Archivia
              </Button>
            </div>
          </article>
        ))}
      </div>
      {editor ? (
        <CouponEditor
          key={editor.v}
          coupon={editor.coupon}
          categories={categories}
          timeZone={timeZone}
          open
          onClose={() => setEditor(null)}
        />
      ) : null}
      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={`Archiviare ${archiving?.name ?? ""}?`}
        description={
          archiving?.redemptionsCount
            ? "È già stata usata: resta nello storico ma non sarà più applicabile."
            : "Non è mai stata usata: verrà eliminata."
        }
        confirmLabel="Archivia"
        busy={archive.isPending}
        onConfirm={() => archiving && archive.mutate(archiving.id)}
      />
    </AdminPage>
  );
}
