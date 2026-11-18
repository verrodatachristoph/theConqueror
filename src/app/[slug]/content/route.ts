import { getPlanMeta, getPlanHtml, isPlanUnlocked, PLAN_SANDBOX } from "@/lib/plans";

export const dynamic = "force-dynamic";

/**
 * The plan's HTML as its own document, so the uploaded page keeps its own
 * styles and scripts. Only ever reachable through the plan's gate.
 *
 * The CSP `sandbox` directive puts the document in an opaque origin even when it
 * is opened directly (not only inside the sandboxed iframe), so uploaded markup
 * can never act with the app's origin.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const plan = await getPlanMeta(slug);
  if (!plan || !plan.published) return new Response("Not found", { status: 404 });
  if (!(await isPlanUnlocked(plan))) return new Response("Forbidden", { status: 403 });

  const html = (await getPlanHtml(slug)) ?? "";
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "content-security-policy": `sandbox ${PLAN_SANDBOX}; frame-ancestors 'self'`,
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
