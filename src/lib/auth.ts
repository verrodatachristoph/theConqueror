/**
 * Shared-password gate. No per-user identity — one family password.
 * The session cookie holds an HMAC token derived from AUTH_SECRET, so it
 * can't be forged without the secret. Works in both edge middleware and node.
 */
export const SESSION_COOKIE = "conq_session";

/**
 * Local development without the password gate: `DEV_NO_AUTH=1` in .env.local.
 * Only honoured by `next dev` (NODE_ENV=development); a production build ignores it.
 */
export function authDisabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DEV_NO_AUTH === "1";
}

const enc = new TextEncoder();

function base64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Hash a password with the AUTH_SECRET as salt (sha256 hex). */
export async function hashPassword(secret: string, password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`${secret}:${password}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return base64url(sig);
}

/** Deterministic session token for the current AUTH_SECRET. */
export async function sessionToken(secret: string): Promise<string> {
  return hmac(secret, "conqueror-session-v1");
}

/** Cookie name for a single travel plan's own gate. */
export function planCookie(slug: string): string {
  return `conq_plan_${slug}`;
}

/**
 * Unlock token for one travel plan. The plan's current password hash is part
 * of the message, so changing the password invalidates every issued cookie.
 */
export async function planToken(
  secret: string,
  slug: string,
  passwordHash: string,
): Promise<string> {
  return hmac(secret, `conqueror-plan-v1:${slug}:${passwordHash}`);
}

/** Constant-time-ish comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
