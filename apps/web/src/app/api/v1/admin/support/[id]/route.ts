import { supportStatusInput } from "@dimsum/validation";
import { apiRoute, parseId } from "@/server/http";
import { getTicket, setTicketStatus } from "@/server/services/admin/support";

export const GET = apiRoute<{ id: string }>({ auth: "support:manage" }, async ({ params }) =>
  getTicket(parseId(params.id, "Ticket")),
);

export const PATCH = apiRoute<{ id: string }>({ auth: "support:manage" }, async ({ params, body, viewer }) =>
  setTicketStatus(parseId(params.id, "Ticket"), (await body(supportStatusInput)).status, viewer!),
);
