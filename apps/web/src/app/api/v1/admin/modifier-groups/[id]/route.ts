import { modifierGroupInput } from "@dimsum/validation";
import { apiRoute, parseId } from "@/server/http";
import { saveModifierGroup } from "@/server/services/admin/catalog";

export const PUT = apiRoute<{ id: string }>({ auth: "catalog:edit" }, async ({ params, body, viewer }) =>
  saveModifierGroup(await body(modifierGroupInput), viewer!, parseId(params.id, "Gruppo")),
);
