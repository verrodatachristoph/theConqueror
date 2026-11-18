import { test } from "node:test";
import assert from "node:assert/strict";
import { applySelection, filterTrips } from "@/lib/trips";
import { trip } from "./fixtures";

const family = ["C", "M", "P", "N"];
const solo = trip({ travelers: ["C"] });
const pair = trip({ travelers: ["C", "M"] });
const all = trip({ travelers: ["C", "M", "P", "N"] });
const trips = [solo, pair, all];

test("an empty selection filters nothing", () => {
  assert.deepEqual(filterTrips(trips, new Set()), trips);
});

test("a chosen person means 'was along' (OR)", () => {
  assert.deepEqual(filterTrips(trips, new Set(["M", "P"])), [pair, all]);
});

test("together narrows to trips every chosen person was on (AND)", () => {
  assert.deepEqual(filterTrips(trips, new Set(["C", "M"]), true), [pair, all]);
  assert.deepEqual(filterTrips(trips, new Set(["M", "P"]), true), [all]);
});

test("everyone + together asks for the trips the whole family made", () => {
  assert.deepEqual(applySelection(trips, new Set(), true, family), [all]);
});

test("together is meaningless for a single person and is ignored", () => {
  assert.deepEqual(applySelection(trips, new Set(["C"]), true, family), trips);
});

test("unknown codes in a selection are skipped, not matched", () => {
  assert.deepEqual(applySelection(trips, new Set(["X"]), false, family), trips);
});
