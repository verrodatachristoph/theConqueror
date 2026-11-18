import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFilters, filterOptions, fold } from "@/lib/search";
import { trip } from "./fixtures";

test("fold drops case and diacritics and expands ß", () => {
  assert.equal(fold("Österreich"), "osterreich");
  assert.equal(fold("Straße"), "strasse");
  assert.equal(fold("Île-de-France"), "ile-de-france");
});

test("search finds a country typed without umlauts", () => {
  const t = trip();
  assert.deepEqual(applyFilters([t], { search: "osterreich" }), [t]);
});

test("several words must all occur, in any field", () => {
  const a = trip({ place: "Bangkok", country: "Thailand", country_iso3: "THA", comment: "Tempel" });
  const b = trip({ place: "Bangkok", country: "Thailand", country_iso3: "THA", comment: "Strand" });
  assert.deepEqual(applyFilters([a, b], { search: "bangkok tempel" }), [a]);
});

test("search reaches airport codes, including stopovers", () => {
  const t = trip({ travel_mode: "plane", departure_iata: "FRA", flight_stops: [{ iata: "DXB", lat: 0, lon: 0 }] });
  assert.deepEqual(applyFilters([t], { search: "dxb" }), [t]);
});

test("a localized travel-mode label is searchable", () => {
  const t = trip({ travel_mode: "train" });
  assert.deepEqual(applyFilters([t], { search: "rail" }, () => "Rail"), [t]);
  assert.deepEqual(applyFilters([t], { search: "rail" }), []);
});

test("facets combine with each other and with the search", () => {
  const a = trip({ start_date: "2020-07-01", travel_mode: "plane" });
  const b = trip({ start_date: "2021-07-01", travel_mode: "plane" });
  const c = trip({ start_date: "2021-07-01", travel_mode: "car" });
  assert.deepEqual(applyFilters([a, b, c], { year: "2021", mode: "plane" }), [b]);
});

test("filter options carry counts and never offer an empty choice", () => {
  const options = filterOptions([
    trip({ country_iso3: "AUT", start_date: "2020-01-01" }),
    trip({ country_iso3: "AUT", start_date: "2021-01-01" }),
    trip({ country: "Italien", country_iso3: "ITA", start_date: "2021-05-01", category: null }),
  ]);
  assert.deepEqual(
    options.countries.map((o) => [o.value, o.count]),
    [["AUT", 2], ["ITA", 1]],
  );
  assert.deepEqual(options.years.map((o) => o.value), ["2021", "2020"]);
  assert.deepEqual(options.categories.map((o) => [o.value, o.count]), [["Hotel", 2]]);
});
