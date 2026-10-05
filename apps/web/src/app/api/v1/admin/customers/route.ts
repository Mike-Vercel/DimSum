import { listQuery } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { listCustomers } from "@/server/services/admin/team";

export const GET = apiRoute({ auth: "customers:read" }, async ({ query }) => listCustomers(query(listQuery)));
