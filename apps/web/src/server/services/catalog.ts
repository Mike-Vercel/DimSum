import "server-only";
import type { CatalogDTO, CategoryDTO, ImageDTO, ProductDTO } from "@dimsum/types";
import { cacheLife, cacheTag } from "next/cache";
import { db, type Prisma } from "../db";

export const CATALOG_TAG = "catalog";

const productInclude = {
  images: { orderBy: { position: "asc" }, take: 1 },
  allergens: true,
  variants: { orderBy: { position: "asc" } },
  modifierGroups: {
    orderBy: { position: "asc" },
    include: { group: { include: { modifiers: { orderBy: { position: "asc" } } } } },
  },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
type ImageRow = ProductRow["images"][number];

export function toImageDTO(image: ImageRow | null | undefined): ImageDTO | null {
  if (!image) return null;
  return {
    url: image.url,
    width: image.width,
    height: image.height,
    alt: image.alt,
    blurDataUrl: image.blurDataUrl,
    dominantColor: image.dominantColor,
    backdrop: image.backdrop,
  };
}

export function toProductDTO(p: ProductRow): ProductDTO {
  return {
    id: p.id,
    slug: p.slug,
    categoryId: p.categoryId,
    name: p.name,
    nameZh: p.nameZh,
    description: p.description,
    descriptionZh: p.descriptionZh,
    ingredients: p.ingredients,
    posCode: p.posCode,
    priceCents: p.priceCents,
    image: toImageDTO(p.images[0]),
    allergens: p.allergens.filter((a) => !a.mayContain).map((a) => a.allergen),
    allergensDeclared: p.allergensDeclared,
    tags: p.tags,
    spicyLevel: Math.min(3, Math.max(0, p.spicyLevel)) as 0 | 1 | 2 | 3,
    isAvailable: p.isAvailable,
    availableAgainAt: p.isAvailable ? null : (p.unavailableUntil?.toISOString() ?? null),
    isFeatured: p.isFeatured,
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      priceCents: v.priceCents,
      isAvailable: v.isAvailable,
    })),
    modifierGroups: p.modifierGroups
      .filter((pg) => pg.group.isActive)
      .map(({ group }) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        maxTotalQuantity: group.maxTotalQuantity,
        options: group.modifiers.map((m) => ({
          id: m.id,
          name: m.name,
          priceDeltaCents: m.priceDeltaCents,
          isAvailable: m.isAvailable,
          maxQuantity: m.maxQuantity,
        })),
      })),
    excludedFromDiscounts: p.excludedFromDiscounts,
  };
}

async function loadBestsellerIds(visibleIds: Set<string>): Promise<string[]> {
  const rows = await db.$queryRaw<{ productId: string; qty: bigint }[]>`
    SELECT oi."productId", SUM(oi."quantity") AS qty
    FROM "order_items" oi
    JOIN "orders" o ON o."id" = oi."orderId"
    WHERE o."placedAt" > now() - interval '30 days'
      AND o."status" NOT IN ('PENDING_PAYMENT', 'CANCELLED', 'REFUNDED')
      AND oi."productId" IS NOT NULL
    GROUP BY oi."productId"
    ORDER BY qty DESC
    LIMIT 16`;
  return rows.map((r) => r.productId).filter((id) => visibleIds.has(id));
}

/**
 * Full public catalog. Cached and shared by every visitor; invalidated by admin edits through
 * revalidateTag(CATALOG_TAG). Availability is also pushed live over the realtime channel.
 */
export async function getCatalog(): Promise<CatalogDTO> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const categories = await db.category.findMany({
    where: { isVisible: true },
    orderBy: { position: "asc" },
    include: {
      coverImage: true,
      products: {
        where: { isVisible: true, deletedAt: null },
        orderBy: { position: "asc" },
        include: productInclude,
      },
    },
  });

  const products: Record<string, ProductDTO> = {};
  const categoryDTOs: CategoryDTO[] = [];
  for (const c of categories) {
    if (c.products.length === 0) continue;
    for (const p of c.products) products[p.id] = toProductDTO(p);
    categoryDTOs.push({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      image: toImageDTO(c.coverImage) ?? toImageDTO(c.products.find((p) => p.images[0])?.images[0]),
      productIds: c.products.map((p) => p.id),
    });
  }

  const visible = new Set(Object.keys(products));
  const sold = await loadBestsellerIds(visible);
  const featured = Object.values(products)
    .filter((p) => p.isFeatured && !sold.includes(p.id))
    .map((p) => p.id);
  const stamp = await db.product.aggregate({ _max: { updatedAt: true } });

  return {
    categories: categoryDTOs,
    products,
    bestsellerIds: [...sold, ...featured].slice(0, 12),
    version: String(stamp._max.updatedAt?.getTime() ?? 0),
  };
}

export async function getProductBySlug(
  slug: string,
): Promise<{ product: ProductDTO; category: CategoryDTO } | null> {
  const catalog = await getCatalog();
  const product = Object.values(catalog.products).find((p) => p.slug === slug);
  if (!product) return null;
  const category = catalog.categories.find((c) => c.id === product.categoryId);
  return category ? { product, category } : null;
}

/** Uncached read used by quotes and checkout: prices and availability must be current. */
export async function loadProductsForPricing(ids: string[]) {
  if (ids.length === 0) return [];
  return db.product.findMany({
    where: { id: { in: [...new Set(ids)] }, deletedAt: null },
    include: {
      allergens: true,
      variants: true,
      images: { orderBy: { position: "asc" }, take: 1 },
      modifierGroups: { include: { group: { include: { modifiers: true } } } },
    },
  });
}

export type PricingProductRow = Awaited<ReturnType<typeof loadProductsForPricing>>[number];
