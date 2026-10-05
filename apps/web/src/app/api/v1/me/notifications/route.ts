import { z } from "zod";
import { apiRoute } from "@/server/http";
import { listNotifications } from "@/server/services/inbox";

const query = z.object({ cursor: z.uuid().optional() });

export const GET = apiRoute({ auth: "user" }, async ({ viewer, query: parse }) =>
  listNotifications(viewer!.userId, parse(query).cursor),
);
