"use client";

import { useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import type { Trip } from "@/types/database.types";
import { rankedCountries, rankedPlaces, stayLengths, type RankBy, type Ranked } from "@/lib/stats";
import { CHART_TOOLTIP_STYLE, CHART_TOOLTIP_LABEL } from "@/lib/chart";
import { useT } from "@/components/i18n/LanguageProvider";

/**
 * A ranking that answers one question two ways: a visit counts once, a stay
 * counts every day. The other number stays on the second line, so both
 * readings sit side by side.
 */
export function RankedCard({ title, trips, kind }: { title: string; trips: Trip[]; kind: "countries" | "places" }) {
  const t = useT();
  const [by, setBy] = useState<RankBy>("count");
  const rows: Ranked[] = kind === "countries" ? rankedCountries(trips, by, 8) : rankedPlaces(trips, by, 8);
  const max = Math.max(1, ...rows.map((r) => r[by]));

  const tab = (value: RankBy, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={by === value}
      onClick={() => setBy(value)}
      className={`min-h-[36px] rounded-full px-3 text-xs font-medium transition-colors active:scale-[0.97] ${
        by === value ? "bg-ink text-surface" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-ink">{title}</h3>
        <div role="tablist" className="flex rounded-full bg-surface-2 p-0.5">
          {tab("count", t("stats.byVisits"))}
          {tab("days", t("stats.byDays"))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t("stats.noData")}</p>
      ) : (
        <ol className="space-y-2.5">
          {rows.map((r, i) => {
            const primary = by === "count" ? t("stats.visits", { n: r.count }) : t("stats.daysTotal", { n: r.days });
            const secondary = by === "count" ? t("stats.daysTotal", { n: r.days }) : t("stats.visits", { n: r.count });
            return (
              <li key={r.key} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3">
                <span className="text-sm font-semibold tabular-nums text-muted">{i + 1}</span>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm text-ink" title={r.label}>
                      {r.label}
                    </span>
                    {r.sub && <span className="truncate text-xs text-muted">{r.sub}</span>}
                  </div>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${(r[by] / max) * 100}%` }}
                    />
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums text-ink">{primary}</div>
                  <div className="text-[11px] tabular-nums text-muted">{secondary}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

const STAY_COLORS = ["var(--color-accent-soft)", "var(--color-accent)", "var(--color-arc)", "var(--color-ink)"];

/** Weekend, week, fortnight, longer — the four lengths a family actually plans. */
export function StayLengthCard({ trips }: { trips: Trip[] }) {
  const t = useT();
  const data = stayLengths(trips).map((b) => ({ ...b, name: t("stats.stay." + b.key) }));
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <h3 className="mb-3 text-sm font-medium text-ink">{t("stats.stayLength")}</h3>
      {total === 0 ? (
        <p className="text-sm text-muted">{t("stats.noData")}</p>
      ) : (
        <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie
                data={data.filter((d) => d.count > 0)}
                dataKey="count"
                nameKey="name"
                innerRadius={45}
                outerRadius={72}
                paddingAngle={2}
                stroke="var(--color-surface)"
              >
                {data
                  .filter((d) => d.count > 0)
                  .map((d) => (
                    <Cell key={d.key} fill={STAY_COLORS[data.indexOf(d)]} />
                  ))}
              </Pie>
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="space-y-2">
            {data.map((d, i) => (
              <li key={d.key} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STAY_COLORS[i] }} />
                <span className="min-w-0 flex-1 truncate text-ink">{d.name}</span>
                <span className="tabular-nums text-muted">
                  {d.count} · {Math.round((d.count / total) * 100)} %
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
