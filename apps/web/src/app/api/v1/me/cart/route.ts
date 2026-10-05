import { accountCartSync } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { getAccountCart, saveAccountCart } from "@/server/services/account";

export const GET = apiRoute({ auth: "user" }, async ({ viewer }) => getAccountCart(viewer!.userId));

export const PUT = apiRoute(
  { auth: "user", rateLimit: { name: "cart-sync", limit: 120, windowSeconds: 60, by: "user" } },
  async ({ viewer, body }) => {
    await saveAccountCart(viewer!.userId, await body(accountCartSync));
    return { ok: true };
  },
);
