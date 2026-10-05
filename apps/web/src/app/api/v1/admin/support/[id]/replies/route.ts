import { supportReplyInput } from "@dimsum/validation";
import { apiRoute, parseId } from "@/server/http";
import { replyToTicket } from "@/server/services/admin/support";

export const POST = apiRoute<{ id: string }>(
  { auth: "support:manage", rateLimit: { name: "support-reply", limit: 60, windowSeconds: 600, by: "user" } },
  async ({ params, body, viewer }) =>
    replyToTicket(parseId(params.id, "Ticket"), await body(supportReplyInput), viewer!),
);
