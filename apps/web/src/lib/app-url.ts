/**
 * Public base URL (e-mail links, OAuth callbacks, metadata). APP_URL wins; on Vercel without it,
 * the production domain (or this deployment's URL on previews); locally, localhost.
 * Server-side only: it reads the process environment.
 */
export function resolveAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const host =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_URL;
  return host ? `https://${host}` : "http://localhost:3000";
}
