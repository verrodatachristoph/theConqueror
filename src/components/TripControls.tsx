"use client";

import { useEffect, useState } from "react";
import { FILTER_KEYS, type FilterKey, type FilterOptions, type TripFilter } from "@/lib/search";
import { flagEmoji } from "@/lib/iso";
import { useT } from "@/components/i18n/LanguageProvider";

/**
 * Search plus facet filters in one row; the facets open in a sheet. Twenty
 * countries and twenty years don't fit as chips without pushing the content
 * down, so the sheet holds them and whatever is switched on comes back as a
 * removable chip right under the search field.
 */
export default function TripControls({
  options,
  filter,
  onChange,
  count,
}: {
  options: FilterOptions;
  filter: TripFilter;
  onChange: (next: TripFilter) => void;
  count: number;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /** Tapping the same option again switches it off. */
  const set = (key: FilterKey, value: string) =>
    onChange({ ...filter, [key]: filter[key] === value ? undefined : value });

  const modeLabel = (m: string) => t("travelMode." + m);
  const labelFor: Record<FilterKey, (v: string) => string> = {
    iso3: (v) => `${flagEmoji(v)} ${options.countries.find((o) => o.value === v)?.label ?? v}`,
    year: (v) => v,
    mode: (v) => modeLabel(v),
    category: (v) => v,
  };

  const groups: { key: FilterKey; title: string; entries: FilterOptions[keyof FilterOptions] }[] = [
    { key: "iso3", title: t("search.country"), entries: options.countries },
    { key: "year", title: t("search.year"), entries: options.years },
    { key: "mode", title: t("travelMode.label"), entries: options.modes },
    { key: "category", title: t("search.category"), entries: options.categories },
  ];

  const active = FILTER_KEYS.filter((k) => filter[k]);
  const anything = active.length > 0 || !!filter.search?.trim();

  const chip = (on: boolean) =>
    `inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors active:scale-[0.97] ${
      on ? "bg-accent-soft text-ink ring-1 ring-accent" : "bg-surface-2 text-muted hover:text-ink"
    }`;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <input
          type="search"
          value={filter.search ?? ""}
          onChange={(e) => onChange({ ...filter, search: e.target.value })}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          className="min-h-[44px] min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={chip(active.length > 0)}
          aria-haspopup="dialog"
        >
          {t("search.filter")}
          {active.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
              {active.length}
            </span>
          )}
        </button>
      </div>

      {anything && (
        <div className="flex flex-wrap items-center gap-2">
          {active.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onChange({ ...filter, [k]: undefined })}
              className={chip(true)}
              aria-label={t("search.removeFilter", { label: labelFor[k](filter[k]!) })}
            >
              {labelFor[k](filter[k]!)} <span aria-hidden>✕</span>
            </button>
          ))}
          <span className="text-sm text-muted">{t("search.results", { n: count })}</span>
          <button
            type="button"
            onClick={() => onChange({})}
            className="min-h-[44px] rounded-full px-3 text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            {t("search.clear")}
          </button>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("search.filter")}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-xl sm:max-w-xl sm:rounded-3xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
              <h2 className="text-lg font-semibold">{t("search.filter")}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("common.close")}
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {groups
                .filter((g) => g.entries.length > 0)
                .map((g) => (
                  <section key={g.key} className="mb-5 last:mb-0">
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{g.title}</h3>
                    <div className="flex flex-wrap gap-2">
                      {g.entries.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => set(g.key, o.value)}
                          aria-pressed={filter[g.key] === o.value}
                          className={chip(filter[g.key] === o.value)}
                        >
                          {labelFor[g.key](o.value)}
                          <span className="text-xs text-muted">{o.count}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => onChange({ search: filter.search })}
                disabled={active.length === 0}
                className="min-h-[44px] rounded-full px-3 text-sm font-medium text-muted hover:text-ink disabled:opacity-40"
              >
                {t("search.reset")}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-[44px] rounded-full bg-ink px-5 text-sm font-medium text-surface active:scale-[0.97]"
              >
                {t("search.show", { n: count })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
