import "server-only";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Dev-only stand-in for the Supabase service-role client.
 *
 * With `DEV_DEMO=1` under `next dev`, the app runs without any Supabase project:
 * tables live in .demo-data/db.json (seeded from demo/sample-db.json, or built by
 * scripts/demo-import.mjs from a
 * backup), photos in .demo-data/storage/<bucket>/. Writes are applied in memory
 * and flushed back to db.json, so they survive a restart.
 *
 * It implements exactly the subset of the query builder this app uses — select
 * (with column lists and `{ count, head }`), insert/update/upsert/delete, eq,
 * match, the airport `or(...ilike...)` search, order, limit, single/maybeSingle —
 * plus storage upload/remove/list/createSignedUrls. A production build never
 * reaches this file (see demoMode()).
 */

export function demoMode(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DEV_DEMO === "1";
}

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

const ROOT = path.join(process.cwd(), ".demo-data");
const DB_FILE = path.join(ROOT, "db.json");
/** Fictional sample data (committed); copied to .demo-data/ on first start. */
const SAMPLE_FILE = path.join(process.cwd(), "demo", "sample-db.json");

// Survive Next's module reloading in dev.
const g = globalThis as unknown as { __demoDb?: Tables };

function db(): Tables {
  if (!g.__demoDb) {
    if (!existsSync(DB_FILE)) {
      // A fresh clone has no local data: start from the fictional sample that ships
      // with the repo. Your own data comes from scripts/demo-import.mjs instead.
      mkdirSync(ROOT, { recursive: true });
      writeFileSync(DB_FILE, readFileSync(SAMPLE_FILE, "utf8"));
      console.info("[demo] .demo-data/db.json created from demo/sample-db.json");
    }
    g.__demoDb = JSON.parse(readFileSync(DB_FILE, "utf8")) as Tables;
  }
  return g.__demoDb;
}

function flush() {
  writeFileSync(DB_FILE, JSON.stringify(db()));
}

const table = (name: string) => (db()[name] ??= []);

/** Tables whose primary key isn't `id`, for upserts without onConflict. */
const PRIMARY: Record<string, string> = {
  persons: "code",
  airports: "iata",
  wishlist: "iso3",
  travel_plans: "slug",
  geocode_cache: "query",
};

/** Tables that get a generated uuid id when none is given. */
const UUID_TABLES = new Set(["trips", "trip_photos"]);

type Filter = (r: Row) => boolean;
type Result = { data: unknown; error: null | { message: string }; count?: number | null };

function project(row: Row, columns: string): Row {
  if (columns.trim() === "*") return { ...row };
  const out: Row = {};
  for (const c of columns.split(",").map((s) => s.trim()).filter(Boolean)) out[c] = row[c];
  return out;
}

function likeToRegex(pattern: string): RegExp {
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${esc}$`, "i");
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls last
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

class Query implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private max: number | null = null;
  private columns: string | null = null;
  private countOpt = false;
  private headOpt = false;
  private mode: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row[] = [];
  private patch: Row = {};
  private conflict: string | null = null;
  private one: "single" | "maybe" | null = null;

  constructor(private readonly name: string) {}

  select(columns = "*", opts?: { count?: string; head?: boolean }) {
    this.columns = columns;
    this.countOpt = !!opts?.count;
    this.headOpt = !!opts?.head;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.mode = "insert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.mode = "upsert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflict = opts?.onConflict ?? null;
    return this;
  }
  update(patch: Row) {
    this.mode = "update";
    this.patch = patch;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  eq(col: string, value: unknown) {
    this.filters.push((r) => r[col] === value);
    return this;
  }
  match(obj: Row) {
    for (const [k, v] of Object.entries(obj)) this.eq(k, v);
    return this;
  }
  /** Only the `col.ilike.pattern,...` form, which is all this app sends. */
  or(expr: string) {
    const parts = expr.split(",").map((p) => {
      const [col, op, ...rest] = p.split(".");
      if (op !== "ilike") throw new Error(`demo client: unsupported or() operator ${op}`);
      return { col, re: likeToRegex(rest.join(".")) };
    });
    this.filters.push((r) => parts.some(({ col, re }) => re.test(String(r[col] ?? ""))));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending ?? true });
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  single() {
    this.one = "single";
    return this;
  }
  maybeSingle() {
    this.one = "maybe";
    return this;
  }

  private matches(r: Row) {
    return this.filters.every((f) => f(r));
  }

  private run(): Result {
    const rows = table(this.name);
    let touched: Row[] = [];

    if (this.mode === "insert" || this.mode === "upsert") {
      const key = this.conflict ?? PRIMARY[this.name] ?? "id";
      for (const input of this.payload) {
        const row: Row = { ...input };
        if (UUID_TABLES.has(this.name) && row.id == null) row.id = randomUUID();
        const existing = this.mode === "upsert" ? rows.find((r) => r[key] === row[key]) : undefined;
        if (existing) {
          Object.assign(existing, row);
          touched.push(existing);
        } else {
          row.created_at ??= new Date().toISOString();
          rows.push(row);
          touched.push(row);
        }
      }
      flush();
    } else if (this.mode === "update") {
      touched = rows.filter((r) => this.matches(r));
      for (const r of touched) Object.assign(r, this.patch);
      if (touched.length) flush();
    } else if (this.mode === "delete") {
      touched = rows.filter((r) => this.matches(r));
      db()[this.name] = rows.filter((r) => !this.matches(r));
      if (touched.length) flush();
    } else {
      touched = rows.filter((r) => this.matches(r));
    }

    // Writes return nothing unless .select() was chained, like PostgREST.
    if (this.mode !== "select" && this.columns === null) return { data: null, error: null };

    let out = [...touched];
    for (const { col, asc } of [...this.orders].reverse()) {
      out.sort((a, b) => (asc ? 1 : -1) * compare(a[col], b[col]));
    }
    const count = out.length;
    if (this.max != null) out = out.slice(0, this.max);
    const data = out.map((r) => project(r, this.columns ?? "*"));

    if (this.headOpt) return { data: null, error: null, count };
    if (this.one) {
      if (data.length === 0) {
        return this.one === "single"
          ? { data: null, error: { message: "demo client: no rows" } }
          : { data: null, error: null };
      }
      return { data: data[0], error: null };
    }
    return { data, error: null, count: this.countOpt ? count : null };
  }

  then<A = Result, B = never>(
    onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    try {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    } catch (e) {
      return Promise.reject(e).then(onfulfilled, onrejected);
    }
  }
}

/** Resolve a storage object path inside the bucket folder, refusing traversal. */
function objectFile(bucket: string, objectPath: string): string {
  const base = path.join(ROOT, "storage", bucket);
  const file = path.resolve(base, objectPath);
  if (!file.startsWith(base + path.sep)) throw new Error("demo storage: invalid path");
  return file;
}

export function demoObjectFile(bucket: string, objectPath: string): string | null {
  try {
    const file = objectFile(bucket, objectPath);
    return existsSync(file) ? file : null;
  } catch {
    return null;
  }
}

function bucket(name: string) {
  return {
    async upload(objectPath: string, body: Uint8Array | ArrayBuffer | Blob) {
      const file = objectFile(name, objectPath);
      mkdirSync(path.dirname(file), { recursive: true });
      const bytes =
        body instanceof Blob ? new Uint8Array(await body.arrayBuffer()) : new Uint8Array(body as ArrayBuffer);
      writeFileSync(file, bytes);
      return { data: { path: objectPath }, error: null };
    },
    async remove(paths: string[]) {
      for (const p of paths) rmSync(objectFile(name, p), { force: true });
      return { data: paths.map((p) => ({ name: p })), error: null };
    },
    async list(prefix: string) {
      const dir = path.join(ROOT, "storage", name, prefix);
      const entries = existsSync(dir) ? readdirSync(dir) : [];
      return { data: entries.map((n) => ({ name: n })), error: null };
    },
    async createSignedUrls(paths: string[]) {
      return {
        data: paths.map((p) => ({
          path: p,
          signedUrl: `/api/demo-storage/${name}/${p.split("/").map(encodeURIComponent).join("/")}`,
          error: null,
        })),
        error: null,
      };
    },
  };
}

export function createDemoClient() {
  return {
    from: (name: string) => new Query(name),
    storage: { from: bucket },
  };
}
