import { settingsInput } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { getSettings, updateSettings } from "@/server/services/admin/settings";

export const GET = apiRoute({ auth: "settings:edit" }, async () => getSettings());

export const PUT = apiRoute({ auth: "settings:edit" }, async ({ body, viewer }) =>
  updateSettings(await body(settingsInput), viewer!),
);
