import "server-only";
import type { AdminComboDTO, Allergen, ProductTag } from "@dimsum/types";
import { z } from "zod";
import type { Viewer } from "../../auth/session";
import { audit } from "../../audit";
import { db } from "../../db";
import { AppError, notFound } from "../../errors";
import { newPublicId } from "../../ids";
import { ownPriceCents, toImageDTO } from "../catalog";
import { catalogChanged, uniqueSlug } from "./catalog";

/**
 * Combos: several dishes at a special price. A combo is a product (so cart, checkout, kitchen,
 * receipts and photos work as for any dish) flagged `isCombo`, in the "Combo" menu category, with
 * its contents in ComboItem. Allergens, vegetarian/vegan, spiciness and alcohol come from the dishes
 * inside, so they can never be forgotten.
 */

const COMBO_CATEGORY = { slug: "combo", name: "Combo" };

export const comboInput = z.object({
  name: z.string().trim().min(2, { error: "Dai un nome alla combo." }).max(80),
  description: z.string().trim().max(300).nullable().default(null),
  priceCents: z.number().int().min(50, { error: "Prezzo non valido." }).max(50_000),
  isVisible: z.boolean().default(true),
  items: z
    .array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(10) }))
    .min(2, { error: "Una combo ha almeno due piatti." })
    .max(12),
});

const comboInclude = {
  images: { orderBy: { position: "asc" as const }, take: 1 },
  comboItems: {
    orderBy: { position: "asc" as const },
    include: {
      product: {
        select: {
          name: true,
          priceCents: true,
          isAvailable: true,
          deletedAt: true,
          variants: { select: { priceCents: true } },
          images: { orderBy: { position: "asc" as const }, take: 1 },
        },
      },
    },
  },
};

type ComboRow = Awaited<ReturnType<typeof loadCombo>>;

async function loadCombo(id: string) {
  return db.product.findFirstOrThrow({ where: { id, isCombo: true, deletedAt: null }, include: comboInclude });
}

function toAdminCombo(p: NonNullable<ComboRow>): AdminComboDTO {
  const items = p.comboItems.map((i) => ({
    productId: i.productId,
    name: i.product.name,
    quantity: i.quantity,
    priceCents: ownPriceCents(i.product),
    image: toImageDTO(i.product.images[0]),
    isAvailable: i.product.isAvailable && !i.product.deletedAt,
  }));
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    valueCents: items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
    isVisible: p.isVisible,
    isAvailable: p.isAvailable && items.every((i) => i.isAvailable),
    image: toImageDTO(p.images[0]),
    items,
  };
}

export async function listCombos(): Promise<AdminComboDTO[]> {
  const rows = await db.product.findMany({
    where: { isCombo: true, deletedAt: null },
    include: comboInclude,
    orderBy: { position: "asc" },
  });
  return rows.map(toAdminCombo);
}

export async function saveCombo(
  input: z.output<typeof comboInput>,
  actor: Viewer,
  comboId?: string,
): Promise<AdminComboDTO> {
  const ids = [...new Set(input.items.map((i) => i.productId))];
  const dishes = await db.product.findMany({
    where: { id: { in: ids }, deletedAt: null, isCombo: false },
    include: { allergens: true },
  });
  if (dishes.length !== ids.length)
    throw new AppError("VALIDATION_FAILED", "Uno dei piatti scelti non è più nel menu.", {
      fieldErrors: { items: ["Piatto non valido."] },
    });
  const byId = new Map(dishes.map((d) => [d.id, d]));
  const items = input.items.map((i) => ({ ...i, dish: byId.get(i.productId)! }));

  // What the dishes say, the combo says.
  const allergens = [
    ...new Set(items.flatMap((i) => i.dish.allergens.filter((a) => !a.mayContain).map((a) => a.allergen))),
  ] as Allergen[];
  const mayContain = [
    ...new Set(items.flatMap((i) => i.dish.allergens.filter((a) => a.mayContain).map((a) => a.allergen))),
  ].filter((a) => !allergens.includes(a)) as Allergen[];
  const every = (tag: ProductTag) => items.every((i) => i.dish.tags.includes(tag));
  const some = (tag: ProductTag) => items.some((i) => i.dish.tags.includes(tag));
  const tags: ProductTag[] = [
    ...(every("VEGAN") ? (["VEGAN"] as const) : []),
    ...(every("VEGETARIAN") || every("VEGAN") ? (["VEGETARIAN"] as const) : []),
    ...(some("SPICY") ? (["SPICY"] as const) : []),
    ...(some("ALCOHOLIC") ? (["ALCOHOLIC"] as const) : []),
    ...(some("CONTAINS_COLOURANTS") ? (["CONTAINS_COLOURANTS"] as const) : []),
  ];
  const valueCents = items.reduce((sum, i) => sum + ownPriceCents({ ...i.dish, variants: [] }) * i.quantity, 0);
  if (input.priceCents >= valueCents && valueCents > 0)
    throw new AppError(
      "VALIDATION_FAILED",
      "Il prezzo della combo deve essere più basso dei piatti presi da soli.",
      { fieldErrors: { priceCents: ["Più basso del totale dei piatti."] } },
    );

  const saved = await db.$transaction(async (tx) => {
    const category =
      (await tx.category.findUnique({ where: { slug: COMBO_CATEGORY.slug } })) ??
      (await tx.category.create({
        // First in the menu: combos are the best value.
        data: { ...COMBO_CATEGORY, position: -1, description: "Più piatti, un prezzo speciale." },
      }));
    const existing = comboId
      ? await tx.product.findFirst({ where: { id: comboId, isCombo: true, deletedAt: null } })
      : null;
    if (comboId && !existing) throw notFound("Combo");

    const fields = {
      categoryId: category.id,
      name: input.name,
      description: input.description,
      ingredients: items.map((i) => `${i.quantity}× ${i.dish.name}`),
      priceCents: input.priceCents,
      vatRateBps: Math.max(...items.map((i) => i.dish.vatRateBps)),
      isVisible: input.isVisible,
      tags,
      spicyLevel: Math.max(0, ...items.map((i) => i.dish.spicyLevel)),
      allergensDeclared: items.every((i) => i.dish.allergensDeclared),
      // A combo is already a special price: no extra discount on top.
      excludedFromDiscounts: true,
      maxQuantityPerLine: 10,
      isCombo: true,
    };
    let id: string;
    if (existing) {
      id = existing.id;
      await tx.product.update({
        where: { id },
        data: { ...fields, ...(existing.name !== input.name ? { slug: await uniqueSlug(tx, input.name, id) } : {}) },
      });
    } else {
      const last = await tx.product.aggregate({ where: { categoryId: category.id }, _max: { position: true } });
      id = (
        await tx.product.create({
          data: { ...fields, slug: await uniqueSlug(tx, input.name), position: (last._max.position ?? -1) + 1 },
        })
      ).id;
    }
    await tx.comboItem.deleteMany({ where: { comboId: id } });
    await tx.comboItem.createMany({
      data: items.map((i, position) => ({ comboId: id, productId: i.productId, quantity: i.quantity, position })),
    });
    await tx.productAllergen.deleteMany({ where: { productId: id } });
    const allergenRows = [
      ...allergens.map((allergen) => ({ productId: id, allergen, mayContain: false })),
      ...mayContain.map((allergen) => ({ productId: id, allergen, mayContain: true })),
    ];
    if (allergenRows.length) await tx.productAllergen.createMany({ data: allergenRows });
    await audit(
      {
        actor,
        action: existing ? "combo.updated" : "combo.created",
        entityType: "Product",
        entityId: id,
        after: { name: input.name, priceCents: input.priceCents, items: input.items },
      },
      tx,
    );
    return id;
  });
  await catalogChanged();
  return toAdminCombo(await loadCombo(saved));
}

export async function deleteCombo(comboId: string, actor: Viewer): Promise<void> {
  const p = await db.product.findFirst({ where: { id: comboId, isCombo: true, deletedAt: null } });
  if (!p) throw notFound("Combo");
  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: comboId },
      data: { deletedAt: new Date(), isVisible: false, slug: `${p.slug}-eliminato-${newPublicId(6).toLowerCase()}` },
    });
    await tx.favorite.deleteMany({ where: { productId: comboId } });
    await audit({ actor, action: "combo.deleted", entityType: "Product", entityId: comboId, before: { name: p.name } }, tx);
  });
  await catalogChanged();
}
