import { NextResponse, type NextRequest } from "next/server";
import { homeForRole } from "@/lib/auth-routing";
import { getViewerFromHeaders } from "@/server/auth/session";

/**
 * Where the installed app (PWA) starts — like a real app, no landing page: whoever installs it has
 * already seen the site. Signed in → straight to the menu (staff and riders to their own area);
 * otherwise sign in / sign up first, then the menu.
 */
export async function GET(request: NextRequest) {
  const viewer = await getViewerFromHeaders(request.headers).catch(() => null);
  const target = !viewer
    ? "/login?next=%2Fmenu"
    : viewer.role === "CUSTOMER"
      ? "/menu"
      : homeForRole(viewer.role);
  const response = NextResponse.redirect(new URL(target, request.url), 307);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
