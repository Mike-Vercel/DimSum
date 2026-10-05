import "server-only";
import { firstNameOf } from "@dimsum/domain";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins";
import { getDb } from "../db";
import {
  brandContext,
  passwordResetEmail,
  sendEmail,
  teamInviteEmail,
  verifyEmailEmail,
  welcomeEmail,
} from "../email";
import { appUrl, env, features } from "../env";
import { logger } from "../logger";
import { ensureCustomerRecords, linkGuestOrders } from "../services/customers";
import { awardSignupBonus } from "../services/loyalty";

const ROLE_LABELS: Record<string, string> = {
  RIDER: "rider",
  STAFF: "staff",
  ADMIN: "amministratore",
  SUPER_ADMIN: "titolare",
};

function createAuth() {
  const e = env();
  const f = features();
  const secure = e.NODE_ENV === "production";

  return betterAuth({
    appName: "DIMSUM",
    baseURL: e.BETTER_AUTH_URL ?? e.APP_URL,
    basePath: "/api/auth",
    secret: e.BETTER_AUTH_SECRET,
    database: prismaAdapter(getDb(), { provider: "postgresql" }),
    trustedOrigins: [e.APP_URL, "dimsum://"],

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: true,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 3600,
      sendResetPassword: async ({ user, url }) => {
        // A team account that never signed in is receiving its invitation, not a reset.
        const u = await getDb().user.findUnique({
          where: { id: user.id },
          select: { role: true, _count: { select: { sessions: true } } },
        });
        const invite = !!u && u.role !== "CUSTOMER" && u._count.sessions === 0;
        const brand = await brandContext();
        const firstName = firstNameOf(user.name);
        await sendEmail({
          to: user.email,
          email: invite
            ? teamInviteEmail(brand, { firstName, url, roleLabel: ROLE_LABELS[u.role] ?? "del team" })
            : passwordResetEmail(brand, { firstName, url }),
        });
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          email: verifyEmailEmail(await brandContext(), { firstName: firstNameOf(user.name), url }),
        });
      },
      afterEmailVerification: async (user) => {
        await linkGuestOrders(user.id, user.email);
        await awardSignupBonus(user.id);
      },
    },

    socialProviders: {
      ...(f.googleAuth
        ? {
            google: {
              clientId: e.GOOGLE_CLIENT_ID!,
              clientSecret: e.GOOGLE_CLIENT_SECRET!,
              prompt: "select_account" as const,
            },
          }
        : {}),
      ...(f.appleAuth
        ? {
            apple: {
              clientId: e.APPLE_CLIENT_ID!,
              clientSecret: e.APPLE_CLIENT_SECRET!,
              ...(e.APPLE_APP_BUNDLE_IDENTIFIER
                ? { appBundleIdentifier: e.APPLE_APP_BUNDLE_IDENTIFIER }
                : {}),
            },
          }
        : {}),
    },

    account: {
      accountLinking: { enabled: true, trustedProviders: ["google", "apple"] },
    },

    session: {
      // Stay signed in for 60 days of inactivity; the expiry slides forward once a day.
      expiresIn: 60 * 60 * 24 * 60,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },

    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "CUSTOMER", input: false },
        phone: { type: "string", required: false, input: false },
      },
    },

    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 120,
      customRules: {
        // Per IP: a restaurant Wi-Fi or a mobile carrier NAT can be shared by several people.
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 300, max: 5 },
        "/request-password-reset": { window: 900, max: 3 },
        "/forget-password": { window: 900, max: 3 },
        "/send-verification-email": { window: 900, max: 3 },
        "/change-password": { window: 300, max: 5 },
      },
    },

    advanced: {
      cookiePrefix: "dimsum",
      useSecureCookies: secure,
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure },
      database: { generateId: "uuid" },
      ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
    },

    databaseHooks: {
      account: {
        create: {
          after: async (account) => {
            if (account.providerId === "credential") return;
            try {
              const db = getDb();
              const user = await db.user.findUnique({
                where: { id: account.userId },
                select: { email: true, emailVerified: true },
              });
              if (!user || user.emailVerified) return;
              // Google/Apple just proved who owns this address. A password set earlier on the
              // unverified account may belong to someone else: revoke it with its sessions.
              await db.$transaction([
                db.account.deleteMany({ where: { userId: account.userId, providerId: "credential" } }),
                db.session.deleteMany({ where: { userId: account.userId } }),
                db.user.update({ where: { id: account.userId }, data: { emailVerified: true } }),
              ]);
              await linkGuestOrders(account.userId, user.email);
            } catch (error) {
              logger.error("social account link hook failed", { error, userId: account.userId });
            }
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const user = await getDb().user.findUnique({
              where: { id: session.userId },
              select: { disabledAt: true, deletedAt: true },
            });
            if (user?.disabledAt || user?.deletedAt) {
              throw new APIError("FORBIDDEN", {
                message: "Questo account è disattivato. Contatta il ristorante.",
              });
            }
          },
          after: async (session) => {
            // Guest orders placed since the last visit join the history as soon as the e-mail is proven.
            try {
              const user = await getDb().user.findUnique({
                where: { id: session.userId },
                select: { email: true, emailVerified: true },
              });
              if (user?.emailVerified) await linkGuestOrders(session.userId, user.email);
            } catch (error) {
              logger.error("guest order linking failed", { error, userId: session.userId });
            }
          },
        },
      },
      user: {
        create: {
          after: async (user) => {
            try {
              await ensureCustomerRecords(user.id);
              // Google/Apple addresses are verified by the provider: attach guest orders right away.
              // Welcome points too — e-mail sign-ups get them once the address is confirmed.
              if (user.emailVerified) {
                await linkGuestOrders(user.id, user.email);
                await awardSignupBonus(user.id);
              }
              await sendEmail({
                to: user.email,
                email: welcomeEmail(await brandContext(), {
                  firstName: firstNameOf(user.name),
                  menuUrl: appUrl("/menu"),
                }),
              });
            } catch (error) {
              logger.error("post sign-up hook failed", { error, userId: user.id });
            }
          },
        },
      },
    },

    plugins: [bearer(), nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { __dimsumAuth?: Auth };

/** Lazily created so that importing auth never requires the environment at build time. */
export function getAuth(): Auth {
  if (!globalForAuth.__dimsumAuth) globalForAuth.__dimsumAuth = createAuth();
  return globalForAuth.__dimsumAuth;
}
