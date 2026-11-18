"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { toIso3 } from "@/lib/iso";
import { geocode } from "@/lib/geocode";
import { computeDays } from "@/lib/trips";
import { getTripPhotos, type SignedPhoto } from "@/lib/data";
import { getT } from "@/lib/i18n/server";
import type { TravelMode } from "@/types/database.types";
import { requireSession, requireSessionOrShare } from "@/lib/session";
import { sniffImage } from "@/lib/image-sniff";

export type TripInput = {
  id?: string;
  place: string;
  country: string;
  category: string | null;
  travel_mode: TravelMode | null;
  departure_iata: string | null;
  arrival_iata: string | null;
  stops: string[]; // ordered intermediate stop IATA codes (Gabelflug)
  start_date: string | null;
  end_date: string | null;
  travelers: string[];
  other_travelers: string | null;
  comment: string | null;
};

const BUCKET = "trip-photos";
/** Per-file cap after client-side compression; generous for PNGs and HEIC from desktop. */
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const MAX_PHOTOS_PER_UPLOAD = 12;

/** Resolve a departure airport's coordinates: lookup, else geocode + remember. */
async function resolveAirport(
  supabase: ReturnType<typeof createAdminClient>,
  iata: string,
): Promise<{ lat: number; lon: number } | null> {
  const code = iata.trim().toUpperCase();
  const { data: found } = await supabase
    .from("airports")
    .select("lat, lon")
    .eq("iata", code)
    .maybeSingle();
  if (found) return { lat: Number(found.lat), lon: Number(found.lon) };

  const geo = await geocode(`${code} airport`, "");
  if (!geo) return null;
  // remember free-text airports so they autocomplete next time
  await supabase
    .from("airports")
    .upsert({ iata: code, name: code, lat: geo.lat, lon: geo.lon }, { onConflict: "iata" });
  return { lat: geo.lat, lon: geo.lon };
}

export async function saveTrip(input: TripInput): Promise<{ id: string }> {
  await requireSession();
  const supabase = createAdminClient();
  const country_iso3 = toIso3(input.country);
  const days = computeDays(input.start_date, input.end_date);
  const isFlight = input.travel_mode === "plane";

  // Reuse existing destination coords unless place/country changed (preserve manual edits)
  let lat: number | null = null;
  let lon: number | null = null;
  let existing: { place: string | null; country: string | null; lat: number | null; lon: number | null } | null =
    null;
  if (input.id) {
    const { data } = await supabase
      .from("trips")
      .select("place, country, lat, lon")
      .eq("id", input.id)
      .maybeSingle();
    existing = data;
  }
  if (existing && existing.place === input.place && existing.country === input.country && existing.lat != null) {
    lat = Number(existing.lat);
    lon = Number(existing.lon);
  } else if (input.place || input.country) {
    const geo = await geocode(input.place, input.country);
    if (geo) {
      lat = geo.lat;
      lon = geo.lon;
    }
  }

  // Departure airport coords (flights only)
  let departure_iata: string | null = null;
  let departure_lat: number | null = null;
  let departure_lon: number | null = null;
  if (isFlight && input.departure_iata?.trim()) {
    departure_iata = input.departure_iata.trim().toUpperCase();
    const ap = await resolveAirport(supabase, departure_iata);
    if (ap) {
      departure_lat = ap.lat;
      departure_lon = ap.lon;
    }
  }

  // Optional destination airport coords (flights only); else arc ends at the Ort
  let arrival_iata: string | null = null;
  let arrival_lat: number | null = null;
  let arrival_lon: number | null = null;
  if (isFlight && input.arrival_iata?.trim()) {
    arrival_iata = input.arrival_iata.trim().toUpperCase();
    const ap = await resolveAirport(supabase, arrival_iata);
    if (ap) {
      arrival_lat = ap.lat;
      arrival_lon = ap.lon;
    }
  }

  // Multi-leg stops (Gabelflug): resolve each IATA to coordinates, keep order
  const flight_stops: { iata: string; lat: number; lon: number }[] = [];
  if (isFlight) {
    for (const raw of input.stops) {
      const code = raw.trim().toUpperCase();
      if (!code) continue;
      const ap = await resolveAirport(supabase, code);
      if (ap) flight_stops.push({ iata: code, lat: ap.lat, lon: ap.lon });
    }
  }

  const row = {
    place: input.place || null,
    country: input.country || null,
    country_iso3,
    lat,
    lon,
    category: input.category,
    travel_mode: input.travel_mode,
    departure_iata,
    departure_lat,
    departure_lon,
    arrival_iata,
    arrival_lat,
    arrival_lon,
    flight_stops,
    start_date: input.start_date,
    end_date: input.end_date,
    days,
    travelers: input.travelers,
    other_travelers: input.other_travelers,
    comment: input.comment,
  };

  let id = input.id;
  if (id) {
    const { error } = await supabase.from("trips").update(row).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("trips").insert(row).select("id").single();
    if (error) throw error;
    id = data.id;
  }

  revalidatePath("/");
  return { id: id! };
}

export async function fetchTripPhotos(tripId: string, shareToken?: string | null): Promise<SignedPhoto[]> {
  await requireSessionOrShare(shareToken);
  return getTripPhotos(tripId);
}

export type AirportHit = { iata: string; name: string; city: string | null };

/** Search airports by IATA code, city or name (for the form's combobox). */
export async function searchAirports(q: string): Promise<AirportHit[]> {
  await requireSession();
  const query = q.trim().replace(/[,%*()]/g, "");
  if (query.length < 2) return [];
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("airports")
    .select("iata, name, city")
    .or(`iata.ilike.${query}%,city.ilike.%${query}%,name.ilike.%${query}%`)
    .limit(20);
  const rows = data ?? [];
  const ql = query.toLowerCase();
  const rank = (a: AirportHit) =>
    a.iata.toLowerCase() === ql ? 0
    : a.iata.toLowerCase().startsWith(ql) ? 1
    : (a.city ?? "").toLowerCase().startsWith(ql) ? 2
    : 3;
  return rows.sort((a, b) => rank(a) - rank(b)).slice(0, 8);
}

export async function addWish(country: string): Promise<{ ok: boolean; error?: string }> {
  await requireSession();
  const t = await getT();
  const name = country.trim();
  if (!name) return { ok: false, error: t("form.countryMissing") };
  const iso3 = toIso3(name);
  if (!iso3) return { ok: false, error: t("dest.countryNotFound", { name }) };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("wishlist")
    .upsert({ iso3, country: name }, { onConflict: "iso3" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/destinations");
  return { ok: true };
}

export async function removeWish(iso3: string): Promise<void> {
  await requireSession();
  const supabase = createAdminClient();
  await supabase.from("wishlist").delete().eq("iso3", iso3);
  revalidatePath("/destinations");
}

export async function deleteTrip(id: string): Promise<void> {
  await requireSession();
  const supabase = createAdminClient();
  // remove stored photos for this trip
  const { data: files } = await supabase.storage.from(BUCKET).list(id);
  if (files?.length) {
    await supabase.storage.from(BUCKET).remove(files.map((f) => `${id}/${f.name}`));
  }
  const { error } = await supabase.from("trips").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/");
}

export type UploadResult = { ok: true; added: number } | { ok: false; error: "count" | "size" | "type" | "upload" };

/**
 * Upload photos for a trip. Every file is identified by its magic bytes (JPEG,
 * PNG, WebP, HEIC only) and stored under a random name. A row that fails to
 * insert takes its storage object back out. The first photo becomes the cover
 * if none is set yet.
 */
export async function uploadPhotos(tripId: string, formData: FormData): Promise<UploadResult> {
  await requireSession();
  const supabase = createAdminClient();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: true, added: 0 };
  if (files.length > MAX_PHOTOS_PER_UPLOAD) return { ok: false, error: "count" };

  const { data: trip } = await supabase
    .from("trips")
    .select("id, cover_photo_url")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return { ok: false, error: "upload" };

  const { data: existing } = await supabase.from("trip_photos").select("sort").eq("trip_id", tripId);
  let sort = Math.max(0, ...(existing ?? []).map((r) => (r.sort ?? 0) + 1));
  let cover = trip.cover_photo_url ?? null;
  let added = 0;

  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "size" };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) return { ok: false, error: "type" };

    const path = `${tripId}/${crypto.randomUUID()}.${kind.ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: kind.type, upsert: false });
    if (upErr) return { ok: false, error: "upload" };

    const { error: rowErr } = await supabase.from("trip_photos").insert({ trip_id: tripId, url: path, sort: sort++ });
    if (rowErr) {
      await supabase.storage.from(BUCKET).remove([path]);
      return { ok: false, error: "upload" };
    }
    if (!cover) cover = path;
    added++;
  }

  if (cover && cover !== trip.cover_photo_url) {
    await supabase.from("trips").update({ cover_photo_url: cover }).eq("id", tripId);
  }
  revalidatePath("/");
  return { ok: true, added };
}

/** Only a photo that actually belongs to the trip can become its cover. */
export async function setCoverPhoto(tripId: string, path: string): Promise<void> {
  await requireSession();
  const supabase = createAdminClient();
  const { data: photo } = await supabase
    .from("trip_photos")
    .select("url")
    .eq("trip_id", tripId)
    .eq("url", path)
    .maybeSingle();
  if (!photo) throw new Error("Photo not found");
  const { error } = await supabase.from("trips").update({ cover_photo_url: photo.url }).eq("id", tripId);
  if (error) throw error;
  revalidatePath("/");
}

/**
 * The storage path is looked up from the row, never taken from the client, so
 * this can only ever remove a trip photo. Deleting the cover promotes the next one.
 */
export async function deletePhoto(photoId: string): Promise<void> {
  await requireSession();
  const supabase = createAdminClient();
  const { data: photo } = await supabase
    .from("trip_photos")
    .select("id, trip_id, url")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return;

  const { error } = await supabase.from("trip_photos").delete().eq("id", photoId);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([photo.url]);

  const { data: trip } = await supabase
    .from("trips")
    .select("cover_photo_url")
    .eq("id", photo.trip_id)
    .maybeSingle();
  if (trip?.cover_photo_url === photo.url) {
    const { data: next } = await supabase
      .from("trip_photos")
      .select("url")
      .eq("trip_id", photo.trip_id)
      .order("sort")
      .limit(1)
      .maybeSingle();
    await supabase.from("trips").update({ cover_photo_url: next?.url ?? null }).eq("id", photo.trip_id);
  }
  revalidatePath("/");
}
