import { PLAN_SANDBOX } from "@/lib/plans";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlanMeta, isPlanUnlocked } from "@/lib/plans";
import PlanGate from "./PlanGate";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const plan = await getPlanMeta(slug);
  if (!plan?.published) return {};
  // Shared links should never end up in a search index.
  return { title: plan.title || "The Conqueror", robots: { index: false, follow: false } };
}

export default async function PlanPage({ params }: Props) {
  const { slug } = await params;
  const plan = await getPlanMeta(slug);
  if (!plan || !plan.published) notFound();

  if (!(await isPlanUnlocked(plan))) return <PlanGate slug={plan.slug} title={plan.title} />;

  // Fixed overlay: covers the app shell (footer, mobile tab bar padding) so a
  // guest sees the plan and nothing else. The HTML lives in its own document
  // (see ./content/route.ts) so its CSS can't collide with the app's.
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/theConqueror_logo_dark_trim.png"
          alt="The Conqueror"
          className="block h-7 w-auto dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/theConqueror_logo_light_trim.png"
          alt="The Conqueror"
          className="hidden h-7 w-auto dark:block"
        />
        {plan.title && (
          <span className="truncate text-sm font-medium text-muted">{plan.title}</span>
        )}
      </header>
      <iframe
        src={`/${plan.slug}/content`}
        title={plan.title || plan.slug}
        className="min-h-0 w-full flex-1 border-0 bg-white"
        // No allow-same-origin: the plan runs in an opaque origin, so its scripts work
        // but can never reach the app (cookies, storage, same-origin requests).
        sandbox={PLAN_SANDBOX}
      />
    </div>
  );
}
