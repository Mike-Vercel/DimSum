import { NextResponse, type NextRequest } from "next/server";
import { getViewerFromHeaders } from "@/server/auth/session";

/**
 * Where the installed app (PWA) starts — like a real app, no landing page: whoever installs it has
 * already seen the site. Signed in → straight to the menu, staff included (the back office is one
 * tap away from the profile: "Apri il gestionale"); riders → their app. Otherwise sign in first.
 */
export async function GET(request: NextRequest) {
  const viewer = await getViewerFromHeaders(request.headers).catch(() => null);
  const target = !viewer ? "/login?next=%2Fmenu" : viewer.role === "RIDER" ? "/rider" : "/menu";
  const response = NextResponse.redirect(new URL(target, request.url), 307);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
