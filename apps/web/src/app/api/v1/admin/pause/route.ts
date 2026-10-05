import { pauseOrdersInput } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { getDashboard } from "@/server/services/admin/reports";
import { setOrdersPaused } from "@/server/services/admin/settings";

/** "Blocca ordini" / "Riapri gli ordini". */
export const POST = apiRoute({ auth: "orders:pause" }, async ({ body, viewer }) => {
  await setOrdersPaused(await body(pauseOrdersInput), viewer!);
  return getDashboard();
});
