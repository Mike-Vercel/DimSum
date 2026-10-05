import { apiRoute, parseId } from "@/server/http";
import { reorder } from "@/server/services/account";

export const POST = apiRoute<{ id: string }>(
  { auth: "user", rateLimit: { name: "reorder", limit: 20, windowSeconds: 60, by: "user" } },
  async ({ viewer, params }) => reorder(viewer!.userId, parseId(params.id, "Ordine")),
);
