import { riderUpdateInput } from "@dimsum/validation";
import { apiRoute, parseId } from "@/server/http";
import { listRiders, updateRider } from "@/server/services/admin/riders";

export const PATCH = apiRoute<{ id: string }>({ auth: "riders:manage" }, async ({ params, body, viewer }) => {
  await updateRider(parseId(params.id, "Rider"), await body(riderUpdateInput), viewer!);
  return { riders: await listRiders() };
});
