import { deliveryZoneInput } from "@dimsum/validation";
import { apiRoute, json } from "@/server/http";
import { listZones, saveZone } from "@/server/services/admin/settings";

export const GET = apiRoute({ auth: "orders:read" }, async () => ({ zones: await listZones() }));

export const POST = apiRoute({ auth: "zones:edit" }, async ({ body, viewer }) =>
  json(await saveZone(await body(deliveryZoneInput), viewer!), { status: 201 }),
);
