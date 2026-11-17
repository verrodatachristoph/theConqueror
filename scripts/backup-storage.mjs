// Backup / restore all objects of a Supabase Storage bucket.
//
//   node scripts/backup-storage.mjs download trip-photos backup/2026-09-05/storage
//   node scripts/backup-storage.mjs upload   trip-photos backup/2026-09-05/storage
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
// (override with SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars, e.g. when
// uploading into a freshly created project).
import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import path from "node:path";

const [mode, bucket, dir] = process.argv.slice(2);
if (!["download", "upload"].includes(mode) || !bucket || !dir) {
  console.error("usage: backup-storage.mjs <download|upload> <bucket> <dir>");
  process.exit(1);
}

async function loadEnv() {
  try {
    const txt = await fs.readFile(path.resolve(".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}
await loadEnv();
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
const sb = createClient(url, key, { auth: { persistSession: false } });

async function listAll(prefix = "") {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const e of data) {
      const full = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id === null) out.push(...(await listAll(full))); // folder
      else out.push({ key: full, size: e.metadata?.size ?? null, contentType: e.metadata?.mimetype ?? null });
    }
    if (data.length < 1000) break;
    offset += data.length;
  }
  return out;
}

const target = path.resolve(dir, bucket);
const manifestFile = path.resolve(dir, `${bucket}.manifest.json`);

if (mode === "download") {
  const objects = await listAll();
  await fs.mkdir(target, { recursive: true });
  for (const o of objects) {
    const { data, error } = await sb.storage.from(bucket).download(o.key);
    if (error) throw new Error(`${o.key}: ${error.message}`);
    const file = path.join(target, o.key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const buf = Buffer.from(await data.arrayBuffer());
    await fs.writeFile(file, buf);
    o.bytesWritten = buf.length;
    console.log(`downloaded ${o.key} (${buf.length} bytes)`);
  }
  await fs.writeFile(manifestFile, JSON.stringify({ bucket, exportedAt: new Date().toISOString(), objects }, null, 2));
  console.log(`\n${objects.length} objects -> ${target}\nmanifest -> ${manifestFile}`);
} else {
  const manifest = JSON.parse(await fs.readFile(manifestFile, "utf8"));
  const { data: buckets } = await sb.storage.listBuckets();
  if (!buckets?.some((b) => b.name === bucket)) {
    const { error } = await sb.storage.createBucket(bucket, { public: false });
    if (error) throw error;
    console.log(`created bucket ${bucket}`);
  }
  for (const o of manifest.objects) {
    const buf = await fs.readFile(path.join(target, o.key));
    const { error } = await sb.storage.from(bucket).upload(o.key, buf, { contentType: o.contentType ?? undefined, upsert: true });
    if (error) throw new Error(`${o.key}: ${error.message}`);
    console.log(`uploaded ${o.key} (${buf.length} bytes)`);
  }
  console.log(`\n${manifest.objects.length} objects uploaded to ${bucket}`);
}
