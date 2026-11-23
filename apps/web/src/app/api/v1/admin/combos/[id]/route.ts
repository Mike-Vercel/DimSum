import { apiRoute, parseId } from "@/server/http";
import { comboInput, deleteCombo, saveCombo } from "@/server/services/admin/combos";

export const PUT = apiRoute<{ id: string }>({ auth: "catalog:edit" }, async ({ params, body, viewer }) =>
  saveCombo(await body(comboInput), viewer!, parseId(params.id, "Combo")),
);

export const DELETE = apiRoute<{ id: string }>({ auth: "catalog:edit" }, async ({ params, viewer }) => {
  await deleteCombo(parseId(params.id, "Combo"), viewer!);
  return { ok: true as const };
});
