import { z } from "zod";
import { apiRoute } from "@/server/http";
import { listTickets } from "@/server/services/admin/support";

const query = z.object({ status: z.enum(["open", "closed"]).optional(), cursor: z.uuid().optional() });

export const GET = apiRoute({ auth: "support:manage" }, async ({ query: parse }) =>
  listTickets(parse(query)),
);
