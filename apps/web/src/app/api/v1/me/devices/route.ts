import { deviceTokenInput } from "@dimsum/validation";
import { z } from "zod";
import { db } from "@/server/db";
import { apiRoute } from "@/server/http";

/** Native app push tokens (APNs / FCM), registered by the future iOS and Android apps. */
export const POST = apiRoute(
  { auth: "user", rateLimit: { name: "devices", limit: 20, windowSeconds: 300, by: "user" } },
  async ({ viewer, body }) => {
    const input = await body(deviceTokenInput);
    await db.deviceToken.upsert({
      where: { token: input.token },
      create: {
        userId: viewer!.userId,
        platform: input.platform,
        token: input.token,
        appVersion: input.appVersion,
      },
      update: {
        userId: viewer!.userId,
        platform: input.platform,
        appVersion: input.appVersion,
        lastSeenAt: new Date(),
      },
    });
    return { ok: true };
  },
);

export const DELETE = apiRoute({ auth: "user" }, async ({ viewer, query }) => {
  const { token } = query(z.object({ token: z.string().min(10).max(400) }));
  await db.deviceToken.deleteMany({ where: { token, userId: viewer!.userId } });
  return { ok: true };
});
