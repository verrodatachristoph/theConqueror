import type { Trip } from "@/types/database.types";
import { yearOf, tripStops, flightLegs, totalFlights } from "@/lib/trips";

export type PersonStats = {
  code: string;
  trips: number;
  days: number;
  countries: number;
  countrySet: Set<string>;
  flights: number;
  longest: Trip | null;
  topCountry: [string, number] | null;
  topPlace: [string, number] | null;
  firstYear: number | null;
  lastYear: number | null;
};

function topBy(trips: Trip[], key: (t: Trip) => string | null): [string, number] | null {
  const m = new Map<string, number>();
  for (const t of trips) {
    const k = key(t);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  let best: [string, number] | null = null;
  for (const e of m) if (!best || e[1] > best[1]) best = [e[0], e[1]];
  return best;
}

/** Trips a person took part in (their code is in travelers). */
export function tripsOf(trips: Trip[], code: string): Trip[] {
  return trips.filter((t) => t.travelers?.includes(code));
}

export function personStats(trips: Trip[], code: string): PersonStats {
  const mine = tripsOf(trips, code);
  const countrySet = new Set<string>();
  let days = 0;
  let flights = 0;
  let longest: Trip | null = null;
  const years: number[] = [];
  for (const t of mine) {
    if (t.country_iso3) countrySet.add(t.country_iso3);
    days += t.days ?? 0;
    flights += flightLegs(t);
    if ((t.days ?? 0) > (longest?.days ?? -1)) longest = t;
    const y = yearOf(t);
    if (y != null) years.push(y);
  }
  return {
    code,
    trips: mine.length,
    days,
    countries: countrySet.size,
    countrySet,
    flights,
    longest,
    topCountry: topBy(mine, (t) => t.country),
    topPlace: topBy(mine, (t) => t.place),
    firstYear: years.length ? Math.min(...years) : null,
    lastYear: years.length ? Math.max(...years) : null,
  };
}

/** Home reference for "farthest trip" distance (configured in app settings). */
export type Home = { lat: number | null; lon: number | null; label: string };

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

// Compact ISO3 -> continent map (covers the data + common destinations).
const CONTINENT: Record<string, string> = {
  DEU: "Europa", AUT: "Europa", CHE: "Europa", FRA: "Europa", ITA: "Europa",
  ESP: "Europa", PRT: "Europa", NLD: "Europa", GBR: "Europa", SWE: "Europa",
  GRC: "Europa", DNK: "Europa", NOR: "Europa", BEL: "Europa", POL: "Europa",
  CZE: "Europa", HRV: "Europa", IRL: "Europa", ISL: "Europa", FIN: "Europa",
  HUN: "Europa", TUR: "Asien", ARE: "Asien", IDN: "Asien", LKA: "Asien",
  SGP: "Asien", THA: "Asien", MDV: "Asien", JPN: "Asien", CHN: "Asien",
  IND: "Asien", VNM: "Asien", KOR: "Asien", USA: "Nordamerika",
  CAN: "Nordamerika", MEX: "Nordamerika", CRI: "Nordamerika", CUB: "Nordamerika",
  BRA: "Südamerika", ARG: "Südamerika", PER: "Südamerika", CHL: "Südamerika",
  ZAF: "Afrika", EGY: "Afrika", MAR: "Afrika", TUN: "Afrika", KEN: "Afrika",
  TZA: "Afrika", CPV: "Afrika", AUS: "Ozeanien", NZL: "Ozeanien",
};

export type Overview = {
  busiestYear: [number, number] | null; // [year, trips]
  avgDuration: number;
  abroadPct: number; // share of trips outside DEU
  coverage: number; // distinct countries
  continents: string[];
  farthest: { place: string; country: string; km: number } | null;
  homeLabel: string;
  byMonth: { month: string; trips: number }[];
  topCountries: { country: string; trips: number; days: number }[];
};

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export function overviewStats(trips: Trip[], home: Home): Overview {
  const hasHome = home.lat != null && home.lon != null;
  const yearCount = new Map<number, number>();
  const monthCount = new Array(12).fill(0);
  const landAgg = new Map<string, { country: string; trips: number; days: number }>();
  const continentSet = new Set<string>();
  let abroad = 0;
  let totalDays = 0;
  let farthest: Overview["farthest"] = null;

  for (const t of trips) {
    const y = yearOf(t);
    if (y != null) yearCount.set(y, (yearCount.get(y) ?? 0) + 1);
    if (t.start_date) {
      const m = Number(t.start_date.slice(5, 7)) - 1;
      if (m >= 0 && m < 12) monthCount[m] += 1;
    }
    if (t.country) {
      const e = landAgg.get(t.country) ?? { country: t.country, trips: 0, days: 0 };
      e.trips += 1;
      e.days += t.days ?? 0;
      landAgg.set(t.country, e);
    }
    if (t.country_iso3) {
      if (t.country_iso3 !== "DEU") abroad += 1;
      const cont = CONTINENT[t.country_iso3];
      if (cont) continentSet.add(cont);
    }
    totalDays += t.days ?? 0;
    if (hasHome && t.lat != null && t.lon != null) {
      const km = haversineKm(home.lat!, home.lon!, t.lat, t.lon);
      if (!farthest || km > farthest.km) farthest = { place: t.place ?? "", country: t.country ?? "", km };
    }
  }

  let busiestYear: [number, number] | null = null;
  for (const e of yearCount) if (!busiestYear || e[1] > busiestYear[1]) busiestYear = [e[0], e[1]];

  const countrySet = new Set(trips.map((t) => t.country_iso3).filter(Boolean));

  return {
    busiestYear,
    avgDuration: trips.length ? Math.round((totalDays / trips.length) * 10) / 10 : 0,
    abroadPct: trips.length ? Math.round((abroad / trips.length) * 100) : 0,
    coverage: countrySet.size,
    continents: [...continentSet].sort(),
    farthest,
    homeLabel: home.label,
    byMonth: MONTHS.map((month, i) => ({ month, trips: monthCount[i] })),
    topCountries: [...landAgg.values()].sort((a, b) => b.trips - a.trips).slice(0, 5),
  };
}

export type DeepStats = {
  topDaysCountries: { country: string; days: number; trips: number }[];
  topDaysPlaces: { place: string; days: number; trips: number }[];
  topPlaces: { place: string; trips: number; days: number }[];
  byContinent: { name: string; value: number }[];
  growth: { year: number; total: number; added: number }[];
  travelModeByYear: { year: number; car: number; plane: number; train: number }[];
  coverage: number;
};

/** Richer analytics for the statistics page. */
export function deepStats(trips: Trip[]): DeepStats {
  const country = new Map<string, { country: string; days: number; trips: number }>();
  const place = new Map<string, { place: string; days: number; trips: number }>();
  const cont = new Map<string, number>();
  const firstYear = new Map<string, number>();
  const byYear = new Map<number, { year: number; car: number; plane: number; train: number }>();

  for (const t of trips) {
    const days = t.days ?? 0;
    const y = yearOf(t);
    if (t.country) {
      const e = country.get(t.country) ?? { country: t.country, days: 0, trips: 0 };
      e.days += days;
      e.trips += 1;
      country.set(t.country, e);
    }
    if (t.place) {
      const e = place.get(t.place) ?? { place: t.place, days: 0, trips: 0 };
      e.days += days;
      e.trips += 1;
      place.set(t.place, e);
    }
    if (t.country_iso3) {
      const c = CONTINENT[t.country_iso3];
      if (c) cont.set(c, (cont.get(c) ?? 0) + 1);
      if (y != null) firstYear.set(t.country_iso3, Math.min(firstYear.get(t.country_iso3) ?? y, y));
    }
    if (y != null) {
      const e = byYear.get(y) ?? { year: y, car: 0, plane: 0, train: 0 };
      if (t.travel_mode === "car" || t.travel_mode === "plane" || t.travel_mode === "train") e[t.travel_mode] += 1;
      byYear.set(y, e);
    }
  }

  const newByYear = new Map<number, number>();
  for (const y of firstYear.values()) newByYear.set(y, (newByYear.get(y) ?? 0) + 1);
  const years = [...new Set(trips.map(yearOf).filter((y): y is number => y != null))].sort((a, b) => a - b);
  let cum = 0;
  const growth = years.map((year) => {
    const added = newByYear.get(year) ?? 0;
    cum += added;
    return { year, total: cum, added };
  });

  return {
    topDaysCountries: [...country.values()].sort((a, b) => b.days - a.days).slice(0, 5),
    topDaysPlaces: [...place.values()].sort((a, b) => b.days - a.days).slice(0, 5),
    topPlaces: [...place.values()].sort((a, b) => b.trips - a.trips).slice(0, 5),
    byContinent: [...cont.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    growth,
    travelModeByYear: [...byYear.values()].sort((a, b) => a.year - b.year),
    coverage: new Set(trips.map((t) => t.country_iso3).filter(Boolean)).size,
  };
}

/** Total flown distance (great-circle) summed over every leg of every flight. */
export function totalFlightKm(trips: Trip[]): number {
  let km = 0;
  for (const t of trips) {
    if (t.travel_mode !== "plane" || t.departure_lat == null || t.departure_lon == null) continue;
    const destLat = t.arrival_lat ?? t.lat;
    const destLon = t.arrival_lon ?? t.lon;
    if (destLat == null || destLon == null) continue;
    const pts: [number, number][] = [[t.departure_lat, t.departure_lon]];
    for (const s of tripStops(t)) if (s.lat != null && s.lon != null) pts.push([s.lat, s.lon]);
    pts.push([destLat, destLon]);
    for (let i = 0; i < pts.length - 1; i++) {
      km += haversineKm(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    }
  }
  return km;
}

export type Achievement = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  current: number;
  target: number;
  earned: boolean;
};

export const ACHIEVEMENT_METRICS = [
  "trips",
  "countries",
  "continents",
  "flights",
  "maxDays",
  "maxKm",
  "familyTrips",
  "years",
] as const;
export type AchievementMetric = (typeof ACHIEVEMENT_METRICS)[number];

/** Compute every metric an achievement can be based on. */
export function achievementAggregates(
  trips: Trip[],
  allPersonCodes: string[],
  home: Home,
): Record<AchievementMetric, number> {
  const countries = new Set(trips.map((t) => t.country_iso3).filter(Boolean));
  const continents = new Set<string>();
  for (const c of countries) {
    const k = CONTINENT[c as string];
    if (k) continents.add(k);
  }
  const years = new Set(trips.map(yearOf).filter((y) => y != null));
  let maxKm = 0;
  if (home.lat != null && home.lon != null) {
    for (const t of trips) {
      if (t.lat != null && t.lon != null) maxKm = Math.max(maxKm, haversineKm(home.lat, home.lon, t.lat, t.lon));
    }
  }
  return {
    trips: trips.length,
    countries: countries.size,
    continents: continents.size,
    flights: totalFlights(trips),
    maxDays: trips.reduce((m, t) => Math.max(m, t.days ?? 0), 0),
    maxKm: Math.round(maxKm),
    familyTrips: allPersonCodes.length
      ? trips.filter((t) => allPersonCodes.every((c) => t.travelers?.includes(c))).length
      : 0,
    years: years.size,
  };
}

export type AchievementDef = {
  id: string;
  icon: string;
  title: string;
  description: string;
  metric: string;
  target: number;
  enabled: boolean;
};

/** Evaluate configurable achievement definitions against the aggregates. */
export function evaluateAchievements(
  defs: AchievementDef[],
  agg: Record<string, number>,
): Achievement[] {
  return defs
    .filter((d) => d.enabled)
    .map((d) => {
      const current = agg[d.metric] ?? 0;
      return {
        id: d.id,
        icon: d.icon,
        title: d.title,
        desc: d.description,
        current,
        target: d.target,
        earned: current >= d.target,
      };
    });
}

export type HeadToHead = {
  a: PersonStats;
  b: PersonStats;
  together: number; // trips both were on
  onlyA: number;
  onlyB: number;
  sharedCountries: number; // countries both have visited
};

export function headToHead(trips: Trip[], codeA: string, codeB: string): HeadToHead {
  const a = personStats(trips, codeA);
  const b = personStats(trips, codeB);
  let together = 0;
  for (const t of trips) {
    const w = t.travelers ?? [];
    if (w.includes(codeA) && w.includes(codeB)) together += 1;
  }
  let sharedCountries = 0;
  for (const c of a.countrySet) if (b.countrySet.has(c)) sharedCountries += 1;
  return {
    a,
    b,
    together,
    onlyA: a.trips - together,
    onlyB: b.trips - together,
    sharedCountries,
  };
}

// ---------------------------------------------------------------- ranked lists

/**
 * One row of a ranking. It carries both numbers, because the same list is sorted
 * once by visits and once by days, and the other number stays worth reading.
 */
export type Ranked = {
  key: string;
  label: string;
  /** Small second line: for a place its country, for a country nothing. */
  sub: string | null;
  /** Visits: a trip counts once, however long it was. */
  count: number;
  /** Days: summed over every trip there. */
  days: number;
};

export type RankBy = "count" | "days";

function rank(entries: Iterable<Ranked>, by: RankBy, limit: number): Ranked[] {
  const second: RankBy = by === "count" ? "days" : "count";
  return [...entries]
    .filter((e) => e[by] > 0)
    .sort((a, b) => b[by] - a[by] || b[second] - a[second] || a.label.localeCompare(b.label, "de"))
    .slice(0, limit);
}

/** The spelling of each country that was entered most often ("USA" vs "Vereinigte Staaten"). */
function commonCountryNames(trips: Trip[]): Map<string, string> {
  const spellings = new Map<string, Map<string, number>>();
  for (const t of trips) {
    if (!t.country_iso3 || !t.country) continue;
    const m = spellings.get(t.country_iso3) ?? new Map<string, number>();
    m.set(t.country, (m.get(t.country) ?? 0) + 1);
    spellings.set(t.country_iso3, m);
  }
  const out = new Map<string, string>();
  for (const [iso3, m] of spellings) {
    out.set(iso3, [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"))[0][0]);
  }
  return out;
}

/** Countries keyed by ISO-3, so different spellings of one country are counted together. */
export function rankedCountries(trips: Trip[], by: RankBy, limit = 10): Ranked[] {
  const names = commonCountryNames(trips);
  const map = new Map<string, Ranked>();
  for (const t of trips) {
    const key = t.country_iso3 ?? (t.country ? `name:${t.country}` : null);
    if (!key) continue;
    const e = map.get(key) ?? {
      key,
      label: (t.country_iso3 && names.get(t.country_iso3)) || t.country || key,
      sub: null,
      count: 0,
      days: 0,
    };
    e.count += 1;
    e.days += t.days ?? 0;
    map.set(key, e);
  }
  return rank(map.values(), by, limit);
}

/**
 * Places, merged case-insensitively (the first spelling wins). The second line
 * names the country, in its most common spelling.
 */
export function rankedPlaces(trips: Trip[], by: RankBy, limit = 10): Ranked[] {
  const names = commonCountryNames(trips);
  const map = new Map<string, Ranked>();
  for (const t of trips) {
    const name = t.place?.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase("de");
    const e = map.get(key) ?? {
      key,
      label: name,
      sub: (t.country_iso3 && names.get(t.country_iso3)) || t.country,
      count: 0,
      days: 0,
    };
    e.count += 1;
    e.days += t.days ?? 0;
    map.set(key, e);
  }
  return rank(map.values(), by, limit);
}

// ---------------------------------------------------------------- distributions

/** Trips per year, gap years included so a chart has no holes. */
export function tripsPerYear(trips: Trip[]): { year: number; trips: number; days: number }[] {
  const byYear = new Map<number, { trips: number; days: number }>();
  for (const t of trips) {
    const y = yearOf(t);
    if (y == null) continue;
    const e = byYear.get(y) ?? { trips: 0, days: 0 };
    e.trips += 1;
    e.days += t.days ?? 0;
    byYear.set(y, e);
  }
  if (byYear.size === 0) return [];
  const years = [...byYear.keys()];
  const out: { year: number; trips: number; days: number }[] = [];
  for (let y = Math.min(...years); y <= Math.max(...years); y++) {
    out.push({ year: y, ...(byYear.get(y) ?? { trips: 0, days: 0 }) });
  }
  return out;
}

/** How long a trip lasts, in the four lengths a family actually plans. */
export const STAY_BUCKETS = [
  { key: "weekend", upTo: 3 },
  { key: "week", upTo: 7 },
  { key: "fortnight", upTo: 14 },
  { key: "long", upTo: Number.POSITIVE_INFINITY },
] as const;

export type StayBucket = (typeof STAY_BUCKETS)[number]["key"];

export function stayLengths(trips: Trip[]): { key: StayBucket; count: number }[] {
  const counts = new Map<StayBucket, number>(STAY_BUCKETS.map((b) => [b.key, 0]));
  for (const t of trips) {
    const days = t.days ?? 0;
    if (days <= 0) continue;
    const bucket = STAY_BUCKETS.find((b) => days <= b.upTo) ?? STAY_BUCKETS[STAY_BUCKETS.length - 1];
    counts.set(bucket.key, (counts.get(bucket.key) ?? 0) + 1);
  }
  return STAY_BUCKETS.map((b) => ({ key: b.key, count: counts.get(b.key) ?? 0 }));
}
