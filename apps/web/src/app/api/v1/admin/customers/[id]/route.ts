import { apiRoute, parseId } from "@/server/http";
import { getCustomer } from "@/server/services/admin/team";

export const GET = apiRoute<{ id: string }>({ auth: "customers:read" }, async ({ params }) =>
  getCustomer(parseId(params.id, "Cliente")),
);
