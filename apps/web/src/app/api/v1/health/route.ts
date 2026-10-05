import { connection } from "next/server";
import { db } from "@/server/db";

/** Liveness + database readiness probe (used by the connectivity check and uptime monitors). */
export async function GET() {
  await connection();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      { ok: true, time: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
