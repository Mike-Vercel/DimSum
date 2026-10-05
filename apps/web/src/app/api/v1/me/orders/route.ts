import { z } from "zod";
import { apiRoute } from "@/server/http";
import { listMyOrders } from "@/server/services/account";

const query = z.object({
  status: z.enum(["active", "history", "all"]).default("all"),
  cursor: z.uuid().optional(),
});

export const GET = apiRoute({ auth: "user" }, async ({ viewer, query: parse }) =>
  listMyOrders(viewer!.userId, parse(query)),
);
