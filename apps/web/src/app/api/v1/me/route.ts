import { deleteAccountRequest, updateProfile } from "@dimsum/validation";
import { apiRoute, json } from "@/server/http";
import { env } from "@/server/env";
import { deleteMyAccount, getMe, updateMe } from "@/server/services/account";

export const GET = apiRoute({ auth: "user" }, async ({ viewer }) => getMe(viewer!.userId));

export const PATCH = apiRoute(
  { auth: "user", rateLimit: { name: "me-update", limit: 20, windowSeconds: 300, by: "user" } },
  async ({ viewer, body }) => updateMe(viewer!.userId, await body(updateProfile)),
);

const AUTH_COOKIES = ["session_token", "session_data", "dont_remember"];

/** Deletes the account and signs the browser out immediately (the session cookie cache included). */
export const DELETE = apiRoute(
  { auth: "user", rateLimit: { name: "me-delete", limit: 3, windowSeconds: 3600, by: "user" } },
  async ({ viewer, body, ip, req }) => {
    await body(deleteAccountRequest);
    await deleteMyAccount(viewer!.userId, { ip, userAgent: req.headers.get("user-agent") });
    const res = json({ ok: true });
    const secure = env().NODE_ENV === "production";
    for (const name of AUTH_COOKIES) {
      res.cookies.set(`${secure ? "__Secure-" : ""}dimsum.${name}`, "", {
        maxAge: 0,
        path: "/",
        httpOnly: true,
        secure,
        sameSite: "lax",
      });
    }
    return res;
  },
);
