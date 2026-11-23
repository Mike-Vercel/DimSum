"use client";

import { formatEuro } from "@dimsum/domain";
import type { AdminCatalogDTO, AdminComboDTO, ImageDTO } from "@dimsum/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, Layers, Minus, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { centsToInput, firstErrors, parseEuroToCents } from "@/lib/admin/forms";
import { cn } from "@/lib/cn";
import { AdminPage } from "../ui";

const key = ["admin", "combos"] as const;

/** Combo photo, or the dishes inside side by side when it has none. */
function ComboVisual({ image, items, className }: { image: ImageDTO | null; items: { image: ImageDTO | null }[]; className?: string }) {
  const photos = items.map((i) => i.image).filter((i): i is ImageDTO => !!i).slice(0, 3);
  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br from-amber-100 via-orange-100 to-red-100", className)}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center -space-x-6 p-3">
          {photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.url + i}
              src={p.url}
              alt=""
              className={cn(
                "aspect-square w-[44%] rounded-full object-cover shadow-lg ring-4 ring-white",
                i === 1 && "z-10 scale-110",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Back office "Combo": several dishes at a special price. Each combo is a dish of the menu
 * ("Combo" category) whose allergens and labels come from the dishes inside; the price must be
 * below the dishes on their own, and customers see the saving.
 */
export function ComboManager({
  initial,
  catalog,
  canEdit,
}: {
  initial: AdminComboDTO[];
  catalog: AdminCatalogDTO;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: key,
    queryFn: async () => (await api.admin.combos.list()).combos,
    initialData: initial,
  });
  const combos = data ?? initial;
  const [editing, setEditing] = useState<{ combo: AdminComboDTO | null; version: number } | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api.admin.combos.remove(id),
    onSuccess: () => {
      toast.success("Combo eliminata");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Eliminazione non riuscita."),
  });

  return (
    <AdminPage
      title="Combo"
      description="Più piatti a un prezzo speciale: compaiono in Offerte e nel menu."
      actions={
        canEdit ? (
          <Button onClick={() => setEditing({ combo: null, version: Date.now() })}>
            <Plus className="size-4" /> Nuova combo
          </Button>
        ) : null
      }
    >
      {combos.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-ink">
            <Layers className="size-6" />
          </span>
          <p className="text-title font-bold">Nessuna combo per ora</p>
          <p className="max-w-sm text-body-sm text-fg-muted">
            Crea un menu completo (es. ravioli + noodles + bibita) a un prezzo più basso dei piatti presi da soli.
          </p>
          {canEdit ? (
            <Button onClick={() => setEditing({ combo: null, version: Date.now() })}>
              <Plus className="size-4" /> Crea la prima combo
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {combos.map((c) => {
            const saving = c.valueCents - c.priceCents;
            return (
              <article key={c.id} className="overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
                <div className="relative">
                  <ComboVisual image={c.image} items={c.items} className="aspect-[16/10]" />
                  {saving > 0 ? (
                    <span className="absolute top-3 left-3 rounded-full bg-brand px-3 py-1 text-caption font-extrabold text-white shadow">
                      Risparmi {formatEuro(saving)}
                    </span>
                  ) : null}
                  <div className="absolute top-3 right-3 flex gap-1.5">
                    {!c.isVisible ? (
                      <Badge tone="neutral">
                        <EyeOff className="size-3" /> Nascosta
                      </Badge>
                    ) : null}
                    {!c.isAvailable ? <Badge tone="warning">Un piatto è esaurito</Badge> : null}
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-title font-extrabold leading-tight">{c.name}</h2>
                    <div className="text-right tabular-nums">
                      <p className="text-title font-extrabold text-brand">{formatEuro(c.priceCents)}</p>
                      <p className="text-caption text-fg-subtle line-through">{formatEuro(c.valueCents)}</p>
                    </div>
                  </div>
                  <ul className="space-y-1 text-body-sm text-fg-muted">
                    {c.items.map((i) => (
                      <li key={i.productId} className={cn(!i.isAvailable && "text-danger")}>
                        {i.quantity}× {i.name}
                        {!i.isAvailable ? " · esaurito" : ""}
                      </li>
                    ))}
                  </ul>
                  {canEdit ? (
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => setEditing({ combo: c, version: Date.now() })}
                      >
                        <Pencil className="size-4" /> Modifica
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        aria-label={`Elimina ${c.name}`}
                        loading={remove.isPending && remove.variables === c.id}
                        onClick={() => {
                          if (window.confirm(`Eliminare la combo "${c.name}"?`)) remove.mutate(c.id);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing ? (
        <ComboEditor
          key={editing.version}
          combo={editing.combo}
          catalog={catalog}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void qc.invalidateQueries({ queryKey: key });
          }}
        />
      ) : null}
    </AdminPage>
  );
}

function ComboEditor({
  combo,
  catalog,
  onClose,
  onSaved,
}: {
  combo: AdminComboDTO | null;
  catalog: AdminCatalogDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(combo?.name ?? "");
  const [description, setDescription] = useState(combo?.description ?? "");
  const [price, setPrice] = useState(centsToInput(combo?.priceCents));
  const [visible, setVisible] = useState(combo?.isVisible ?? true);
  const [items, setItems] = useState<{ productId: string; quantity: number }[]>(
    combo?.items.map((i) => ({ productId: i.productId, quantity: i.quantity })) ?? [],
  );
  const [q, setQ] = useState("");
  const search = useDeferredValue(q.trim().toLowerCase());
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Every dish of the menu except combos.
  const dishes = catalog.categories
    .filter((c) => c.slug !== "combo")
    .flatMap((c) => c.productIds.map((id) => ({ category: c.name, product: catalog.products[id]! })))
    .filter((d) => d.product);
  const results = search
    ? dishes.filter((d) => d.product.name.toLowerCase().includes(search) || d.category.toLowerCase().includes(search))
    : dishes;
  const priceOf = (id: string) => catalog.products[id]?.priceCents ?? 0;
  const valueCents = items.reduce((sum, i) => sum + priceOf(i.productId) * i.quantity, 0);
  const priceCents = parseEuroToCents(price);
  const saving = priceCents !== null ? valueCents - priceCents : 0;

  const add = (productId: string) =>
    setItems((list) =>
      list.some((i) => i.productId === productId)
        ? list.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(10, i.quantity + 1) } : i))
        : [...list, { productId, quantity: 1 }],
    );
  const change = (productId: string, delta: number) =>
    setItems((list) =>
      list.flatMap((i) =>
        i.productId !== productId ? [i] : i.quantity + delta <= 0 ? [] : [{ ...i, quantity: Math.min(10, i.quantity + delta) }],
      ),
    );

  const save = useMutation({
    mutationFn: () => {
      const input = {
        name: name.trim(),
        description: description.trim() || null,
        priceCents: priceCents ?? 0,
        isVisible: visible,
        items,
      };
      return combo ? api.admin.combos.update(combo.id, input) : api.admin.combos.create(input);
    },
    onSuccess: () => {
      toast.success(combo ? "Combo aggiornata" : "Combo creata", { description: "La trovi in Offerte e nel menu." });
      onSaved();
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setErrors(firstErrors(e.fieldErrors));
        toast.error(e.message);
      } else toast.error("Salvataggio non riuscito.");
    },
  });

  const submit = () => {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Dai un nome alla combo.";
    if (items.length < 2) next.items = "Scegli almeno due piatti.";
    if (priceCents === null || priceCents < 50) next.priceCents = "Prezzo non valido.";
    else if (priceCents >= valueCents) next.priceCents = "Deve costare meno dei piatti presi da soli.";
    setErrors(next);
    if (Object.keys(next).length === 0) save.mutate();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={combo ? `Modifica · ${combo.name}` : "Nuova combo"}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-body-sm tabular-nums">
            <p className="text-fg-muted">
              Piatti da soli: <span className="line-through">{formatEuro(valueCents)}</span>
            </p>
            <p className={cn("font-bold", saving > 0 ? "text-success" : "text-fg-subtle")}>
              {saving > 0 ? `Il cliente risparmia ${formatEuro(saving)}` : "Imposta un prezzo più basso"}
            </p>
          </div>
          <Button loading={save.isPending} onClick={submit} className="shrink-0">
            {combo ? "Salva" : "Crea combo"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 px-5 pb-4 sm:px-6">
        <Field label="Nome" error={errors.name}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Menu Dim per 2" />}
        </Field>
        <Field label="Descrizione" optional hint="Una frase che fa venire fame.">
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Es. Il meglio di DIMSUM in un solo ordine: ravioli, noodles e il dolce."
            />
          )}
        </Field>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="font-bold">Cosa c&apos;è dentro</h3>
            {errors.items ? <span className="text-caption font-semibold text-danger">{errors.items}</span> : null}
          </div>
          {items.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
              {items.map((i) => {
                const p = catalog.products[i.productId];
                return (
                  <li key={i.productId} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-semibold">{p?.name ?? "Piatto rimosso"}</span>
                      <span className="text-caption text-fg-muted tabular-nums">{formatEuro(priceOf(i.productId))} cad.</span>
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-surface-2 p-1">
                      <button
                        type="button"
                        onClick={() => change(i.productId, -1)}
                        className="grid size-8 place-items-center rounded-full hover:bg-surface"
                        aria-label="Meno"
                      >
                        {i.quantity === 1 ? <X className="size-4" /> : <Minus className="size-4" />}
                      </button>
                      <span className="w-6 text-center font-bold tabular-nums">{i.quantity}</span>
                      <button
                        type="button"
                        onClick={() => change(i.productId, 1)}
                        className="grid size-8 place-items-center rounded-full hover:bg-surface"
                        aria-label="Più"
                      >
                        <Plus className="size-4" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-body-sm text-fg-muted">
              Aggiungi i piatti dall&apos;elenco qui sotto.
            </p>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-fg-subtle" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca un piatto da aggiungere" className="pl-10" />
          </div>
          <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-2xl ring-1 ring-line">
            {results.slice(0, 60).map(({ category, product }) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => add(product.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-semibold">{product.name}</span>
                    <span className="text-caption text-fg-muted">{category}</span>
                  </span>
                  <span className="text-body-sm tabular-nums text-fg-muted">{formatEuro(product.priceCents)}</span>
                  <Plus className="size-4 text-brand" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prezzo della combo (€)" error={errors.priceCents}>
            {(p) => <Input {...p} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />}
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line sm:self-end">
            <span>
              <span className="block font-semibold">Visibile ai clienti</span>
              <span className="text-caption text-fg-muted">In Offerte e nel menu</span>
            </span>
            <Switch checked={visible} onCheckedChange={setVisible} />
          </label>
        </div>
        <p className="text-caption text-fg-muted">
          Allergeni ed etichette (vegetariano, piccante…) si calcolano dai piatti inclusi. La foto è facoltativa:
          senza, mostriamo i piatti inclusi; puoi caricarne una da Menu → Combo.
        </p>
      </div>
    </Dialog>
  );
}
