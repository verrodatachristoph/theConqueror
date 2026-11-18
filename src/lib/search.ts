import type { Trip, TravelMode } from "@/types/database.types";
import { TRAVEL_MODE_LABEL } from "@/lib/trips";

/**
 * Search and filter for the diary and the trip list.
 *
 * Everything happens in memory: the page has already loaded every trip, and
 * scanning a few hundred rows is cheaper than a second query.
 */
export type TripFilter = {
  search?: string;
  /** ISO-3 of the country, not its name: the same state is spelled differently. */
  iso3?: string;
  year?: string;
  mode?: string;
  category?: string;
};

export const FILTER_KEYS = ["iso3", "year", "mode", "category"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

/** Lower case without diacritics, so "osterreich" finds Österreich and "strasse" Straße. */
export function fold(value: string): string {
  return value
    .toLocaleLowerCase("de")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Every field somebody would remember a trip by, on one line. Travel modes are
 * matched in every language we ship (plus whatever labels the caller passes).
 */
export function searchText(trip: Trip, modeLabels: string[] = []): string {
  return fold(
    [
      trip.place,
      trip.country,
      trip.country_iso3,
      trip.category,
      trip.comment,
      trip.other_travelers,
      trip.departure_iata,
      trip.arrival_iata,
      ...(trip.flight_stops ?? []).map((s) => s.iata),
      trip.travel_mode,
      trip.travel_mode ? TRAVEL_MODE_LABEL[trip.travel_mode] : null,
      ...modeLabels,
      trip.start_date,
      trip.end_date,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/**
 * Apply search + facet filters. Several words mean all must occur, in any field.
 * `modeLabel` lets the caller add the localized travel-mode name to the haystack.
 */
export function applyFilters<T extends Trip>(
  trips: T[],
  filter: TripFilter,
  modeLabel?: (mode: TravelMode) => string,
): T[] {
  const terms = fold(filter.search ?? "").split(/\s+/).filter(Boolean);

  return trips.filter((trip) => {
    if (filter.iso3 && trip.country_iso3 !== filter.iso3) return false;
    if (filter.year && trip.start_date?.slice(0, 4) !== filter.year) return false;
    if (filter.mode && trip.travel_mode !== filter.mode) return false;
    if (filter.category && trip.category !== filter.category) return false;
    if (terms.length === 0) return true;
    const extra = trip.travel_mode && modeLabel ? [modeLabel(trip.travel_mode)] : [];
    const haystack = searchText(trip, extra);
    return terms.every((term) => haystack.includes(term));
  });
}

export type FilterOption = { value: string; label: string; count: number };

export type FilterOptions = {
  countries: FilterOption[];
  years: FilterOption[];
  modes: FilterOption[];
  categories: FilterOption[];
};

/**
 * What can be chosen, derived from the trips themselves. An option that would
 * lead to zero results never shows up, and the count beside it says up front
 * what to expect.
 */
export function filterOptions(trips: Trip[]): FilterOptions {
  const countries = new Map<string, { label: string; count: number }>();
  const years = new Map<string, number>();
  const modes = new Map<TravelMode, number>();
  const categories = new Map<string, number>();

  for (const trip of trips) {
    if (trip.country_iso3) {
      const entry = countries.get(trip.country_iso3) ?? { label: trip.country ?? trip.country_iso3, count: 0 };
      entry.count += 1;
      countries.set(trip.country_iso3, entry);
    }
    const year = trip.start_date?.slice(0, 4);
    if (year) years.set(year, (years.get(year) ?? 0) + 1);
    if (trip.travel_mode) modes.set(trip.travel_mode, (modes.get(trip.travel_mode) ?? 0) + 1);
    if (trip.category) categories.set(trip.category, (categories.get(trip.category) ?? 0) + 1);
  }

  return {
    countries: [...countries.entries()]
      .map(([value, entry]) => ({ value, ...entry }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "de")),
    years: [...years.entries()]
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.value.localeCompare(a.value)),
    modes: [...modes.entries()]
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count),
    categories: [...categories.entries()]
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "de")),
  };
}
