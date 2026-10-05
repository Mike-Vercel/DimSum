import { productInput } from "@dimsum/validation";
import { apiRoute, json } from "@/server/http";
import { saveProduct } from "@/server/services/admin/catalog";

export const POST = apiRoute({ auth: "catalog:edit" }, async ({ body, viewer }) =>
  json(await saveProduct(await body(productInput), viewer!), { status: 201 }),
);
