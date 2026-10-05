import { adminOrdersQuery } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { listAdminOrders } from "@/server/services/admin/orders";

export const GET = apiRoute({ auth: "orders:read" }, async ({ query }) =>
  listAdminOrders(query(adminOrdersQuery)),
);
