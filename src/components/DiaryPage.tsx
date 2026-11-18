"use client";

import { useMemo, useState } from "react";
import type { Person } from "@/types/database.types";
import type { TripWithMedia } from "@/lib/data";
import { personColor, yearOf, isUpcoming, TRAVEL_MODE_ICON } from "@/lib/trips";
import { applyFilters, filterOptions, type TripFilter } from "@/lib/search";
import { usePersonFilter } from "@/lib/use-person-filter";
import { flagEmoji } from "@/lib/iso";
import TopNav from "@/components/TopNav";
import PersonFilter from "@/components/PersonFilter";
import TripControls from "@/components/TripControls";
import TripDetail from "@/components/TripDetail";
import TripForm from "@/components/TripForm";
import EmptyState from "@/components/EmptyState";
import { Reveal } from "@/components/motion";
import { useT } from "@/components/i18n/LanguageProvider";

function fmt(d: string | null) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

export default function DiaryPage({
  trips,
  persons,
  defaultAirport,
}: {
  trips: TripWithMedia[];
  persons: Person[];
  defaultAirport: string | null;
}) {
  const tr = useT();
  const codes = useMemo(() => persons.map((p) => p.code), [persons]);
  const people = usePersonFilter(trips, codes);
  const [filter, setFilter] = useState<TripFilter>({});
  const [detail, setDetail] = useState<TripWithMedia | null>(null);
  const [editing, setEditing] = useState<TripWithMedia | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  // Years the user opened or closed by hand; everything else follows the default.
  const [toggled, setToggled] = useState<Map<number, boolean>>(new Map());

  const options = useMemo(() => filterOptions(people.filtered), [people.filtered]);

  const visible = useMemo(
    () =>
      applyFilters(people.filtered, filter, (m) => tr("travelMode." + m))
        .slice()
        .sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? "")), // newest first
    [people.filtered, filter, tr],
  );

  const byYear = useMemo(() => {
    const groups = new Map<number, TripWithMedia[]>();
    for (const t of visible) {
      const y = yearOf(t) ?? 0;
      const list = groups.get(y);
      if (list) list.push(t);
      else groups.set(y, [t]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  }, [visible]);

  // A long diary folds by year: only the newest opens by default. While searching or
  // filtering every hit is what you came for, so all years open.
  const narrowed = !!filter.search?.trim() || Object.values(filter).some(Boolean);
  const isOpen = (year: number, index: number) => toggled.get(year) ?? (narrowed || index === 0);
  const toggleYear = (year: number, index: number) =>
    setToggled((prev) => new Map(prev).set(year, !isOpen(year, index)));

  const nameByCode = new Map(persons.map((p) => [p.code, p.name]));

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-10">
      <TopNav />

      <div className="mb-4">
        <PersonFilter persons={persons} filter={people} />
      </div>
      <div className="mb-8 max-w-3xl">
        <TripControls options={options} filter={filter} onChange={setFilter} count={visible.length} />
      </div>

      <div className="max-w-3xl">

      {byYear.map(([year, list], index) => (
        <Reveal as="section" key={year} className="mb-6">
          <button
            type="button"
            onClick={() => toggleYear(year, index)}
            aria-expanded={isOpen(year, index)}
            className="mb-3 flex min-h-[44px] w-full items-baseline gap-3 rounded-xl text-left"
          >
            <h2 className="text-2xl font-semibold tracking-tight">{year || tr("common.none")}</h2>
            <span className="text-sm text-muted">
              {list.length} {list.length === 1 ? tr("diary.trip") : tr("common.trips")}
            </span>
            <span
              aria-hidden
              className={`ml-auto text-muted transition-transform ${isOpen(year, index) ? "rotate-180" : ""}`}
            >
              ▾
            </span>
          </button>

          {isOpen(year, index) && (
          <ul className="space-y-3 md:border-l md:border-line md:pl-6">
            {list.map((t) => (
              <li key={t.id} className="relative">
                <span className="absolute -left-[1.65rem] top-5 hidden h-2.5 w-2.5 rounded-full border-2 border-parchment bg-accent md:block" />
                <button
                  onClick={() => setDetail(t)}
                  className="flex w-full gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition-colors hover:bg-surface-2"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-2 sm:h-24 sm:w-24">
                    {t.cover_signed ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.cover_signed} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl opacity-50">
                        {TRAVEL_MODE_ICON[t.travel_mode ?? ""] ?? "📍"}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="truncate text-base font-semibold text-ink">{t.place}</h3>
                      {isUpcoming(t) && (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ background: "#6d5bd020", color: "#6d5bd0" }}
                        >
                          {tr("common.planned")}
                        </span>
                      )}
                      <span className="shrink-0 text-xs text-muted">
                        {flagEmoji(t.country_iso3)} {t.country}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                      <span>
                        {fmt(t.start_date)} – {fmt(t.end_date)}
                      </span>
                      <span>·</span>
                      <span>{t.days ?? "?"} {tr("common.days")}</span>
                      <span>·</span>
                      <span>
                        {TRAVEL_MODE_ICON[t.travel_mode ?? ""] ?? ""} {t.travel_mode ? tr("travelMode." + t.travel_mode) : tr("common.none")}
                      </span>
                    </div>
                    {t.comment && (
                      <p className="mt-1 line-clamp-2 text-sm text-ink/80">{t.comment}</p>
                    )}
                    <div className="mt-1.5 flex gap-1">
                      {(t.travelers ?? []).map((c) => (
                        <span
                          key={c}
                          title={nameByCode.get(c) ?? c}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                          style={{ backgroundColor: personColor(persons, c) }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          )}
        </Reveal>
      ))}

        {!byYear.length && (
          <EmptyState icon="📖" title={tr("diary.emptyTitle")} hint={tr("diary.emptyHint")} />
        )}
      </div>

      {detail && (
        <TripDetail
          trip={detail}
          persons={persons}
          onClose={() => setDetail(null)}
          onEdit={(t) => {
            setDetail(null);
            setEditing(t);
            setFormOpen(true);
          }}
        />
      )}
      {formOpen && (
        <TripForm
          trip={editing}
          persons={persons}
          defaultAirport={defaultAirport}
          onClose={() => setFormOpen(false)}
        />
      )}
    </main>
  );
}
