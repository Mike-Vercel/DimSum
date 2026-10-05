import { staffUpdateInput } from "@dimsum/validation";
import { apiRoute, parseId } from "@/server/http";
import { listStaff, updateStaff } from "@/server/services/admin/team";

export const PATCH = apiRoute<{ id: string }>({ auth: "staff:manage" }, async ({ params, body, viewer }) => {
  await updateStaff(parseId(params.id, "Account"), await body(staffUpdateInput), viewer!);
  return { staff: await listStaff() };
});
