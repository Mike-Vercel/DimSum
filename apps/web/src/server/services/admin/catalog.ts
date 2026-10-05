import "server-only";
import { slugify, upcomingWindows } from "@dimsum/domain";
import type {
  AdminCatalogDTO,
  AdminModifierGroupDTO,
  AdminProductDTO,
  AvailabilityPatchDTO,
} from "@dimsum/types";
import type { availabilityInput, categoryInput, modifierGroupInput, productInput } from "@dimsum/validation";
import type { z } from "zod";
import type { Viewer } from "../../auth/session";
import { audit } from "../../audit";
import { expireTags } from "../../cache";
import { db, type Prisma } from "../../db";
import { AppError, notFound } from "../../errors";
import { processProductPhoto } from "../../images";
import { newPublicId } from "../../ids";
import { publish } from "../../realtime/bus";
import { deleteObject, putObject } from "../../storage";
import { CATALOG_TAG } from "../catalog";
import { loadRestaurantConfig, toScheduleConfig } from "../restaurant";
import { dayStart } from "./time";

const adminProductInclude = {
  images: { orderBy: { position: "asc" } },
  allergens: true,
  variants: { orderBy: { position: "asc" } },
  modifierGroups: { orderBy: { position: "asc" } },
} satisfies Prisma.ProductInclude;

type AdminProductRow = Prisma.ProductGetPayload<{ include: typeof adminProductInclude }>;

function toAdminProduct(p: AdminProductRow): AdminProductDTO {
  return {
    id: p.id,
    categoryId: p.categoryId,
    slug: p.slug,
    name: p.name,
    nameZh: p.nameZh,
    description: p.description,
    descriptionZh: p.descriptionZh,
    ingredients: p.ingredients,
    posCode: p.posCode,
    priceCents: p.priceCents,
    vatRateBps: p.vatRateBps,
    isVisible: p.isVisible,
    isFeatured: p.isFeatured,
    isAvailable: p.isAvailable,
    unavailableUntil: p.unavailableUntil?.toISOString() ?? null,
    tags: p.tags,
    spicyLevel: p.spicyLevel,
    excludedFromDiscounts: p.excludedFromDiscounts,
    allergens: p.allergens.filter((a) => !a.mayContain).map((a) => a.allergen),
    mayContainAllergens: p.allergens.filter((a) => a.mayContain).map((a) => a.allergen),
    allergensDeclared: p.allergensDeclared,
    maxQuantityPerLine: p.maxQuantityPerLine,
    modifierGroupIds: p.modifierGroups.map((g) => g.groupId),
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      priceCents: v.priceCents,
      isAvailable: v.isAvailable,
      isDefault: v.isDefault,
    })),
    images: p.images.map((i) => ({
      id: i.id,
      url: i.url,
      width: i.width,
      height: i.height,
      alt: i.alt,
      blurDataUrl: i.blurDataUrl,
      dominantColor: i.dominantColor,
      backdrop: i.backdrop,
    })),
    position: p.position,
    source: { provider: p.sourceProvider, id: p.sourceId },
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function getAdminCatalog(): Promise<AdminCatalogDTO> {
  const [categories, products, groups] = await Promise.all([
    db.category.findMany({ orderBy: { position: "asc" } }),
    db.product.findMany({
      where: { deletedAt: null },
      include: adminProductInclude,
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    db.modifierGroup.findMany({
      include: { modifiers: { orderBy: { position: "asc" } }, _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    categories: categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      isVisible: c.isVisible,
      position: c.position,
      productIds: products.filter((p) => p.categoryId === c.id).map((p) => p.id),
    })),
    products: Object.fromEntries(products.map((p) => [p.id, toAdminProduct(p)])),
    modifierGroups: groups.map(toAdminGroup),
  };
}

function toAdminGroup(
  g: Prisma.ModifierGroupGetPayload<{ include: { modifiers: true; _count: { select: { products: true } } } }>,
): AdminModifierGroupDTO {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    maxTotalQuantity: g.maxTotalQuantity,
    isActive: g.isActive,
    options: g.modifiers.map((m) => ({
      id: m.id,
      name: m.name,
      priceDeltaCents: m.priceDeltaCents,
      isAvailable: m.isAvailable,
      maxQuantity: m.maxQuantity,
      allergens: m.allergens,
    })),
    productCount: g._count.products,
  };
}

/** Menu changed: expire the cached catalog and tell open menus to reload. */
async function catalogChanged(): Promise<void> {
  expireTags(CATALOG_TAG);
  await publish(["catalog"], { type: "catalog.changed", version: Date.now().toString(36) });
}

/** First service window of the next local day: when "Disponibile nuovamente domani" ends. */
async function backTomorrow(now: Date): Promise<Date> {
  const config = await loadRestaurantConfig();
  const schedule = toScheduleConfig(config);
  const midnight = dayStart(now, config.timezone, 1);
  const starts = (["DELIVERY", "PICKUP"] as const)
    .flatMap((kind) => upcomingWindows(schedule, kind, midnight, 7))
    .map((w) => w.start)
    .filter((s) => s >= midnight)
    .sort((a, b) => a.getTime() - b.getTime());
  return starts[0] ?? midnight;
}

/**
 * "Esaurito" / "Disponibile nuovamente domani" / "Disponibile". Takes effect immediately on every
 * open menu (realtime) and on the next page load (cache expired); carts are re-validated at quote.
 */
export async function setAvailability(
  productIds: string[],
  input: z.output<typeof availabilityInput>,
  actor: Viewer,
): Promise<AvailabilityPatchDTO[]> {
  const now = new Date();
  let until: Date | null = null;
  if (!input.isAvailable && input.until === "tomorrow") until = await backTomorrow(now);
  else if (!input.isAvailable && input.until) until = new Date(input.until);

  // With a comeback time the product turns orderable again on its own (see isAvailableNow).
  const data = input.isAvailable
    ? { isAvailable: true, unavailableUntil: null }
    : { isAvailable: false, unavailableUntil: until };
  const products = await db.product.findMany({
    where: { id: { in: productIds }, deletedAt: null },
    select: { id: true, name: true, isAvailable: true, unavailableUntil: true },
  });
  if (products.length === 0) throw notFound("Prodotto");

  await db.$transaction(async (tx) => {
    await tx.product.updateMany({ where: { id: { in: products.map((p) => p.id) } }, data });
    for (const p of products) {
      await audit(
        {
          actor,
          action: input.isAvailable
            ? "product.available"
            : until
              ? "product.sold_out_until"
              : "product.sold_out",
          entityType: "Product",
          entityId: p.id,
          before: { isAvailable: p.isAvailable, unavailableUntil: p.unavailableUntil },
          after: data,
        },
        tx,
      );
    }
  });

  const patches: AvailabilityPatchDTO[] = products.map((p) => ({
    productId: p.id,
    isAvailable: data.isAvailable,
    availableAgainAt: data.unavailableUntil?.toISOString() ?? null,
  }));
  expireTags(CATALOG_TAG);
  await publish(["catalog"], { type: "catalog.availability", patches });
  return patches;
}

async function uniqueSlug(tx: Prisma.TransactionClient, name: string, exceptId?: string): Promise<string> {
  const base = slugify(name) || "piatto";
  let slug = base;
  for (
    let i = 2;
    await tx.product.findFirst({
      where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    i++
  ) {
    slug = `${base}-${i}`;
  }
  return slug;
}

export async function saveProduct(
  input: z.output<typeof productInput>,
  actor: Viewer,
  productId?: string,
): Promise<AdminProductDTO> {
  if (input.variants.length && !input.variants.some((v) => v.isDefault)) input.variants[0]!.isDefault = true;
  const saved = await db.$transaction(async (tx) => {
    const category = await tx.category.findUnique({ where: { id: input.categoryId }, select: { id: true } });
    if (!category)
      throw new AppError("VALIDATION_FAILED", "Categoria non valida.", {
        fieldErrors: { categoryId: ["Categoria non valida."] },
      });
    const existing = productId
      ? await tx.product.findFirst({
          where: { id: productId, deletedAt: null },
          include: adminProductInclude,
        })
      : null;
    if (productId && !existing) throw notFound("Prodotto");

    const fields = {
      categoryId: input.categoryId,
      name: input.name,
      nameZh: input.nameZh,
      description: input.description,
      descriptionZh: input.descriptionZh,
      ingredients: input.ingredients,
      posCode: input.posCode,
      priceCents: input.variants.length
        ? Math.min(...input.variants.map((v) => v.priceCents))
        : input.priceCents,
      vatRateBps: input.vatRateBps,
      isVisible: input.isVisible,
      isFeatured: input.isFeatured,
      tags: input.tags,
      spicyLevel: input.spicyLevel,
      excludedFromDiscounts: input.excludedFromDiscounts,
      allergensDeclared: input.allergensDeclared || input.allergens.length > 0,
      maxQuantityPerLine: input.maxQuantityPerLine,
    };

    let id: string;
    if (existing) {
      id = existing.id;
      await tx.product.update({
        where: { id },
        data: {
          ...fields,
          ...(existing.name !== input.name ? { slug: await uniqueSlug(tx, input.name, id) } : {}),
        },
      });
    } else {
      const last = await tx.product.aggregate({
        where: { categoryId: input.categoryId },
        _max: { position: true },
      });
      id = (
        await tx.product.create({
          data: {
            ...fields,
            slug: await uniqueSlug(tx, input.name),
            position: (last._max.position ?? -1) + 1,
          },
        })
      ).id;
    }

    await tx.productAllergen.deleteMany({ where: { productId: id } });
    const allergenRows = [
      ...input.allergens.map((allergen) => ({ productId: id, allergen, mayContain: false })),
      ...input.mayContainAllergens
        .filter((a) => !input.allergens.includes(a))
        .map((allergen) => ({ productId: id, allergen, mayContain: true })),
    ];
    if (allergenRows.length) await tx.productAllergen.createMany({ data: allergenRows });

    await tx.productModifierGroup.deleteMany({ where: { productId: id } });
    if (input.modifierGroupIds.length) {
      await tx.productModifierGroup.createMany({
        data: input.modifierGroupIds.map((groupId, position) => ({ productId: id, groupId, position })),
      });
    }

    // Variants keep their ids (order history references them); removed ones are deleted.
    const keep = input.variants.flatMap((v) => (v.id ? [v.id] : []));
    await tx.productVariant.deleteMany({ where: { productId: id, id: { notIn: keep } } });
    for (const [position, v] of input.variants.entries()) {
      const data = {
        name: v.name,
        priceCents: v.priceCents,
        isAvailable: v.isAvailable,
        isDefault: v.isDefault,
        position,
      };
      if (v.id) await tx.productVariant.update({ where: { id: v.id, productId: id }, data });
      else await tx.productVariant.create({ data: { ...data, productId: id } });
    }

    const after = await tx.product.findUniqueOrThrow({ where: { id }, include: adminProductInclude });
    await audit(
      {
        actor,
        action: existing ? "product.updated" : "product.created",
        entityType: "Product",
        entityId: id,
        before: existing ? toAdminProduct(existing) : undefined,
        after: toAdminProduct(after),
      },
      tx,
    );
    return after;
  });
  await catalogChanged();
  return toAdminProduct(saved);
}

/** Removed products disappear from the menu; past orders keep their own copy of name and price. */
export async function deleteProduct(productId: string, actor: Viewer): Promise<void> {
  const p = await db.product.findFirst({ where: { id: productId, deletedAt: null } });
  if (!p) throw notFound("Prodotto");
  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        deletedAt: new Date(),
        isVisible: false,
        slug: `${p.slug}-eliminato-${newPublicId(6).toLowerCase()}`,
      },
    });
    await tx.favorite.deleteMany({ where: { productId } });
    await audit(
      {
        actor,
        action: "product.deleted",
        entityType: "Product",
        entityId: productId,
        before: { name: p.name, slug: p.slug },
      },
      tx,
    );
  });
  await catalogChanged();
}

export async function reorderProducts(categoryId: string, ids: string[], actor: Viewer): Promise<void> {
  await db.$transaction(async (tx) => {
    for (const [position, id] of ids.entries())
      await tx.product.updateMany({ where: { id, categoryId }, data: { position } });
    await audit(
      { actor, action: "products.reordered", entityType: "Category", entityId: categoryId, after: { ids } },
      tx,
    );
  });
  await catalogChanged();
}

/* ---------------------------------------------------------------- categories */

export async function saveCategory(
  input: z.output<typeof categoryInput>,
  actor: Viewer,
  categoryId?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    if (categoryId) {
      const before = await tx.category.findUnique({ where: { id: categoryId } });
      if (!before) throw new AppError("NOT_FOUND", "Categoria non trovata.");
      await tx.category.update({
        where: { id: categoryId },
        data: {
          name: input.name,
          description: input.description,
          isVisible: input.isVisible,
          coverImageId: input.coverImageId,
        },
      });
      await audit(
        {
          actor,
          action: "category.updated",
          entityType: "Category",
          entityId: categoryId,
          before,
          after: input,
        },
        tx,
      );
    } else {
      const base = slugify(input.name) || "categoria";
      let slug = base;
      for (let i = 2; await tx.category.findUnique({ where: { slug }, select: { id: true } }); i++)
        slug = `${base}-${i}`;
      const last = await tx.category.aggregate({ _max: { position: true } });
      const created = await tx.category.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          isVisible: input.isVisible,
          coverImageId: input.coverImageId,
          position: (last._max.position ?? -1) + 1,
        },
      });
      await audit(
        { actor, action: "category.created", entityType: "Category", entityId: created.id, after: input },
        tx,
      );
    }
  });
  await catalogChanged();
}

export async function deleteCategory(categoryId: string, actor: Viewer): Promise<void> {
  const used = await db.product.count({ where: { categoryId, deletedAt: null } });
  if (used > 0) throw new AppError("CONFLICT", "Sposta o elimina prima i prodotti di questa categoria.");
  await db.$transaction(async (tx) => {
    const before = await tx.category.delete({ where: { id: categoryId } });
    await audit(
      { actor, action: "category.deleted", entityType: "Category", entityId: categoryId, before },
      tx,
    );
  });
  await catalogChanged();
}

export async function reorderCategories(ids: string[], actor: Viewer): Promise<void> {
  await db.$transaction(async (tx) => {
    for (const [position, id] of ids.entries())
      await tx.category.update({ where: { id }, data: { position } });
    await audit({ actor, action: "categories.reordered", entityType: "Category", after: { ids } }, tx);
  });
  await catalogChanged();
}

/* ---------------------------------------------------------------- options */

export async function saveModifierGroup(
  input: z.output<typeof modifierGroupInput>,
  actor: Viewer,
  groupId?: string,
): Promise<AdminModifierGroupDTO> {
  const saved = await db.$transaction(async (tx) => {
    const fields = {
      name: input.name,
      description: input.description,
      minSelect: input.minSelect,
      maxSelect: input.maxSelect,
      maxTotalQuantity: input.maxTotalQuantity,
      isActive: input.isActive,
    };
    let id = groupId;
    if (id) {
      const before = await tx.modifierGroup.findUnique({ where: { id }, include: { modifiers: true } });
      if (!before) throw new AppError("NOT_FOUND", "Gruppo di opzioni non trovato.");
      await tx.modifierGroup.update({ where: { id }, data: fields });
      const keep = input.options.flatMap((o) => (o.id ? [o.id] : []));
      await tx.modifier.deleteMany({ where: { groupId: id, id: { notIn: keep } } });
      await audit(
        { actor, action: "options.updated", entityType: "ModifierGroup", entityId: id, before, after: input },
        tx,
      );
    } else {
      id = (await tx.modifierGroup.create({ data: fields })).id;
      await audit(
        { actor, action: "options.created", entityType: "ModifierGroup", entityId: id, after: input },
        tx,
      );
    }
    for (const [position, o] of input.options.entries()) {
      const data = {
        name: o.name,
        priceDeltaCents: o.priceDeltaCents,
        isAvailable: o.isAvailable,
        maxQuantity: o.maxQuantity,
        allergens: o.allergens,
        position,
      };
      if (o.id) await tx.modifier.update({ where: { id: o.id, groupId: id }, data });
      else await tx.modifier.create({ data: { ...data, groupId: id } });
    }
    return tx.modifierGroup.findUniqueOrThrow({
      where: { id },
      include: { modifiers: { orderBy: { position: "asc" } }, _count: { select: { products: true } } },
    });
  });
  await catalogChanged();
  return toAdminGroup(saved);
}

/* ---------------------------------------------------------------- photos */

export async function uploadProductPhoto(
  productId: string,
  file: { body: Buffer; alt: string },
  actor: Viewer,
): Promise<AdminProductDTO> {
  const product = await db.product.findFirst({
    where: { id: productId, deletedAt: null },
    include: { images: true },
  });
  if (!product) throw notFound("Prodotto");
  const image = await processProductPhoto(file.body);
  const key = `products/${product.slug}-${newPublicId(8).toLowerCase()}.webp`;
  const stored = await putObject(key, image.body, "image/webp");
  const saved = await db.$transaction(async (tx) => {
    // The new photo becomes the cover; older ones stay available below it.
    await tx.productImage.updateMany({ where: { productId }, data: { position: { increment: 1 } } });
    const created = await tx.productImage.create({
      data: {
        productId,
        url: stored.url,
        storageKey: stored.key,
        width: image.width,
        height: image.height,
        alt: file.alt,
        blurDataUrl: image.blurDataUrl,
        dominantColor: image.dominantColor,
        backdrop: image.backdrop,
        position: 0,
      },
    });
    await audit(
      {
        actor,
        action: "product.photo_added",
        entityType: "Product",
        entityId: productId,
        after: { imageId: created.id, url: stored.url },
      },
      tx,
    );
    return tx.product.findUniqueOrThrow({ where: { id: productId }, include: adminProductInclude });
  });
  await catalogChanged();
  return toAdminProduct(saved);
}

export async function deleteProductPhoto(
  productId: string,
  imageId: string,
  actor: Viewer,
): Promise<AdminProductDTO> {
  const image = await db.productImage.findFirst({ where: { id: imageId, productId } });
  if (!image) throw new AppError("NOT_FOUND", "Foto non trovata.");
  const saved = await db.$transaction(async (tx) => {
    await tx.productImage.delete({ where: { id: imageId } });
    await audit(
      {
        actor,
        action: "product.photo_removed",
        entityType: "Product",
        entityId: productId,
        before: { imageId, url: image.url },
      },
      tx,
    );
    return tx.product.findUniqueOrThrow({ where: { id: productId }, include: adminProductInclude });
  });
  // Only uploaded photos live in object storage; imported menu photos ship with the app.
  if (image.storageKey) await deleteObject(image.storageKey);
  await catalogChanged();
  return toAdminProduct(saved);
}
