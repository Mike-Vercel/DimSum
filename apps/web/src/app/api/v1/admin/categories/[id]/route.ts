import { categoryInput } from "@dimsum/validation";
import { apiRoute, parseId } from "@/server/http";
import { deleteCategory, getAdminCatalog, saveCategory } from "@/server/services/admin/catalog";

export const PUT = apiRoute<{ id: string }>({ auth: "catalog:edit" }, async ({ params, body, viewer }) => {
  await saveCategory(await body(categoryInput), viewer!, parseId(params.id, "Categoria"));
  return getAdminCatalog();
});

export const DELETE = apiRoute<{ id: string }>({ auth: "catalog:edit" }, async ({ params, viewer }) => {
  await deleteCategory(parseId(params.id, "Categoria"), viewer!);
  return getAdminCatalog();
});
