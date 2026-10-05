import { notificationsReadRequest } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { markNotificationsRead } from "@/server/services/inbox";

export const POST = apiRoute({ auth: "user" }, async ({ viewer, body }) => {
  await markNotificationsRead(viewer!.userId, await body(notificationsReadRequest));
  return { ok: true };
});
