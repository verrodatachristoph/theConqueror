import { test } from "node:test";
import assert from "node:assert/strict";
import { rankedCountries, rankedPlaces, stayLengths, tripsPerYear } from "@/lib/stats";
import { trip } from "./fixtures";

test("countries rank by ISO-3, so different spellings count together", () => {
  const rows = rankedCountries(
    [
      trip({ country: "USA", country_iso3: "USA", days: 3 }),
      trip({ country: "USA", country_iso3: "USA", days: 4 }),
      trip({ country: "Vereinigte Staaten", country_iso3: "USA", days: 10 }),
      trip({ country: "Italien", country_iso3: "ITA", days: 20 }),
    ],
    "count",
  );
  assert.deepEqual(rows[0], { key: "USA", label: "USA", sub: null, count: 3, days: 17 });
});

test("the same ranking sorted by days answers a different question", () => {
  const trips = [
    trip({ country_iso3: "AUT", days: 2 }),
    trip({ country_iso3: "AUT", days: 2 }),
    trip({ country: "Italien", country_iso3: "ITA", days: 14 }),
  ];
  assert.equal(rankedCountries(trips, "count")[0].key, "AUT");
  assert.equal(rankedCountries(trips, "days")[0].key, "ITA");
});

test("places merge case-insensitively and name their country", () => {
  const rows = rankedPlaces([trip({ place: "Innsbruck" }), trip({ place: "innsbruck " })], "count");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].count, 2);
  assert.equal(rows[0].sub, "Österreich");
});

test("trips per year include gap years", () => {
  const rows = tripsPerYear([trip({ start_date: "2018-01-01" }), trip({ start_date: "2020-06-01" })]);
  assert.deepEqual(rows.map((r) => [r.year, r.trips]), [[2018, 1], [2019, 0], [2020, 1]]);
});

test("stay lengths fall into four buckets", () => {
  const rows = stayLengths([trip({ days: 2 }), trip({ days: 3 }), trip({ days: 7 }), trip({ days: 10 }), trip({ days: 30 })]);
  assert.deepEqual(rows.map((r) => [r.key, r.count]), [["weekend", 2], ["week", 1], ["fortnight", 1], ["long", 1]]);
});
