import { getPlanMeta, getPlanHtml, isPlanUnlocked } from "@/lib/plans";

export const dynamic = "force-dynamic";

/**
 * The plan's HTML as its own document, so the uploaded page keeps its own
 * styles and scripts. Only ever reachable through the plan's gate.
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
      "content-security-policy": "frame-ancestors 'self'",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
