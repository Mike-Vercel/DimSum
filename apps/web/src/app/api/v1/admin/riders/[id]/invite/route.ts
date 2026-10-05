import { apiRoute, parseId } from "@/server/http";
import { resendRiderInvite } from "@/server/services/admin/riders";

export const POST = apiRoute<{ id: string }>(
  { auth: "riders:manage", rateLimit: { name: "team-invite", limit: 5, windowSeconds: 3600, by: "user" } },
  async ({ params }) => {
    await resendRiderInvite(parseId(params.id, "Rider"));
    return { ok: true };
  },
);
