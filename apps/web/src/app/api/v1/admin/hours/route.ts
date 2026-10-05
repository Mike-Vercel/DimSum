import { openingHoursInput } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { getHours, replaceHours } from "@/server/services/admin/settings";

export const GET = apiRoute({ auth: "orders:read" }, async () => getHours());

/** Replaces the weekly hours of one kind (locale, consegna or ritiro). */
export const PUT = apiRoute({ auth: "hours:edit" }, async ({ body, viewer }) =>
  replaceHours(await body(openingHoursInput), viewer!),
);
