import { apiRoute } from "@/server/http";
import { scheduleOperations } from "@/server/services/operations";
import { getServiceStatus } from "@/server/services/restaurant";

export const GET = apiRoute({ auth: "public" }, async () => {
  scheduleOperations();
  return getServiceStatus();
});
