import { apiRoute, parseId } from "@/server/http";
import { removeClosure } from "@/server/services/admin/settings";

export const DELETE = apiRoute<{ id: string }>({ auth: "hours:edit" }, async ({ params, viewer }) =>
  removeClosure(parseId(params.id, "Chiusura"), viewer!),
);
