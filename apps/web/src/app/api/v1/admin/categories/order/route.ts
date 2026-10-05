import { reorderInput } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { getAdminCatalog, reorderCategories } from "@/server/services/admin/catalog";

export const PUT = apiRoute({ auth: "catalog:edit" }, async ({ body, viewer }) => {
  await reorderCategories((await body(reorderInput)).ids, viewer!);
  return getAdminCatalog();
});
