import "server-only";
import { can, isStaffRole, type Permission } from "@dimsum/domain";
import type { Role } from "@dimsum/types";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppError } from "../errors";
import { getAuth } from "./auth";

export interface Viewer {
  userId: string;
  sessionId: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
  image: string | null;
}

/**
 * Resolves the signed-in user. `fresh` skips the 5-minute session cookie cache: staff and rider
 * operations use it so that a disabled account or a changed role takes effect immediately.
 */
export async function getViewerFromHeaders(
  requestHeaders: Headers,
  options: { fresh?: boolean } = {},
): Promise<Viewer | null> {
  const session = await getAuth().api.getSession({
    headers: requestHeaders,
    ...(options.fresh ? { query: { disableCookieCache: true } } : {}),
  });
  if (!session) return null;
  const user = session.user as typeof session.user & { role?: string | null };
  return {
    userId: user.id,
    sessionId: session.session.id,
    email: user.email,
    name: user.name,
    role: (user.role as Role | null) ?? "CUSTOMER",
    emailVerified: user.emailVerified,
    image: user.image ?? null,
  };
}

/** For Server Components (must run inside a Suspense boundary with Cache Components). */
export async function getViewer(options: { fresh?: boolean } = {}): Promise<Viewer | null> {
  return getViewerFromHeaders(await headers(), options);
}

export function assertPermission(viewer: Viewer | null, permission: Permission): asserts viewer is Viewer {
  if (!viewer) throw new AppError("UNAUTHENTICATED");
  if (!can(viewer.role, permission)) throw new AppError("FORBIDDEN");
}

/** Page guard for the admin area: redirects to the login with a return path. */
export async function requireStaffPage(returnTo: string, permission?: Permission): Promise<Viewer> {
  const viewer = await getViewer({ fresh: true });
  if (!viewer) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!isStaffRole(viewer.role) || (permission && !can(viewer.role, permission))) redirect("/accesso-negato");
  return viewer;
}

export async function requireRiderPage(returnTo: string): Promise<Viewer> {
  const viewer = await getViewer({ fresh: true });
  if (!viewer) redirect(`/rider/login?next=${encodeURIComponent(returnTo)}`);
  if (viewer.role !== "RIDER") redirect("/accesso-negato");
  return viewer;
}

export async function requireCustomerPage(returnTo: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return viewer;
}
