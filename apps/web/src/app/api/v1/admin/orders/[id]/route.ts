import { apiRoute, parseId } from "@/server/http";
import { getAdminOrder } from "@/server/services/admin/orders";

export const GET = apiRoute<{ id: string }>({ auth: "orders:read" }, async ({ params }) =>
  getAdminOrder(parseId(params.id, "Ordine")),
);
