import { apiRoute } from "@/server/http";
import { getServiceStatus } from "@/server/services/restaurant";

export const GET = apiRoute({ auth: "public" }, async () => getServiceStatus());
