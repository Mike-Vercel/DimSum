import { updateConsents } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { updateMyConsents } from "@/server/services/account";

export const PUT = apiRoute(
  { auth: "user", rateLimit: { name: "consents", limit: 30, windowSeconds: 300, by: "user" } },
  async ({ viewer, body, ip, req }) => {
    const { consents, source } = await body(updateConsents);
    return updateMyConsents(viewer!.userId, consents, {
      ip,
      userAgent: req.headers.get("user-agent"),
      source,
    });
  },
);
