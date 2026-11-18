"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Person } from "@/types/database.types";
import type { TripWithMedia } from "@/lib/data";
import { yearOf, isUpcoming, daysUntil } from "@/lib/trips";
import { applyFilters } from "@/lib/search";
import { usePersonFilter } from "@/lib/use-person-filter";
import { useMediaQuery } from "@/lib/use-media";
import { flagEmoji } from "@/lib/iso";
import PersonFilter from "@/components/PersonFilter";
import Stats from "@/components/Stats";

// The d3 map is heavy and interactive — render it client-only to avoid
// floating-point projection mismatches between server and client.
function MapLoading() {
  const t = useT();
  return (
    <div className="relative aspect-[980/500] w-full overflow-hidden rounded-2xl bg-ocean">
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-surface/25 to-transparent" />
      <span className="sr-only">{t("common.mapLoading")}</span>
    </div>
  );
}

const WorldMap = dynamic(() => import("@/components/WorldMap"), {
  ssr: false,
  loading: () => <MapLoading />,
});
import TripList from "@/components/TripList";
import TripForm from "@/components/TripForm";
import TripDetail from "@/components/TripDetail";
import TopNav from "@/components/TopNav";
import { Reveal } from "@/components/motion";
import { useT } from "@/components/i18n/LanguageProvider";

export default function AppShell({
  trips,
  persons,
  defaultAirport,
  wishlist,
  readOnly = false,
  shareToken = null,
}: {
  trips: TripWithMedia[];
  persons: Person[];
  defaultAirport: string | null;
  wishlist: string[];
  readOnly?: boolean;
  shareToken?: string | null;
}) {
  const [showArcs, setShowArcs] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"date" | "days" | "country">("date");
  const [focused, setFocused] = useState<string | null>(null);
  const [editing, setEditing] = useState<TripWithMedia | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<TripWithMedia | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  // A world map 360 px wide is decoration: no country is big enough to tap. On a
  // phone the map therefore opens full screen, where pinch-zoom and pan work.
  const wide = useMediaQuery("(min-width: 640px)", true);
  const tr = useT();

  const codes = useMemo(() => persons.map((p) => p.code), [persons]);
  const people = usePersonFilter(trips, codes);
  const byPerson = people.filtered;
  const listTrips = byPerson;
  const focusedTrips = useMemo(
    () => (focused ? byPerson.filter((t) => t.country_iso3 === focused) : []),
    [byPerson, focused],
  );

  const nextTrip = useMemo(() => {
    const up = byPerson
      .filter(isUpcoming)
      .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
    return up[0] ?? null;
  }, [byPerson]);

  const visibleList = useMemo(() => {
    const arr = applyFilters(listTrips, { search: query }, (m) => tr("travelMode." + m));
    const sorted = [...arr];
    if (sort === "date") sorted.sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));
    else if (sort === "days") sorted.sort((a, b) => (b.days ?? 0) - (a.days ?? 0));
    else sorted.sort((a, b) => (a.country ?? "").localeCompare(b.country ?? "", "de"));
    return sorted;
  }, [listTrips, query, sort, tr]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (t: TripWithMedia) => {
    setDetail(null);
    setEditing(t);
    setFormOpen(true);
  };
  const openDetail = (t: TripWithMedia) => setDetail(t);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-10">
      {readOnly ? (
        <header className="mb-6 flex flex-wrap items-center gap-3">
          <span className="text-lg font-semibold tracking-tight md:text-xl">The Conqueror</span>
          <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-muted">
            {tr("home.sharedView")}
          </span>
        </header>
      ) : (
        <TopNav />
      )}

      <div className="mb-5">
        <PersonFilter persons={persons} filter={people} />
      </div>

      {/* Countdown to the next planned trip */}
      {nextTrip && (
        <div
          className="mb-5 flex items-center gap-3 rounded-2xl border p-4"
          style={{ borderColor: "#6d5bd055", background: "#6d5bd012" }}
        >
          <span className="text-2xl">🔜</span>
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "#6d5bd0" }}>
              {tr("home.nextTrip")}
            </div>
            <div className="truncate font-semibold text-ink">
              {nextTrip.place} {flagEmoji(nextTrip.country_iso3)}
              {nextTrip.start_date && (
                <span className="font-normal text-muted">
                  {" "}
                  · {tr("home.inDays", { n: daysUntil(nextTrip.start_date) })}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Map: a card on wider screens, a full-screen sheet on phones */}
      {!wide && (
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className="relative mb-6 flex min-h-[88px] w-full items-center gap-4 overflow-hidden rounded-2xl border border-line bg-ocean p-4 text-left shadow-sm active:scale-[0.99]"
        >
          <span className="text-3xl" aria-hidden>🗺️</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">{tr("home.openMap")}</span>
            <span className="block text-sm text-muted">
              {tr("home.mapSummary", {
                countries: new Set(byPerson.map((t) => t.country_iso3).filter(Boolean)).size,
                trips: byPerson.length,
              })}
            </span>
          </span>
          <span aria-hidden className="text-xl text-muted">›</span>
        </button>
      )}

      {!wide && mapOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={tr("home.openMap")}
          className="fixed inset-0 z-40 flex flex-col bg-ocean pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        >
          <div className="flex items-center gap-2 border-b border-line bg-surface/95 px-3 py-2 backdrop-blur">
            <button
              type="button"
              onClick={() => setMapOpen(false)}
              aria-label={tr("common.close")}
              className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-ink hover:bg-surface-2"
            >
              ✕
            </button>
            <span className="mr-auto truncate font-semibold">{tr("home.openMap")}</span>
            <button
              type="button"
              onClick={() => setShowArcs((v) => !v)}
              aria-pressed={showArcs}
              className={`min-h-[44px] rounded-xl border px-3 text-sm ${
                showArcs
                  ? "border-[var(--color-arc)] bg-[var(--color-arc)]/15 text-[var(--color-arc)]"
                  : "border-line text-muted"
              }`}
            >
              {tr("home.flightLines")} {showArcs ? tr("home.on") : tr("home.off")}
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
            <WorldMap
              fill
              trips={byPerson}
              showArcs={showArcs}
              wishlist={wishlist}
              focusIso={focused}
              onSelectCountry={(iso) => {
                // Show the country's trips under the preview, where there is room to read them.
                setFocused(iso);
                setMapOpen(false);
              }}
              onSelectTrip={(t) => {
                const full = trips.find((x) => x.id === t.id);
                if (full) openDetail(full);
              }}
            />
          </div>
        </div>
      )}

      {wide && (
      <section className="relative mb-6 rounded-2xl border border-line bg-surface p-3 shadow-sm">
        <WorldMap
          trips={byPerson}
          showArcs={showArcs}
          wishlist={wishlist}
          focusIso={focused}
          onSelectCountry={setFocused}
          onSelectTrip={(t) => {
            const full = trips.find((x) => x.id === t.id);
            if (full) openDetail(full);
          }}
        />
        <button
          onClick={() => setShowArcs((v) => !v)}
          aria-pressed={showArcs}
          className={`absolute right-5 top-5 z-10 flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm shadow-sm backdrop-blur transition-colors ${
            showArcs
              ? "border-[var(--color-arc)] bg-[var(--color-arc)]/15 text-[var(--color-arc)]"
              : "border-line bg-surface/90 text-muted hover:text-ink"
          }`}
        >
          <span
            className="h-2 w-4 rounded-full"
            style={{ background: showArcs ? "var(--color-arc)" : "var(--color-line)" }}
          />
          {tr("home.flightLines")} {showArcs ? tr("home.on") : tr("home.off")}
        </button>

        {/* Desktop: compact country panel inside the map */}
        {focused && (
          <div className="absolute left-5 top-5 z-10 hidden max-h-[70%] w-64 flex-col overflow-hidden rounded-xl border border-line bg-surface/95 shadow-lg backdrop-blur sm:flex">
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
              <span className="truncate text-sm font-semibold">
                {flagEmoji(focused)} {focusedTrips[0]?.country ?? focused}
                <span className="ml-1 font-normal text-muted">({focusedTrips.length})</span>
              </span>
              <button
                onClick={() => setFocused(null)}
                aria-label={tr("common.close")}
                className="shrink-0 text-muted hover:text-ink"
              >
                ✕
              </button>
            </div>
            <ul className="overflow-y-auto py-1">
              {focusedTrips.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => openDetail(t)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-2"
                  >
                    <span className="truncate">{t.place}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted">{yearOf(t) ?? ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      )}

      {/* Country focus panel — mobile only (desktop uses the in-map overlay) */}
      {focused && (
        <Reveal as="section" className="mb-6 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:hidden">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {flagEmoji(focused)} {focusedTrips[0]?.country ?? focused}{" "}
              <span className="text-sm font-normal text-muted">({focusedTrips.length})</span>
            </h2>
            <button
              onClick={() => setFocused(null)}
              className="rounded-full border border-line px-3 min-h-[44px] py-1.5 text-sm text-muted transition-colors hover:text-ink"
            >
              {tr("common.close")} ✕
            </button>
          </div>
          <TripList trips={focusedTrips} persons={persons} onOpen={openDetail} />
        </Reveal>
      )}

      {/* Stats */}
      <section className="mb-8">
        <Stats trips={byPerson} />
      </section>

      {/* List */}
      <Reveal as="section">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Row 1 on mobile: title + primary action. Inline on desktop. */}
          <div className="flex items-center gap-2 sm:contents">
            <h2 className="mr-auto text-lg font-semibold">
              {tr("home.stays")} <span className="text-sm font-normal text-muted">({visibleList.length})</span>
            </h2>
            {!readOnly && (
              <button
                onClick={openNew}
                className="shrink-0 rounded-full bg-ink px-4 min-h-[44px] py-1.5 text-sm font-medium text-surface shadow-sm transition-transform hover:scale-[1.02] active:scale-95 sm:order-last"
              >
                {tr("home.newStay")}
              </button>
            )}
          </div>
          {/* Row 2 on mobile: search + sort. Inline on desktop. */}
          <div className="flex items-center gap-2 sm:contents">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr("home.searchPlaceholder")}
              className="min-w-0 flex-1 rounded-full border border-line bg-surface px-3 min-h-[44px] py-1.5 text-sm outline-none focus:border-accent sm:w-48 sm:flex-none"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="shrink-0 rounded-full border border-line bg-surface px-3 min-h-[44px] py-1.5 text-sm outline-none focus:border-accent"
              title={tr("home.sortTitle")}
            >
              <option value="date">{tr("home.sortNewest")}</option>
              <option value="days">{tr("home.sortLongest")}</option>
              <option value="country">{tr("home.sortCountry")}</option>
            </select>
          </div>
        </div>
        <TripList trips={visibleList} persons={persons} onOpen={openDetail} />
      </Reveal>

      {detail && (
        <TripDetail
          trip={detail}
          persons={persons}
          onClose={() => setDetail(null)}
          onEdit={openEdit}
          readOnly={readOnly}
          shareToken={shareToken}
        />
      )}

      {formOpen && !readOnly && (
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
