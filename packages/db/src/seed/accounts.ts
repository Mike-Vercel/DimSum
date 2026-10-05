/**
 * Bootstrap accounts read from environment variables (no hard-coded credentials).
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME   → SUPER_ADMIN
 *   SEED_STAFF_EMAIL / SEED_STAFF_PASSWORD / SEED_STAFF_NAME   → STAFF (optional)
 *   SEED_RIDER_EMAIL / SEED_RIDER_PASSWORD / SEED_RIDER_NAME   → RIDER (optional)
 * Existing users are left untouched.
 */
import { hashPassword } from "better-auth/crypto";
import type { Database } from "../client";
import type { Role } from "../generated/prisma/client";

interface SeedAccount {
  role: Role;
  email: string;
  password: string;
  name: string;
}

function fromEnv(prefix: string, role: Role, fallbackName: string): SeedAccount | null {
  const email = process.env[`${prefix}_EMAIL`]?.trim().toLowerCase();
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) return null;
  if (password.length < 10) throw new Error(`${prefix}_PASSWORD must be at least 10 characters`);
  return { role, email, password, name: process.env[`${prefix}_NAME`]?.trim() || fallbackName };
}

export async function seedAccounts(db: Database): Promise<string[]> {
  const accounts = [
    fromEnv("SEED_ADMIN", "SUPER_ADMIN", "Amministratore DIMSUM"),
    fromEnv("SEED_STAFF", "STAFF", "Cucina DIMSUM"),
    fromEnv("SEED_RIDER", "RIDER", "Rider DIMSUM"),
  ].filter((a): a is SeedAccount => a !== null);

  const created: string[] = [];
  for (const a of accounts) {
    if (await db.user.findUnique({ where: { email: a.email } })) continue;
    const user = await db.user.create({
      data: {
        email: a.email,
        name: a.name,
        emailVerified: true,
        role: a.role,
        accounts: {
          create: { providerId: "credential", accountId: a.email, password: await hashPassword(a.password) },
        },
      },
    });
    // Better Auth uses the user id as accountId for credential accounts.
    await db.account.updateMany({
      where: { userId: user.id, providerId: "credential" },
      data: { accountId: user.id },
    });
    if (a.role === "RIDER") {
      await db.rider.create({ data: { userId: user.id, displayName: a.name.split(/\s+/)[0] ?? a.name } });
    }
    created.push(`${a.role} ${a.email}`);
  }
  return created;
}
