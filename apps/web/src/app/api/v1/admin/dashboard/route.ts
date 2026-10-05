import { apiRoute } from "@/server/http";
import { getDashboard } from "@/server/services/admin/reports";

export const GET = apiRoute({ auth: "orders:read" }, async () => getDashboard());
