import { productInput } from "@dimsum/validation";
import { apiRoute, parseId } from "@/server/http";
import { deleteProduct, saveProduct } from "@/server/services/admin/catalog";

export const PUT = apiRoute<{ id: string }>({ auth: "catalog:edit" }, async ({ params, body, viewer }) =>
  saveProduct(await body(productInput), viewer!, parseId(params.id, "Prodotto")),
);

export const DELETE = apiRoute<{ id: string }>({ auth: "catalog:edit" }, async ({ params, viewer }) => {
  await deleteProduct(parseId(params.id, "Prodotto"), viewer!);
  return { ok: true };
});
