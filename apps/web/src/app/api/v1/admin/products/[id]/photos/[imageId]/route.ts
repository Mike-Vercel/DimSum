import { apiRoute, parseId } from "@/server/http";
import { deleteProductPhoto } from "@/server/services/admin/catalog";

export const DELETE = apiRoute<{ id: string; imageId: string }>(
  { auth: "catalog:edit" },
  async ({ params, viewer }) =>
    deleteProductPhoto(parseId(params.id, "Prodotto"), parseId(params.imageId, "Foto"), viewer!),
);
