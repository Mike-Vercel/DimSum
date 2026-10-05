import { deliveryZoneInput } from "@dimsum/validation";
import { apiRoute, parseId } from "@/server/http";
import { deleteZone, saveZone } from "@/server/services/admin/settings";

export const PUT = apiRoute<{ id: string }>({ auth: "zones:edit" }, async ({ params, body, viewer }) =>
  saveZone(await body(deliveryZoneInput), viewer!, parseId(params.id, "Zona")),
);

export const DELETE = apiRoute<{ id: string }>({ auth: "zones:edit" }, async ({ params, viewer }) => {
  await deleteZone(parseId(params.id, "Zona"), viewer!);
  return { ok: true };
});
