import { categoryInput } from "@dimsum/validation";
import { apiRoute, json } from "@/server/http";
import { getAdminCatalog, saveCategory } from "@/server/services/admin/catalog";

export const POST = apiRoute({ auth: "catalog:edit" }, async ({ body, viewer }) => {
  await saveCategory(await body(categoryInput), viewer!);
  return json(await getAdminCatalog(), { status: 201 });
});
