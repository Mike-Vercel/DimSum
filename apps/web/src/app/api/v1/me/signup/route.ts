import { z } from "zod";
import { db } from "@/server/db";
import { brandContext, sendEmail, welcomeEmail } from "@/server/email";
import { appUrl } from "@/server/env";
import { getAuth } from "@/server/auth/auth";
import { AppError } from "@/server/errors";
import { apiRoute } from "@/server/http";

const completeSignup = z.object({
  firstName: z.string().trim().min(1, { error: "Inserisci il nome." }).max(60),
  lastName: z.string().trim().min(1, { error: "Inserisci il cognome." }).max(60),
  password: z
    .string()
    .min(10, { error: "La password deve avere almeno 10 caratteri." })
    .max(128, { error: "La password è troppo lunga (massimo 128 caratteri)." }),
});

/**
 * Last step of the sign-up with an e-mail code: the account exists (the code proved the address),
 * now it gets its name and a password for the next sign-ins. The phone is asked at checkout.
 */
export const POST = apiRoute(
  { auth: "user", rateLimit: { name: "signup-complete", limit: 10, windowSeconds: 600, by: "user" } },
  async ({ viewer, body, req }) => {
    const input = await body(completeSignup);
    const userId = viewer!.userId;
    const hasPassword = await db.account.findFirst({
      where: { userId, providerId: "credential" },
      select: { id: true },
    });
    if (hasPassword) throw new AppError("CONFLICT", "Il profilo è già completo: accedi con la tua password.");
    await db.user.update({ where: { id: userId }, data: { name: `${input.firstName} ${input.lastName}` } });
    await getAuth().api.setPassword({ body: { newPassword: input.password }, headers: req.headers });
    await sendEmail({
      to: viewer!.email,
      email: welcomeEmail(await brandContext(), { firstName: input.firstName, menuUrl: appUrl("/menu") }),
    }).catch(() => undefined);
    return { ok: true as const };
  },
);
