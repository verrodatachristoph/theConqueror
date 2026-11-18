#!/usr/bin/env node
// Build the local demo dataset (.demo-data/) from a Supabase backup.
//
//   node scripts/demo-import.mjs <data_public.sql> [<storage/trip-photos dir>]
//
// Reads the INSERT statements of a `pg_dump --data-only --inserts` style export,
// writes .demo-data/db.json (one array per table) and copies the photo objects to
// .demo-data/storage/trip-photos/. The folder is gitignored: it holds real data.
// Used by the dev-only demo mode (DEV_DEMO=1, see src/lib/supabase/demo.ts).

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import path from "node:path";

const [sqlPath, storageDir] = process.argv.slice(2);
if (!sqlPath) {
  console.error("usage: node scripts/demo-import.mjs <data_public.sql> [<storage/trip-photos dir>]");
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8");
const out = path.resolve(import.meta.dirname, "..", ".demo-data");

/** Tokenise one VALUES (...) tuple: quoted strings ('' escapes), NULL, numbers, booleans. */
function parseTuple(src, start) {
  const values = [];
  let i = start;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "," || c === "\n") { i++; continue; }
    if (c === ")") return { values, end: i + 1 };
    if (c === "'") {
      let s = "";
      i++;
      for (;;) {
        if (src[i] === "'" && src[i + 1] === "'") { s += "'"; i += 2; continue; }
        if (src[i] === "'") { i++; break; }
        s += src[i++];
      }
      values.push({ str: s });
      continue;
    }
    let j = i;
    while (j < src.length && src[j] !== "," && src[j] !== ")") j++;
    const raw = src.slice(i, j).trim();
    values.push(raw === "NULL" ? null : raw === "true" ? true : raw === "false" ? false : Number(raw));
    i = j;
  }
  throw new Error("unterminated tuple");
}

/** Postgres text[] literal → JS array. */
function pgArray(s) {
  const inner = s.slice(1, -1);
  return inner ? inner.split(",").map((v) => v.replace(/^"|"$/g, "")) : [];
}

const tables = {};
const re = /INSERT INTO public\.(\w+) \(([^)]*)\) VALUES \(/g;
let m;
while ((m = re.exec(sql))) {
  const [, table, colList] = m;
  const cols = colList.split(",").map((c) => c.trim());
  const { values, end } = parseTuple(sql, re.lastIndex);
  re.lastIndex = end;
  const row = {};
  cols.forEach((col, k) => {
    const v = values[k];
    if (v && typeof v === "object" && "str" in v) {
      const s = v.str;
      if (col === "travelers") row[col] = pgArray(s);
      else if (col === "flight_stops") row[col] = JSON.parse(s);
      else row[col] = s;
    } else row[col] = v;
  });
  if (table === "trips" && row.flight_stops == null) row.flight_stops = [];
  (tables[table] ??= []).push(row);
}

// Never ship credentials into the demo set, even locally.
delete tables.allowed_emails;
for (const s of tables.app_settings ?? []) s.password_hash = null;

mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "db.json"), JSON.stringify(tables));
console.log(Object.entries(tables).map(([t, rows]) => `${t}: ${rows.length}`).join("\n"));

if (storageDir) {
  if (!existsSync(storageDir)) throw new Error(`no such dir: ${storageDir}`);
  cpSync(storageDir, path.join(out, "storage", "trip-photos"), { recursive: true });
  console.log(`photos copied from ${storageDir}`);
}
