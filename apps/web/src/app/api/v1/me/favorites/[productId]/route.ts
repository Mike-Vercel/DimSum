import { apiRoute, parseId } from "@/server/http";
import { addFavorite, removeFavorite } from "@/server/services/account";

const limits = { name: "favorites", limit: 60, windowSeconds: 60, by: "user" } as const;

export const PUT = apiRoute<{ productId: string }>(
  { auth: "user", rateLimit: limits },
  async ({ viewer, params }) => {
    await addFavorite(viewer!.userId, parseId(params.productId, "Prodotto"));
    return { ok: true };
  },
);

export const DELETE = apiRoute<{ productId: string }>(
  { auth: "user", rateLimit: limits },
  async ({ viewer, params }) => {
    await removeFavorite(viewer!.userId, parseId(params.productId, "Prodotto"));
    return { ok: true };
  },
);
