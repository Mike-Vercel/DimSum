import { apiRoute, json } from "@/server/http";
import { comboInput, listCombos, saveCombo } from "@/server/services/admin/combos";

export const GET = apiRoute({ auth: "catalog:availability" }, async () => ({ combos: await listCombos() }));

export const POST = apiRoute({ auth: "catalog:edit" }, async ({ body, viewer }) =>
  json(await saveCombo(await body(comboInput), viewer!), { status: 201 }),
);
