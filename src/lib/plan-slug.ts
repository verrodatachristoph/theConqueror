/**
 * Slug rules for travel plans. Shared by the edge middleware, the admin
 * actions and the plan route — must stay free of server-only imports.
 */

/** Top-level paths the app itself owns; a plan can never claim one of them. */
export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "apple-icon",
  "content",
  "destinations",
  "diary",
  "favicon.ico",
  "login",
  "manifest.webmanifest",
  "opengraph-image",
  "profile",
  "public",
  "robots.txt",
  "s",
  "sitemap.xml",
  "statistics",
  "static",
  "twitter-image",
  "_next",
]);

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

/** Best-effort cleanup of user input into a legal slug. */
export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Could this path segment address a travel plan? (Shape only — no DB lookup.) */
export function isPlanSlug(seg: string): boolean {
  return SLUG_RE.test(seg) && !RESERVED_SLUGS.has(seg);
}
