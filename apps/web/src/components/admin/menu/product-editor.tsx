"use client";

import { ALLERGEN_LABELS, PRODUCT_TAG_LABELS, SPICY_LEVEL_LABELS } from "@dimsum/domain";
import {
  ALLERGENS,
  type Allergen,
  type AdminCatalogDTO,
  type AdminProductDTO,
  type ProductTag,
} from "@dimsum/types";
import type { ProductInput } from "@dimsum/validation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Switch } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { InlineAlert } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { centsToInput, firstErrors, parseEuroToCents, resizeForUpload } from "@/lib/admin/forms";
import { cn } from "@/lib/cn";

const EDITABLE_TAGS: ProductTag[] = [
  "VEGETARIAN",
  "VEGAN",
  "SPICY",
  "NEW",
  "ALCOHOLIC",
  "CONTAINS_COLOURANTS",
];
const VAT_OPTIONS = [
  { bps: 1000, label: "10% (cibo e bevande analcoliche)" },
  { bps: 2200, label: "22% (alcolici)" },
  { bps: 400, label: "4%" },
];

interface VariantDraft {
  id?: string;
  name: string;
  price: string;
  isAvailable: boolean;
  isDefault: boolean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-line px-6 py-5 first:border-t-0">
      <h3 className="text-body font-bold">{title}</h3>
      {children}
    </section>
  );
}

function Photos({ product, onChange }: { product: AdminProductDTO; onChange: (p: AdminProductDTO) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const remove = useMutation({
    mutationFn: (imageId: string) => api.admin.catalog.deletePhoto(product.id, imageId),
    onSuccess: onChange,
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Eliminazione non riuscita."),
  });
  const upload = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", await resizeForUpload(file), "foto.jpg");
      body.set("alt", product.name);
      const res = await fetch(`/api/v1/admin/products/${product.id}/photos`, {
        method: "POST",
        body,
        credentials: "include",
      });
      const data = (await res.json()) as AdminProductDTO | { error: { message: string } };
      if (!res.ok || "error" in data)
        throw new Error("error" in data ? data.error.message : "Caricamento non riuscito.");
      onChange(data);
      toast.success("Foto caricata");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Caricamento non riuscito.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className="flex flex-wrap gap-3">
      {product.images.map((img, i) => (
        <div
          key={img.id}
          className={cn(
            "relative size-28 overflow-hidden rounded-xl ring-1 ring-line",
            img.backdrop === "LIGHT" ? "bg-white" : "bg-ink-900",
          )}
        >
          <Image
            src={img.url}
            alt={img.alt}
            fill
            sizes="112px"
            className={img.backdrop === "LIGHT" ? "object-contain" : "object-cover"}
          />
          {i === 0 ? (
            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-micro font-semibold text-white">
              Copertina
            </span>
          ) : null}
          <button
            type="button"
            aria-label="Elimina foto"
            disabled={remove.isPending}
            onClick={() => remove.mutate(img.id)}
            className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={uploading}
        className="grid size-28 place-items-center rounded-xl border-2 border-dashed border-line-strong text-fg-muted transition-colors hover:border-fg hover:text-fg disabled:opacity-60"
      >
        <span className="flex flex-col items-center gap-1 text-caption font-semibold">
          <ImagePlus className="size-6" /> {uploading ? "Caricamento…" : "Aggiungi"}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/avif"
        className="sr-only"
        onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
      />
      <p className="w-full text-caption text-fg-subtle">
        Foto reali del piatto, almeno 400×400 px. Ritagliamo e ottimizziamo noi; l&apos;ultima caricata
        diventa la copertina.
      </p>
    </div>
  );
}

export function ProductEditor({
  catalog,
  product,
  defaultCategoryId,
  open,
  onClose,
}: {
  catalog: AdminCatalogDTO;
  product: AdminProductDTO | null;
  defaultCategoryId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [current, setCurrent] = useState(product);
  const [name, setName] = useState(product?.name ?? "");
  const [nameZh, setNameZh] = useState(product?.nameZh ?? "");
  const [categoryId, setCategoryId] = useState(
    product?.categoryId ?? defaultCategoryId ?? catalog.categories[0]?.id ?? "",
  );
  const [description, setDescription] = useState(product?.description ?? "");
  const [ingredients, setIngredients] = useState(product?.ingredients.join(", ") ?? "");
  const [posCode, setPosCode] = useState(product?.posCode ?? "");
  const [price, setPrice] = useState(centsToInput(product?.priceCents ?? null));
  const [vat, setVat] = useState(product?.vatRateBps ?? 1000);
  const [variants, setVariants] = useState<VariantDraft[]>(
    product?.variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: centsToInput(v.priceCents),
      isAvailable: v.isAvailable,
      isDefault: v.isDefault,
    })) ?? [],
  );
  const [tags, setTags] = useState<ProductTag[]>(product?.tags.filter((t) => t !== "BESTSELLER") ?? []);
  const [spicy, setSpicy] = useState(product?.spicyLevel ?? 0);
  const [allergens, setAllergens] = useState<Allergen[]>(product?.allergens ?? []);
  const [mayContain, setMayContain] = useState<Allergen[]>(product?.mayContainAllergens ?? []);
  const [declared, setDeclared] = useState(product?.allergensDeclared ?? false);
  const [groups, setGroups] = useState<string[]>(product?.modifierGroupIds ?? []);
  const [visible, setVisible] = useState(product?.isVisible ?? true);
  const [featured, setFeatured] = useState(product?.isFeatured ?? false);
  const [noDiscounts, setNoDiscounts] = useState(product?.excludedFromDiscounts ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = useMutation({
    mutationFn: (input: ProductInput) =>
      current ? api.admin.catalog.updateProduct(current.id, input) : api.admin.catalog.createProduct(input),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ["admin", "catalog"] });
      toast.success(current ? "Prodotto aggiornato" : "Prodotto creato: ora puoi aggiungere le foto");
      if (current) onClose();
      else setCurrent(p);
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(firstErrors(e.fieldErrors));
      toast.error(e instanceof ApiError ? e.message : "Salvataggio non riuscito.");
    },
  });
  const destroy = useMutation({
    mutationFn: () => api.admin.catalog.deleteProduct(current!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "catalog"] });
      toast("Prodotto rimosso dal menu");
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Eliminazione non riuscita."),
  });

  const submit = () => {
    const next: Record<string, string> = {};
    const priceCents = parseEuroToCents(price);
    if (name.trim().length < 2) next.name = "Inserisci il nome.";
    if (!variants.length && priceCents === null) next.priceCents = "Prezzo non valido (es. 8,90).";
    const variantInputs = variants.map((v, i) => {
      const cents = parseEuroToCents(v.price);
      if (!v.name.trim()) next[`variants.${i}.name`] = "Nome variante mancante.";
      if (cents === null) next[`variants.${i}.priceCents`] = "Prezzo non valido.";
      return {
        ...(v.id ? { id: v.id } : {}),
        name: v.name.trim(),
        priceCents: cents ?? 0,
        isAvailable: v.isAvailable,
        isDefault: v.isDefault,
      };
    });
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate({
      categoryId,
      name: name.trim(),
      nameZh: nameZh.trim() || null,
      description: description.trim() || null,
      descriptionZh: current?.descriptionZh ?? null,
      ingredients: ingredients
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      posCode: posCode.trim() || null,
      priceCents: priceCents ?? 0,
      vatRateBps: vat,
      isVisible: visible,
      isFeatured: featured,
      tags: [...tags, ...(current?.tags.includes("BESTSELLER") ? (["BESTSELLER"] as const) : [])],
      spicyLevel: spicy,
      excludedFromDiscounts: noDiscounts,
      allergens,
      mayContainAllergens: mayContain,
      allergensDeclared: declared,
      maxQuantityPerLine: current?.maxQuantityPerLine ?? 30,
      modifierGroupIds: groups,
      variants: variantInputs,
    });
  };

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={current ? `Modifica · ${current.name}` : "Nuovo prodotto"}
      size="xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {current ? (
            confirmDelete ? (
              <span className="flex items-center gap-2 text-body-sm">
                Rimuovere dal menu?
                <Button
                  size="sm"
                  variant="danger"
                  loading={destroy.isPending}
                  onClick={() => destroy.mutate()}
                >
                  Sì, rimuovi
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  No
                </Button>
              </span>
            ) : (
              <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" /> Rimuovi
              </Button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Chiudi
            </Button>
            <Button loading={save.isPending} onClick={submit}>
              {current ? "Salva modifiche" : "Crea prodotto"}
            </Button>
          </div>
        </div>
      }
    >
      {current?.source.provider ? (
        <div className="px-6 pb-2">
          <InlineAlert tone="info" title="Prodotto importato dal menu originale">
            Le modifiche fatte qui restano valide: una nuova importazione aggiunge solo i piatti nuovi, a meno
            che non si chieda esplicitamente di riallineare nomi e prezzi.
          </InlineAlert>
        </div>
      ) : null}

      <Section title="Foto">
        {current ? (
          <Photos
            product={current}
            onChange={(p) => {
              setCurrent(p);
              void qc.invalidateQueries({ queryKey: ["admin", "catalog"] });
            }}
          />
        ) : (
          <p className="text-body-sm text-fg-muted">Salva il prodotto per aggiungere le foto.</p>
        )}
      </Section>

      <Section title="Dettagli">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome" error={errors.name}>
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />}
          </Field>
          <Field label="Nome in cinese" optional>
            {(p) => (
              <Input
                {...p}
                value={nameZh}
                onChange={(e) => setNameZh(e.target.value)}
                maxLength={60}
                lang="zh"
              />
            )}
          </Field>
          <Field label="Categoria">
            {(p) => (
              <select
                {...p}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-12 w-full rounded-md bg-surface px-3 ring-1 ring-line ring-inset"
              >
                {catalog.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Codice menu" optional hint="Il codice stampato sul menu (es. D03).">
            {(p) => (
              <Input {...p} value={posCode} onChange={(e) => setPosCode(e.target.value)} maxLength={12} />
            )}
          </Field>
          <Field label="Descrizione" optional className="md:col-span-2">
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={600}
              />
            )}
          </Field>
          <Field label="Ingredienti" optional hint="Separati da virgola." className="md:col-span-2">
            {(p) => <Input {...p} value={ingredients} onChange={(e) => setIngredients(e.target.value)} />}
          </Field>
        </div>
      </Section>

      <Section title="Prezzo">
        <div className="grid gap-4 md:grid-cols-2">
          {variants.length === 0 ? (
            <Field label="Prezzo (€)" error={errors.priceCents}>
              {(p) => (
                <Input
                  {...p}
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="8,90"
                />
              )}
            </Field>
          ) : null}
          <Field label="IVA">
            {(p) => (
              <select
                {...p}
                value={vat}
                onChange={(e) => setVat(Number(e.target.value))}
                className="h-12 w-full rounded-md bg-surface px-3 ring-1 ring-line ring-inset"
              >
                {VAT_OPTIONS.map((o) => (
                  <option key={o.bps} value={o.bps}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <div className="space-y-2">
          <p className="text-body-sm font-semibold">
            Varianti{" "}
            {variants.length ? (
              ""
            ) : (
              <span className="font-normal text-fg-muted">(es. porzione piccola / grande)</span>
            )}
          </p>
          {variants.map((v, i) => (
            <div key={v.id ?? i} className="grid grid-cols-[1fr_120px_auto_auto] items-start gap-2">
              <Input
                aria-label="Nome variante"
                value={v.name}
                aria-invalid={!!errors[`variants.${i}.name`]}
                onChange={(e) =>
                  setVariants((vs) => vs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
                placeholder="Nome"
              />
              <Input
                aria-label="Prezzo variante"
                inputMode="decimal"
                value={v.price}
                aria-invalid={!!errors[`variants.${i}.priceCents`]}
                onChange={(e) =>
                  setVariants((vs) => vs.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))
                }
                placeholder="0,00"
              />
              <label className="flex h-12 items-center gap-2 text-caption">
                <Checkbox
                  checked={v.isDefault}
                  onCheckedChange={() =>
                    setVariants((vs) => vs.map((x, j) => ({ ...x, isDefault: j === i })))
                  }
                />{" "}
                Predefinita
              </label>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Rimuovi variante"
                onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setVariants((vs) => [
                ...vs,
                { name: "", price: vs.length ? "" : price, isAvailable: true, isDefault: vs.length === 0 },
              ])
            }
          >
            <Plus className="size-4" /> Aggiungi variante
          </Button>
        </div>
      </Section>

      <Section title="Etichette e visibilità">
        <div className="flex flex-wrap gap-2">
          {EDITABLE_TAGS.map((t) => (
            <Chip key={t} selected={tags.includes(t)} onClick={() => setTags((l) => toggle(l, t))}>
              {PRODUCT_TAG_LABELS[t]}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {SPICY_LEVEL_LABELS.map((label, level) => (
            <Chip key={level} selected={spicy === level} onClick={() => setSpicy(level)}>
              {level === 0 ? "Non piccante" : label}
            </Chip>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Visibile nel menu", visible, setVisible],
            ["In evidenza in home", featured, setFeatured],
            ["Escluso dagli sconti", noDiscounts, setNoDiscounts],
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
      </Section>

      <Section title="Allergeni">
        <label className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3 text-body-sm">
          <span>
            <span className="block font-semibold">Elenco allergeni verificato</span>
            <span className="block text-caption text-fg-muted">
              Se disattivo, il cliente vede l&apos;invito a contattarci prima di ordinare.
            </span>
          </span>
          <Switch checked={declared} onCheckedChange={setDeclared} />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          {ALLERGENS.map((a) => (
            <div
              key={a}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 ring-1 ring-line"
            >
              <span className="text-body-sm">{ALLERGEN_LABELS[a]}</span>
              <span className="flex gap-1.5">
                <Chip
                  selected={allergens.includes(a)}
                  className="h-8 px-3 text-caption"
                  onClick={() => {
                    setAllergens((l) => toggle(l, a));
                    setMayContain((l) => l.filter((x) => x !== a));
                  }}
                >
                  Contiene
                </Chip>
                <Chip
                  selected={mayContain.includes(a)}
                  className="h-8 px-3 text-caption"
                  onClick={() => {
                    setMayContain((l) => toggle(l, a));
                    setAllergens((l) => l.filter((x) => x !== a));
                  }}
                >
                  Tracce
                </Chip>
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Aggiunte e opzioni">
        {catalog.modifierGroups.length === 0 ? (
          <p className="text-body-sm text-fg-muted">Nessun gruppo di opzioni: creali da “Opzioni”.</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {catalog.modifierGroups.map((g) => (
            <Chip
              key={g.id}
              selected={groups.includes(g.id)}
              onClick={() => setGroups((l) => toggle(l, g.id))}
            >
              {g.name}
            </Chip>
          ))}
        </div>
      </Section>
    </Dialog>
  );
}
