import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionToken, safeEqual, authDisabled } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

/**
 * Server-side session checks for Server Actions.
 *
 * The middleware is not enough on its own: a Server Action is a POST that can be
 * sent to *any* page path, including the ones the middleware lets through
 * (/login, /s/<token>, /<plan-slug>). Every action that reads or writes family
 * data therefore verifies the session cookie itself.
 */
export async function hasSession(): Promise<boolean> {
  if (authDisabled()) return true;
  const secret = process.env.AUTH_SECRET;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!secret || !token) return false;
  return safeEqual(token, await sessionToken(secret));
}

export async function requireSession(): Promise<void> {
  if (!(await hasSession())) throw new Error("Unauthorized");
}

/** Session, or a valid public share token (read-only view at /s/<token>). */
export async function requireSessionOrShare(shareToken?: string | null): Promise<void> {
  if (await hasSession()) return;
  if (shareToken) {
    const settings = await getSettings();
    if (settings?.share_token && safeEqual(settings.share_token, shareToken)) return;
  }
  throw new Error("Unauthorized");
}
