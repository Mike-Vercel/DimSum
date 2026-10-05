import { savedAddressInput } from "@dimsum/validation";
import { apiRoute, parseId } from "@/server/http";
import { deleteAddress, updateAddress } from "@/server/services/account";

export const PUT = apiRoute<{ id: string }>(
  { auth: "user", rateLimit: { name: "addresses", limit: 30, windowSeconds: 300, by: "user" } },
  async ({ viewer, params, body }) =>
    updateAddress(viewer!.userId, parseId(params.id, "Indirizzo"), await body(savedAddressInput)),
);

export const DELETE = apiRoute<{ id: string }>({ auth: "user" }, async ({ viewer, params }) => {
  await deleteAddress(viewer!.userId, parseId(params.id, "Indirizzo"));
  return { ok: true };
});
