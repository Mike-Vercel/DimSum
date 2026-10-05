import { savedAddressInput } from "@dimsum/validation";
import { apiRoute, json } from "@/server/http";
import { createAddress, listAddresses } from "@/server/services/account";

export const GET = apiRoute({ auth: "user" }, async ({ viewer }) => ({
  addresses: await listAddresses(viewer!.userId),
}));

export const POST = apiRoute(
  { auth: "user", rateLimit: { name: "addresses", limit: 30, windowSeconds: 300, by: "user" } },
  async ({ viewer, body }) =>
    json(await createAddress(viewer!.userId, await body(savedAddressInput)), { status: 201 }),
);
