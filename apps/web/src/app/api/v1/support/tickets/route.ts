import { supportTicketInput } from "@dimsum/validation";
import { apiRoute, json } from "@/server/http";
import { createSupportTicket } from "@/server/services/support";

export const POST = apiRoute(
  { auth: "public", rateLimit: { name: "support", limit: 5, windowSeconds: 600 } },
  async ({ body, viewer }) => {
    const ticket = await createSupportTicket(await body(supportTicketInput), viewer);
    return json(ticket, { status: 201 });
  },
);
