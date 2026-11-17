"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hashPassword, planCookie, planToken } from "@/lib/auth";
import { getPlanMeta } from "@/lib/plans";
import { getT } from "@/lib/i18n/server";

export type PlanLoginState = { error?: string };

/** Check a travel plan's own password and, if it matches, set its cookie. */
export async function unlockPlan(
  slug: string,
  _prev: PlanLoginState,
  formData: FormData,
): Promise<PlanLoginState> {
  const password = String(formData.get("password") ?? "");
  const secret = process.env.AUTH_SECRET!;
  const plan = await getPlanMeta(slug);

  const ok =
    !!plan &&
    plan.published &&
    !!plan.passwordHash &&
    (await hashPassword(secret, password)) === plan.passwordHash;

  if (!ok || !plan?.passwordHash) {
    const t = await getT();
    return { error: t("plan.wrongPassword") };
  }

  (await cookies()).set(planCookie(slug), await planToken(secret, slug, plan.passwordHash), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/${slug}`,
    maxAge: 60 * 60 * 24 * 60, // 60 days
  });
  redirect(`/${slug}`);
}
