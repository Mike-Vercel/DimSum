import { riderInput } from "@dimsum/validation";
import { apiRoute, json } from "@/server/http";
import { createRider, listRiders } from "@/server/services/admin/riders";

export const GET = apiRoute({ auth: "riders:assign" }, async () => ({ riders: await listRiders() }));

export const POST = apiRoute(
  { auth: "riders:manage", rateLimit: { name: "team-create", limit: 20, windowSeconds: 3600, by: "user" } },
  async ({ body, viewer }) => json(await createRider(await body(riderInput), viewer!), { status: 201 }),
);
