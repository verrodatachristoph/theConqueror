"use client";

import { useActionState } from "react";
import { motion } from "framer-motion";
import { unlockPlan, type PlanLoginState } from "@/app/plan-actions";
import { useT } from "@/components/i18n/LanguageProvider";

/** Password prompt for a single travel plan — deliberately reveals nothing else. */
export default function PlanGate({ slug, title }: { slug: string; title: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<PlanLoginState, FormData>(
    unlockPlan.bind(null, slug),
    {},
  );

  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-parchment px-6">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60rem 40rem at 50% -10%, var(--color-accent-soft), transparent), radial-gradient(40rem 30rem at 110% 110%, color-mix(in oklab, var(--color-arc) 25%, transparent), transparent)",
        }}
      />
      <motion.form
        action={formAction}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-3xl border border-line bg-surface/80 p-7 shadow-xl backdrop-blur"
      >
        <h1 className="text-center text-lg font-semibold tracking-tight">
          {title || t("plan.fallbackTitle")}
        </h1>
        <p className="mt-1 text-center text-sm text-muted">{t("plan.locked")}</p>

        <label className="mt-6 block">
          <span className="text-xs font-medium text-muted">{t("plan.passwordLabel")}</span>
          <input
            type="password"
            name="password"
            autoFocus
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-line bg-parchment/50 px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </label>

        {state.error && <p className="mt-2 text-sm text-[var(--color-arc)]">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-full bg-ink py-2.5 text-sm font-medium text-surface transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? t("plan.submitting") : t("plan.submit")}
        </button>
      </motion.form>
    </main>
  );
}
