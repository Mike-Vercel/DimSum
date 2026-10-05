import { closureInput } from "@dimsum/validation";
import { apiRoute, json } from "@/server/http";
import { addClosure } from "@/server/services/admin/settings";

export const POST = apiRoute({ auth: "hours:edit" }, async ({ body, viewer }) =>
  json(await addClosure(await body(closureInput), viewer!), { status: 201 }),
);
