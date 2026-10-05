import { z } from "zod";
import { apiRoute } from "@/server/http";
import { listAudit } from "@/server/services/admin/team";

const query = z.object({
  entityType: z.string().max(40).optional(),
  entityId: z.string().max(64).optional(),
  cursor: z.uuid().optional(),
});

export const GET = apiRoute({ auth: "audit:read" }, async ({ query: parse }) => listAudit(parse(query)));
