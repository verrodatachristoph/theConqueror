import type { Trip } from "@/types/database.types";

let n = 0;

/** A complete trip row with sensible defaults; override what a test cares about. */
export const trip = (patch: Partial<Trip> = {}): Trip => ({
  id: `t${++n}`,
  place: "Innsbruck",
  country: "Österreich",
  country_iso3: "AUT",
  lat: null,
  lon: null,
  category: "Hotel",
  travel_mode: "car",
  departure_iata: null,
  departure_lat: null,
  departure_lon: null,
  arrival_iata: null,
  arrival_lat: null,
  arrival_lon: null,
  flight_stops: [],
  start_date: "2019-02-14",
  end_date: "2019-02-21",
  days: 8,
  travelers: ["C"],
  other_travelers: null,
  comment: null,
  cover_photo_url: null,
  created_at: "2019-01-01T00:00:00Z",
  ...patch,
});
