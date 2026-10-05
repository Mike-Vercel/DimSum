import { reorderInput } from "@dimsum/validation";
import { apiRoute, parseId } from "@/server/http";
import { getAdminCatalog, reorderProducts } from "@/server/services/admin/catalog";

/** New order of the products inside a category. */
export const PUT = apiRoute<{ id: string }>({ auth: "catalog:edit" }, async ({ params, body, viewer }) => {
  await reorderProducts(parseId(params.id, "Categoria"), (await body(reorderInput)).ids, viewer!);
  return getAdminCatalog();
});
