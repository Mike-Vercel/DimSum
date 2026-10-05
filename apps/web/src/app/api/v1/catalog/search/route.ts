import { searchCatalog } from "@dimsum/domain";
import { productSearchQuery } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { getCatalog } from "@/server/services/catalog";

/** Server-side search with the same typo-tolerant engine the web client runs locally. */
export const GET = apiRoute(
  { auth: "public", rateLimit: { name: "search", limit: 120, windowSeconds: 60 } },
  async ({ query }) => {
    const { q } = query(productSearchQuery);
    const catalog = await getCatalog();
    const categoryName = new Map(catalog.categories.map((c) => [c.id, c.name]));
    const docs = Object.values(catalog.products).map((p) => ({
      id: p.id,
      name: p.name,
      nameZh: p.nameZh,
      description: p.description,
      ingredients: p.ingredients,
      categoryName: categoryName.get(p.categoryId) ?? "",
      posCode: p.posCode,
    }));
    const results = searchCatalog(docs, q, 40).map((h) => catalog.products[h.id]!);
    return { results };
  },
);
