"use client";

import { formatEuro } from "@dimsum/domain";
import type { AdminCatalogDTO, AdminModifierGroupDTO, AdminProductDTO } from "@dimsum/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, EyeOff, Pencil, Plus, Search, SlidersHorizontal, Star } from "lucide-react";
import Image from "next/image";
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
import { formatOrderDate } from "@/lib/dates";
import { AdminPage } from "../ui";
import { ProductEditor } from "./product-editor";

const key = ["admin", "catalog"] as const;
type Availability = "on" | "tomorrow" | "off";

function availabilityOf(p: AdminProductDTO, now: number): Availability {
  if (p.isAvailable) return "on";
  if (p.unavailableUntil && new Date(p.unavailableUntil).getTime() > now) return "tomorrow";
  return p.unavailableUntil ? "on" : "off";
}

/** Three-way control used by the kitchen during service. */
function AvailabilitySwitch({
  value,
  busy,
  onChange,
}: {
  value: Availability;
  busy: boolean;
  onChange: (v: Availability) => void;
}) {
  const options: { v: Availability; label: string }[] = [
    { v: "on", label: "Disponibile" },
    { v: "tomorrow", label: "Torna domani" },
    { v: "off", label: "Esaurito" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Disponibilità"
      className={cn("inline-flex rounded-full bg-surface-3 p-1", busy && "opacity-60")}
    >
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          disabled={busy}
          onClick={() => value !== o.v && onChange(o.v)}
          className={cn(
            "rounded-full px-3 py-1.5 text-caption font-semibold whitespace-nowrap transition-colors",
            value === o.v
              ? o.v === "on"
                ? "bg-success text-white"
                : o.v === "tomorrow"
                  ? "bg-warning text-white"
                  : "bg-danger text-white"
              : "text-fg-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CategoryEditor({
  category,
  open,
  onClose,
}: {
  category: AdminCatalogDTO["categories"][number] | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [visible, setVisible] = useState(category?.isVisible ?? true);
  const save = useMutation({
    mutationFn: () => {
      const input = {
        name: name.trim(),
        description: description.trim() || null,
        isVisible: visible,
        coverImageId: null,
      };
      return category
        ? api.admin.catalog.updateCategory(category.id, input)
        : api.admin.catalog.createCategory(input);
    },
    onSuccess: (catalog) => {
      qc.setQueryData(key, catalog);
      toast.success(category ? "Categoria aggiornata" : "Categoria creata");
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Salvataggio non riuscito."),
  });
  const remove = useMutation({
    mutationFn: () => api.admin.catalog.deleteCategory(category!.id),
    onSuccess: (catalog) => {
      qc.setQueryData(key, catalog);
      toast("Categoria eliminata");
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Eliminazione non riuscita."),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={category ? `Categoria · ${category.name}` : "Nuova categoria"}
      size="sm"
      footer={
        <div className="flex justify-between gap-2">
          {category ? (
            <Button
              variant="ghost"
              className="text-danger"
              loading={remove.isPending}
              disabled={category.productIds.length > 0}
              onClick={() => remove.mutate()}
            >
              Elimina
            </Button>
          ) : (
            <span />
          )}
          <Button loading={save.isPending} disabled={name.trim().length < 2} onClick={() => save.mutate()}>
            Salva
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-6 pb-4">
        <Field label="Nome">
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />}
        </Field>
        <Field label="Descrizione" optional>
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
            />
          )}
        </Field>
        <label className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-body-sm font-medium">
          Visibile nel menu <Switch checked={visible} onCheckedChange={setVisible} />
        </label>
        {category && category.productIds.length > 0 ? (
          <p className="text-caption text-fg-muted">
            Per eliminarla sposta prima i suoi {category.productIds.length} prodotti.
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

function OptionsEditor({
  group,
  open,
  onClose,
}: {
  group: AdminModifierGroupDTO | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(group?.name ?? "");
  const [minSelect, setMin] = useState(group?.minSelect ?? 0);
  const [maxSelect, setMax] = useState(group?.maxSelect ?? 1);
  const [active, setActive] = useState(group?.isActive ?? true);
  const [options, setOptions] = useState(
    group?.options.map((o) => ({ ...o, price: centsToInput(o.priceDeltaCents) })) ?? [
      {
        id: undefined as string | undefined,
        name: "",
        price: "0,00",
        isAvailable: true,
        maxQuantity: 1,
        allergens: [] as AdminModifierGroupDTO["options"][number]["allergens"],
        priceDeltaCents: 0,
      },
    ],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => {
      const input = {
        name: name.trim(),
        description: group?.description ?? null,
        minSelect,
        maxSelect,
        maxTotalQuantity: Math.max(maxSelect, ...options.map((o) => o.maxQuantity)),
        isActive: active,
        options: options.map((o) => ({
          ...(o.id ? { id: o.id } : {}),
          name: o.name.trim(),
          priceDeltaCents: parseEuroToCents(o.price) ?? 0,
          isAvailable: o.isAvailable,
          maxQuantity: o.maxQuantity,
          allergens: o.allergens,
        })),
      };
      return group ? api.admin.catalog.updateGroup(group.id, input) : api.admin.catalog.createGroup(input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      toast.success("Opzioni salvate");
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
      title={group ? `Opzioni · ${group.name}` : "Nuovo gruppo di opzioni"}
      description="Aggiunte e scelte proposte nella scheda del piatto (es. Aggiunzioni: brodo extra, uovo…)."
      size="lg"
      footer={
        <div className="flex justify-end">
          <Button
            loading={save.isPending}
            disabled={name.trim().length < 2 || options.some((o) => !o.name.trim())}
            onClick={() => save.mutate()}
          >
            Salva opzioni
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-6 pb-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_120px_120px]">
          <Field label="Nome del gruppo">
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Minimo" error={errors.minSelect}>
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                max={20}
                value={minSelect}
                onChange={(e) => setMin(Number(e.target.value))}
              />
            )}
          </Field>
          <Field label="Massimo" error={errors.maxSelect}>
            {(p) => (
              <Input
                {...p}
                type="number"
                min={1}
                max={20}
                value={maxSelect}
                onChange={(e) => setMax(Number(e.target.value))}
              />
            )}
          </Field>
        </div>
        <label className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-body-sm font-medium">
          Gruppo attivo <Switch checked={active} onCheckedChange={setActive} />
        </label>
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={o.id ?? i} className="grid grid-cols-[1fr_110px_auto_auto] items-center gap-2">
              <Input
                aria-label="Nome opzione"
                value={o.name}
                onChange={(e) =>
                  setOptions((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
                placeholder="Es. Brodo extra"
              />
              <Input
                aria-label="Prezzo opzione"
                inputMode="decimal"
                value={o.price}
                onChange={(e) =>
                  setOptions((l) => l.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))
                }
              />
              <label className="flex items-center gap-2 text-caption">
                <Switch
                  checked={o.isAvailable}
                  onCheckedChange={(v) =>
                    setOptions((l) => l.map((x, j) => (j === i ? { ...x, isAvailable: v } : x)))
                  }
                  aria-label="Disponibile"
                />
              </label>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Rimuovi"
                disabled={options.length === 1}
                onClick={() => setOptions((l) => l.filter((_, j) => j !== i))}
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setOptions((l) => [
                ...l,
                {
                  id: undefined,
                  name: "",
                  price: "0,00",
                  isAvailable: true,
                  maxQuantity: 1,
                  allergens: [],
                  priceDeltaCents: 0,
                },
              ])
            }
          >
            <Plus className="size-4" /> Aggiungi opzione
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function MenuManager({
  initial,
  canEdit,
  timeZone,
}: {
  initial: AdminCatalogDTO;
  canEdit: boolean;
  timeZone: string;
}) {
  const qc = useQueryClient();
  const { data: catalog = initial } = useQuery({
    queryKey: key,
    queryFn: () => api.admin.catalog.get(),
    initialData: initial,
    initialDataUpdatedAt: 0,
  });
  const [categoryId, setCategoryId] = useState<string | null>(initial.categories[0]?.id ?? null);
  const [q, setQ] = useState("");
  const search = useDeferredValue(q.trim().toLowerCase());
  const [editing, setEditing] = useState<{ product: AdminProductDTO | null; version: number } | null>(null);
  const [categoryEditor, setCategoryEditor] = useState<{
    category: AdminCatalogDTO["categories"][number] | null;
    version: number;
  } | null>(null);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [groupEditor, setGroupEditor] = useState<{
    group: AdminModifierGroupDTO | null;
    version: number;
  } | null>(null);
  const [reordering, setReordering] = useState(false);
  const [now] = useState(() => Date.now());

  const availability = useMutation({
    mutationFn: ({ productId, value }: { productId: string; value: Availability }) =>
      api.admin.catalog.availability({
        productIds: [productId],
        isAvailable: value === "on",
        until: value === "tomorrow" ? "tomorrow" : null,
      }),
    onMutate: async ({ productId, value }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<AdminCatalogDTO>(key);
      qc.setQueryData<AdminCatalogDTO>(key, (c) =>
        c
          ? {
              ...c,
              products: {
                ...c.products,
                [productId]: {
                  ...c.products[productId]!,
                  isAvailable: value === "on",
                  unavailableUntil: value === "tomorrow" ? new Date(now + 86_400_000).toISOString() : null,
                },
              },
            }
          : c,
      );
      return { previous };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error(e instanceof ApiError ? e.message : "Operazione non riuscita.");
    },
    onSuccess: (res, { productId }) => {
      const patch = res.patches[0];
      const name = catalog.products[productId]?.name ?? "Prodotto";
      if (patch) {
        qc.setQueryData<AdminCatalogDTO>(key, (c) =>
          c
            ? {
                ...c,
                products: {
                  ...c.products,
                  [productId]: {
                    ...c.products[productId]!,
                    isAvailable: patch.isAvailable,
                    unavailableUntil: patch.availableAgainAt,
                  },
                },
              }
            : c,
        );
        toast.success(
          patch.isAvailable
            ? `${name}: disponibile`
            : patch.availableAgainAt
              ? `${name}: torna ${formatOrderDate(patch.availableAgainAt, timeZone)}`
              : `${name}: esaurito`,
        );
      }
    },
  });
  const reorder = useMutation({
    mutationFn: ({ category, ids }: { category: string; ids: string[] }) =>
      api.admin.catalog.reorderProducts(category, ids),
    onSuccess: (c) => qc.setQueryData(key, c),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Riordino non riuscito."),
  });

  const all = Object.values(catalog.products);
  const visibleProducts = search
    ? all.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.posCode?.toLowerCase() === search ||
          p.nameZh?.includes(search),
      )
    : (catalog.categories
        .find((c) => c.id === categoryId)
        ?.productIds.map((id) => catalog.products[id]!)
        .filter(Boolean) ?? []);
  const soldOutCount = all.filter((p) => availabilityOf(p, now) !== "on").length;

  const move = (index: number, delta: number) => {
    if (!categoryId) return;
    const ids = visibleProducts.map((p) => p.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorder.mutate({ category: categoryId, ids });
  };

  return (
    <AdminPage
      title="Menu"
      description={
        soldOutCount
          ? soldOutCount === 1
            ? "1 prodotto non disponibile in questo momento"
            : `${soldOutCount} prodotti non disponibili in questo momento`
          : "Tutti i prodotti sono disponibili"
      }
      actions={
        canEdit ? (
          <>
            <Button variant="secondary" onClick={() => setGroupsOpen(true)}>
              <SlidersHorizontal className="size-4" /> Opzioni
            </Button>
            <Button
              variant="secondary"
              onClick={() => setCategoryEditor({ category: null, version: Date.now() })}
            >
              <Plus className="size-4" /> Categoria
            </Button>
            <Button onClick={() => setEditing({ product: null, version: Date.now() })}>
              <Plus className="size-4" /> Prodotto
            </Button>
          </>
        ) : null
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Categorie" className="space-y-1 lg:sticky lg:top-6 lg:self-start">
          <div className="relative mb-3">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-fg-subtle"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca un piatto o un codice"
              className="pl-10"
              aria-label="Cerca nel menu"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-2 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
            {catalog.categories.map((c) => {
              const out = c.productIds.filter(
                (id) => catalog.products[id] && availabilityOf(catalog.products[id]!, now) !== "on",
              ).length;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCategoryId(c.id);
                    setQ("");
                  }}
                  className={cn(
                    "flex shrink-0 items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left text-body-sm font-semibold transition-colors lg:w-full",
                    c.id === categoryId && !search
                      ? "bg-ink-950 text-white"
                      : "bg-surface ring-1 ring-line hover:bg-surface-2",
                  )}
                >
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    {!c.isVisible ? <EyeOff className="size-4 opacity-60" aria-label="Nascosta" /> : null}
                    {c.name}
                  </span>
                  <span className={cn("text-caption tabular-nums", out ? "text-danger" : "opacity-60")}>
                    {out ? (out === 1 ? "1 esaurito" : `${out} esauriti`) : c.productIds.length}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <section aria-label="Prodotti" className="min-w-0">
          {!search && canEdit && categoryId ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-title font-bold">
                {catalog.categories.find((c) => c.id === categoryId)?.name}
              </h2>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={reordering ? "dark" : "ghost"}
                  onClick={() => setReordering((r) => !r)}
                >
                  {reordering ? "Fine" : "Riordina"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setCategoryEditor({
                      category: catalog.categories.find((c) => c.id === categoryId) ?? null,
                      version: Date.now(),
                    })
                  }
                >
                  <Pencil className="size-4" /> Categoria
                </Button>
              </div>
            </div>
          ) : null}
          <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
            {visibleProducts.length === 0 ? (
              <li className="px-5 py-10 text-center text-body-sm text-fg-muted">Nessun prodotto.</li>
            ) : null}
            {visibleProducts.map((p, i) => {
              const value = availabilityOf(p, now);
              const image = p.images[0];
              return (
                <li
                  key={p.id}
                  className={cn(
                    "flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3",
                    value !== "on" && "bg-danger-soft/30",
                  )}
                >
                  {reordering ? (
                    <span className="flex flex-col">
                      <button
                        type="button"
                        aria-label="Sposta su"
                        disabled={i === 0 || reorder.isPending}
                        onClick={() => move(i, -1)}
                        className="grid size-7 place-items-center rounded hover:bg-surface-2 disabled:opacity-30"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Sposta giù"
                        disabled={i === visibleProducts.length - 1 || reorder.isPending}
                        onClick={() => move(i, 1)}
                        className="grid size-7 place-items-center rounded hover:bg-surface-2 disabled:opacity-30"
                      >
                        <ArrowDown className="size-4" />
                      </button>
                    </span>
                  ) : null}
                  <div
                    className={cn(
                      "relative size-14 shrink-0 overflow-hidden rounded-xl",
                      image?.backdrop === "LIGHT" ? "bg-white" : "bg-ink-900",
                    )}
                  >
                    {image ? (
                      <Image
                        src={image.url}
                        alt=""
                        fill
                        sizes="56px"
                        className={image.backdrop === "LIGHT" ? "object-contain" : "object-cover"}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                      {p.posCode ? (
                        <span className="rounded bg-surface-2 px-1.5 text-micro font-bold text-fg-muted">
                          {p.posCode}
                        </span>
                      ) : null}
                      {p.name}
                      {p.isFeatured ? (
                        <Star
                          className="fill-saffron-400 text-saffron-400 size-3.5"
                          aria-label="In evidenza"
                        />
                      ) : null}
                      {!p.isVisible ? <Badge tone="neutral">Nascosto</Badge> : null}
                      {!p.allergensDeclared ? <Badge tone="warning">Allergeni da verificare</Badge> : null}
                    </p>
                    <p className="text-body-sm text-fg-muted tabular-nums">
                      {p.variants.length
                        ? p.variants.map((v) => `${v.name} ${formatEuro(v.priceCents)}`).join(" · ")
                        : formatEuro(p.priceCents)}
                      {value === "tomorrow" && p.unavailableUntil
                        ? ` · torna ${formatOrderDate(p.unavailableUntil, timeZone)}`
                        : ""}
                    </p>
                  </div>
                  <AvailabilitySwitch
                    value={value}
                    busy={availability.isPending && availability.variables?.productId === p.id}
                    onChange={(v) => availability.mutate({ productId: p.id, value: v })}
                  />
                  {canEdit ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Modifica ${p.name}`}
                      onClick={() => setEditing({ product: p, version: Date.now() })}
                    >
                      <Pencil className="size-4.5" />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {editing ? (
        <ProductEditor
          key={editing.version}
          catalog={catalog}
          product={editing.product}
          defaultCategoryId={categoryId}
          open
          onClose={() => setEditing(null)}
        />
      ) : null}
      {categoryEditor ? (
        <CategoryEditor
          key={categoryEditor.version}
          category={categoryEditor.category}
          open
          onClose={() => setCategoryEditor(null)}
        />
      ) : null}
      <Dialog open={groupsOpen} onOpenChange={setGroupsOpen} title="Gruppi di opzioni" size="md">
        <ul className="space-y-2 px-6 pb-4">
          {catalog.modifierGroups.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => setGroupEditor({ group: g, version: Date.now() })}
                className="flex w-full items-center justify-between rounded-xl bg-surface px-4 py-3 text-left ring-1 ring-line hover:bg-surface-2"
              >
                <span>
                  <span className="block font-semibold">{g.name}</span>
                  <span className="block text-caption text-fg-muted">
                    {g.options.length} opzioni · usato da {g.productCount} prodotti
                    {g.isActive ? "" : " · disattivato"}
                  </span>
                </span>
                <Pencil className="size-4 text-fg-muted" />
              </button>
            </li>
          ))}
          <li>
            <Button
              variant="secondary"
              block
              onClick={() => setGroupEditor({ group: null, version: Date.now() })}
            >
              <Plus className="size-4" /> Nuovo gruppo
            </Button>
          </li>
        </ul>
      </Dialog>
      {groupEditor ? (
        <OptionsEditor
          key={groupEditor.version}
          group={groupEditor.group}
          open
          onClose={() => setGroupEditor(null)}
        />
      ) : null}
    </AdminPage>
  );
}
