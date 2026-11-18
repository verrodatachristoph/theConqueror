"use client";

import type { Person } from "@/types/database.types";
import { personColor } from "@/lib/trips";
import type { PersonFilterState } from "@/lib/use-person-filter";
import { useT } from "@/components/i18n/LanguageProvider";

/**
 * Who was along. A lit chip means "was along" (OR); nothing chosen lights every
 * chip, because that is what an unfiltered page shows. The narrower question —
 * trips these people made *together* — is a switch beside them, available in the
 * default state too, where it asks for the trips the whole family made together.
 */
export default function PersonFilter({
  persons,
  filter,
}: {
  persons: Person[];
  filter: PersonFilterState;
}) {
  const t = useT();
  const { selected, together, togetherAvailable, toggle, reset, toggleTogether } = filter;
  const everyone = selected.size === 0;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="hidden text-xs font-medium uppercase tracking-wide text-muted md:mr-1 md:inline">
          {t("filter.whoWasThere")}
        </span>
        {persons.map((p) => {
          const on = everyone || selected.has(p.code);
          const color = personColor(persons, p.code);
          return (
            <button
              key={p.code}
              type="button"
              onClick={() => toggle(p.code)}
              aria-pressed={on}
              title={
                everyone
                  ? t("filter.onlyWith", { name: p.name })
                  : on
                    ? t("filter.removeFromFilter", { name: p.name })
                    : t("filter.addToFilter", { name: p.name })
              }
              style={on ? { backgroundColor: color } : undefined}
              className={`flex min-h-[44px] items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-all active:scale-[0.97] ${
                on ? "text-white shadow-sm" : "bg-surface-2 text-muted hover:bg-surface hover:text-ink"
              }`}
            >
              {on ? (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/95 text-[10px] font-bold text-ink">
                  ✓
                </span>
              ) : (
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
              )}
              {p.name}
            </button>
          );
        })}
        {!everyone && (
          <button
            type="button"
            onClick={reset}
            className="min-h-[44px] rounded-full px-3 text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            {t("filter.everyone")}
          </button>
        )}
      </div>

      {togetherAvailable && persons.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={together}
            onClick={toggleTogether}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors active:scale-[0.98] ${
              together ? "bg-accent-soft text-ink ring-1 ring-accent" : "bg-surface-2 text-muted hover:text-ink"
            }`}
          >
            <span
              aria-hidden
              className={`block h-4 w-7 rounded-full transition-colors ${together ? "bg-accent" : "bg-line"}`}
            >
              <span
                className={`block h-3 w-3 translate-y-[2px] rounded-full bg-surface transition-transform ${
                  together ? "translate-x-[14px]" : "translate-x-[2px]"
                }`}
              />
            </span>
            {t("filter.together")}
          </button>
          <p className="text-xs text-muted">
            {together
              ? everyone
                ? t("filter.togetherOnEveryone")
                : t("filter.togetherOn")
              : t("filter.togetherOff")}
          </p>
        </div>
      )}
    </div>
  );
}
