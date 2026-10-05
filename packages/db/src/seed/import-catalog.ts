/**
 * Imports the real DIMSUM catalog (data/brenvo/catalog.json) into the database.
 *
 *   npm run catalog:import            # creates missing rows, never touches admin edits
 *   npm run catalog:import -- --sync  # also re-applies names, prices and descriptions from the source
 *
 * Rows are matched on (sourceProvider, sourceId), so re-imports never duplicate products.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "../client";
import type { NormalizedCatalog } from "../catalog-source/types";

const here = path.dirname(fileURLToPath(import.meta.url));

export function loadCatalog(): NormalizedCatalog {
  const file = path.resolve(here, "../../data/brenvo/catalog.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as NormalizedCatalog;
}

export interface ImportReport {
  categories: { created: number; updated: number };
  products: { created: number; updated: number };
  modifiers: number;
}

export async function importCatalog(
  db: Database,
  catalog: NormalizedCatalog,
  options: { sync?: boolean } = {},
): Promise<ImportReport> {
  const provider = catalog.source.provider;
  const report: ImportReport = {
    categories: { created: 0, updated: 0 },
    products: { created: 0, updated: 0 },
    modifiers: 0,
  };
  const categoryIds = new Map<string, string>();

  for (const c of catalog.categories) {
    const where = { sourceProvider_sourceId: { sourceProvider: provider, sourceId: c.sourceId } };
    const existing = await db.category.findUnique({ where });
    if (existing) {
      categoryIds.set(c.sourceId, existing.id);
      if (options.sync) {
        await db.category.update({
          where: { id: existing.id },
          data: { name: c.name, position: c.position },
        });
        report.categories.updated++;
      }
      continue;
    }
    const created = await db.category.create({
      data: {
        slug: c.slug,
        name: c.name,
        position: c.position,
        isVisible: c.isVisible,
        sourceProvider: provider,
        sourceId: c.sourceId,
      },
    });
    categoryIds.set(c.sourceId, created.id);
    report.categories.created++;
  }

  const productIdsByCategory = new Map<string, string[]>();
  for (const p of catalog.products) {
    const categoryId = categoryIds.get(p.categorySourceId);
    if (!categoryId) throw new Error(`Unknown category ${p.categorySourceId} for ${p.name}`);
    const where = { sourceProvider_sourceId: { sourceProvider: provider, sourceId: p.sourceId } };
    const sourceData = {
      name: p.sourceName,
      name2: p.sourceName2,
      description: p.sourceDescription,
      importedAt: catalog.source.capturedAt,
    };
    const fromSource = {
      name: p.name,
      nameZh: p.nameZh,
      description: p.description,
      descriptionZh: p.descriptionZh,
      ingredients: p.ingredients,
      posCode: p.posCode,
      priceCents: p.priceCents,
      vatRateBps: p.vatRateBps,
      sourceData,
    };

    let product = await db.product.findUnique({ where });
    if (product) {
      if (options.sync) {
        product = await db.product.update({ where: { id: product.id }, data: fromSource });
        report.products.updated++;
      }
    } else {
      product = await db.product.create({
        data: {
          ...fromSource,
          slug: p.slug,
          categoryId,
          position: p.position,
          isAvailable: p.isAvailable,
          tags: p.tags,
          spicyLevel: p.spicyLevel,
          excludedFromDiscounts: p.excludedFromDiscounts,
          allergensDeclared: p.allergensDeclared,
          sourceProvider: provider,
          sourceId: p.sourceId,
          allergens: { create: p.allergens.map((allergen) => ({ allergen })) },
          images: p.image
            ? {
                create: {
                  url: p.image.url,
                  width: p.image.width,
                  height: p.image.height,
                  alt: p.image.alt,
                  blurDataUrl: p.image.blurDataUrl,
                  dominantColor: p.image.dominantColor,
                  backdrop: p.image.backdrop,
                  sourceUrl: `${provider}:${p.sourceId}`,
                },
              }
            : undefined,
        },
      });
      report.products.created++;
    }
    productIdsByCategory.set(p.categorySourceId, [
      ...(productIdsByCategory.get(p.categorySourceId) ?? []),
      product.id,
    ]);
  }

  for (const g of catalog.modifierGroups) {
    const where = { sourceProvider_sourceId: { sourceProvider: provider, sourceId: g.key } };
    let group = await db.modifierGroup.findUnique({ where });
    if (!group) {
      group = await db.modifierGroup.create({
        data: {
          name: g.name,
          description: g.description,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          maxTotalQuantity: g.maxTotalQuantity,
          sourceProvider: provider,
          sourceId: g.key,
          modifiers: {
            create: g.options.map((o) => ({
              name: o.name,
              priceDeltaCents: o.priceDeltaCents,
              maxQuantity: g.optionMaxQuantity,
              position: o.position,
              sourceProvider: provider,
              sourceId: o.sourceId,
            })),
          },
        },
      });
      report.modifiers += g.options.length;
    }
    for (const categorySourceId of g.attachToCategorySourceIds) {
      for (const productId of productIdsByCategory.get(categorySourceId) ?? []) {
        await db.productModifierGroup.upsert({
          where: { productId_groupId: { productId, groupId: group.id } },
          create: { productId, groupId: group.id, position: 0 },
          update: {},
        });
      }
    }
  }

  return report;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  const { getDb } = await import("../client");
  for (const file of [path.resolve(here, "../../../../.env")])
    if (fs.existsSync(file)) process.loadEnvFile(file);
  const db = getDb();
  const report = await importCatalog(db, loadCatalog(), { sync: process.argv.includes("--sync") });
  console.log("[catalog] import completed", JSON.stringify(report));
  await db.$disconnect();
}
