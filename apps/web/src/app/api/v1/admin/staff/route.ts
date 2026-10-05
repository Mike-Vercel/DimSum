import { staffInput } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { createStaff, listStaff } from "@/server/services/admin/team";

export const GET = apiRoute({ auth: "staff:manage" }, async () => ({ staff: await listStaff() }));

export const POST = apiRoute(
  { auth: "staff:manage", rateLimit: { name: "team-create", limit: 20, windowSeconds: 3600, by: "user" } },
  async ({ body, viewer }) => {
    await createStaff(await body(staffInput), viewer!);
    return { staff: await listStaff() };
  },
);
