import { modifierGroupInput } from "@dimsum/validation";
import { apiRoute, json } from "@/server/http";
import { saveModifierGroup } from "@/server/services/admin/catalog";

export const POST = apiRoute({ auth: "catalog:edit" }, async ({ body, viewer }) =>
  json(await saveModifierGroup(await body(modifierGroupInput), viewer!), { status: 201 }),
);
