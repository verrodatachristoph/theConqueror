import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE, sessionToken, planCookie, planToken, safeEqual } from "@/lib/auth";
import { isPlanSlug } from "@/lib/plan-slug";

/** Everything about a plan except the (potentially huge) HTML body. */
export type PlanMeta = {
  slug: string;
  title: string;
  bytes: number;
  passwordHash: string | null;
  published: boolean;
  updatedAt: string;
};

/** Admin-list shape — no password hash leaves the server. */
export type PlanSummary = Omit<PlanMeta, "passwordHash"> & { hasPassword: boolean };

const META_COLUMNS = "slug, title, bytes, password_hash, published, updated_at";

function toMeta(row: {
  slug: string;
  title: string;
  bytes: number;
  password_hash: string | null;
  published: boolean;
  updated_at: string;
}): PlanMeta {
  return {
    slug: row.slug,
    title: row.title,
    bytes: row.bytes,
    passwordHash: row.password_hash,
    published: row.published,
    updatedAt: row.updated_at,
  };
}

export function toSummary(meta: PlanMeta): PlanSummary {
  const { passwordHash, ...rest } = meta;
  return { ...rest, hasPassword: !!passwordHash };
}

export async function getPlanMeta(slug: string): Promise<PlanMeta | null> {
  if (!isPlanSlug(slug)) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("travel_plans")
    .select(META_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  return data ? toMeta(data) : null;
}

export async function getPlanHtml(slug: string): Promise<string | null> {
  if (!isPlanSlug(slug)) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.from("travel_plans").select("html").eq("slug", slug).maybeSingle();
  return data?.html ?? null;
}

export async function listPlans(): Promise<PlanSummary[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("travel_plans")
    .select(META_COLUMNS)
    .order("updated_at", { ascending: false });
  return (data ?? []).map((row) => toSummary(toMeta(row)));
}

/**
 * May the current request see this plan? A plan without a password is open to
 * anyone who knows the slug; otherwise an unlock cookie for exactly this plan
 * and password is required. A valid family session always passes.
 */
export async function isPlanUnlocked(plan: PlanMeta): Promise<boolean> {
  if (!plan.passwordHash) return true;

  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  const store = await cookies();

  const family = store.get(SESSION_COOKIE)?.value;
  if (family && safeEqual(family, await sessionToken(secret))) return true;

  const unlock = store.get(planCookie(plan.slug))?.value;
  return !!unlock && safeEqual(unlock, await planToken(secret, plan.slug, plan.passwordHash));
}
