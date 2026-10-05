import { apiRoute } from "@/server/http";
import { listFavorites } from "@/server/services/account";

export const GET = apiRoute({ auth: "user" }, async ({ viewer }) => ({
  productIds: await listFavorites(viewer!.userId),
}));
