import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionToken, safeEqual, authDisabled } from "@/lib/auth";
import { isPlanSlug } from "@/lib/plan-slug";

/**
 * A travel plan lives at /<slug> (and /<slug>/content) and brings its own
 * password gate, so those paths must not be swallowed by the family gate.
 * Shape check only — whether the slug exists is decided by the route itself.
 */
function isTravelPlanPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 1) return isPlanSlug(segments[0]);
  if (segments.length === 2 && segments[1] === "content") return isPlanSlug(segments[0]);
  return false;
}

export async function middleware(req: NextRequest) {
  if (authDisabled()) return NextResponse.next();
  if (isTravelPlanPath(req.nextUrl.pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;

  if (token && secret) {
    const expected = await sessionToken(secret);
    if (safeEqual(token, expected)) return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

// Protect everything except the login page, the public share route (/s/...),
// Next internals and static assets.
export const config = {
  matcher: [
    "/((?!login|s/|opengraph-image|twitter-image|manifest.webmanifest|apple-icon|_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)).*)",
  ],
};
