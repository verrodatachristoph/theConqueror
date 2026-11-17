"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Person } from "@/types/database.types";
import type { AchievementDef } from "@/lib/data";
import type { PublicSettings } from "@/lib/settings";
import type { PlanSummary } from "@/lib/plans";
import { ACHIEVEMENT_METRICS } from "@/lib/stats";
import { normalizeSlug } from "@/lib/plan-slug";
import TopNav from "@/components/TopNav";
import { useT } from "@/components/i18n/LanguageProvider";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import {
  createPerson,
  updatePerson,
  deletePerson,
  saveSettings,
  geocodeHome,
  changePassword,
  saveAchievement,
  deleteAchievement,
  updateSharing,
  createPlan,
  updatePlan,
  replacePlanHtml,
  setPlanPassword,
  deletePlan,
} from "@/app/admin-actions";

const input = "rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

export default function AdminPage({
  persons,
  settings,
  achievementDefs,
  plans,
}: {
  persons: Person[];
  settings: PublicSettings;
  achievementDefs: AchievementDef[];
  plans: PlanSummary[];
}) {
  const t = useT();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-10">
      <TopNav />
      <div className="max-w-4xl">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t("nav.admin")}</h1>
        <AppearanceSection />
        <PersonsSection persons={persons} onChange={refresh} />
        <SettingsSection settings={settings} onChange={refresh} />
        <PasswordSection />
        <SharingSection token={settings.shareToken} onChange={refresh} />
        <PlansSection plans={plans} onChange={refresh} />
        <AchievementsSection defs={achievementDefs} onChange={refresh} />
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function AppearanceSection() {
  const t = useT();
  return (
    <Section title={t("settings.appearance")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-4 sm:justify-start">
          <span className="text-sm text-muted">{t("settings.languageHint")}</span>
          <LanguageSwitcher />
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-start">
          <span className="text-sm text-muted">{t("settings.theme")}</span>
          <ThemeToggle />
        </div>
      </div>
    </Section>
  );
}

// ── Persons ──────────────────────────────────────────────────────────────────
function PersonsSection({ persons, onChange }: { persons: Person[]; onChange: () => void }) {
  const t = useT();
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b6ea5");
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setErr(null);
    const res = await createPerson(newCode, newName, newColor);
    if (!res.ok) return setErr(res.error ?? t("admin.error"));
    setNewCode("");
    setNewName("");
    onChange();
  }

  return (
    <Section title={t("admin.persons.title")}>
      <div className="space-y-2">
        {persons.map((p) => (
          <PersonRow key={p.code} person={p} onChange={onChange} />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <input
          className={`${input} w-16`}
          placeholder={t("admin.persons.code")}
          maxLength={3}
          value={newCode}
          onChange={(e) => setNewCode(e.target.value.toUpperCase())}
        />
        <input
          className={`${input} flex-1`}
          placeholder={t("admin.persons.name")}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          type="color"
          className="h-9 w-12 cursor-pointer rounded border border-line"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
        />
        <button onClick={add} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-surface">
          {t("admin.persons.create")}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-[var(--color-arc)]">{err}</p>}
    </Section>
  );
}

function PersonRow({ person, onChange }: { person: Person; onChange: () => void }) {
  const t = useT();
  const [name, setName] = useState(person.name);
  const [color, setColor] = useState(person.color);
  const dirty = name !== person.name || color !== person.color;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {person.code}
      </span>
      <input className={`${input} flex-1`} value={name} onChange={(e) => setName(e.target.value)} />
      <input
        type="color"
        className="h-9 w-12 cursor-pointer rounded border border-line"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />
      <button
        disabled={!dirty}
        onClick={async () => {
          await updatePerson(person.code, name, color);
          onChange();
        }}
        className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-40"
      >
        {t("common.save")}
      </button>
      <button
        onClick={async () => {
          if (confirm(t("admin.persons.confirmDelete", { name: person.name }))) {
            await deletePerson(person.code);
            onChange();
          }
        }}
        className="rounded-lg px-2 py-2 text-sm text-[var(--color-arc)] hover:underline"
      >
        {t("common.delete")}
      </button>
    </div>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────
function SettingsSection({ settings, onChange }: { settings: PublicSettings; onChange: () => void }) {
  const t = useT();
  const [label, setLabel] = useState(settings.homeLabel);
  const [lat, setLat] = useState(settings.homeLat?.toString() ?? "");
  const [lon, setLon] = useState(settings.homeLon?.toString() ?? "");
  const [airport, setAirport] = useState(settings.defaultAirport ?? "");
  const [geoQuery, setGeoQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function doGeocode() {
    setMsg(null);
    const res = await geocodeHome(geoQuery);
    if (!res) return setMsg(t("admin.home.notFound"));
    setLat(res.lat.toFixed(4));
    setLon(res.lon.toFixed(4));
    if (!label.trim()) setLabel(geoQuery);
  }

  async function save() {
    setMsg(null);
    const res = await saveSettings({
      home_label: label,
      home_lat: lat ? Number(lat) : null,
      home_lon: lon ? Number(lon) : null,
      default_airport: airport || null,
    });
    setMsg(res.ok ? t("admin.saved") : res.error ?? t("admin.error"));
    if (res.ok) onChange();
  }

  return (
    <Section title={t("admin.home.title")}>
      <p className="mb-3 text-xs text-muted">
        {t("admin.home.hint")}
      </p>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-xs text-muted">{t("admin.home.search")}</span>
          <input
            className={`${input} w-full`}
            placeholder={t("admin.home.searchPlaceholder")}
            value={geoQuery}
            onChange={(e) => setGeoQuery(e.target.value)}
          />
        </label>
        <button onClick={doGeocode} className="rounded-lg border border-line px-3 py-2 text-sm">
          {t("admin.home.fetchCoords")}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Labeled label={t("admin.home.label")}>
          <input className={`${input} w-full`} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Labeled>
        <Labeled label={t("admin.home.lat")}>
          <input className={`${input} w-full`} value={lat} onChange={(e) => setLat(e.target.value)} />
        </Labeled>
        <Labeled label={t("admin.home.lon")}>
          <input className={`${input} w-full`} value={lon} onChange={(e) => setLon(e.target.value)} />
        </Labeled>
        <Labeled label={t("admin.home.defaultAirport")}>
          <input
            className={`${input} w-full`}
            placeholder={t("admin.home.airportPlaceholder")}
            value={airport}
            onChange={(e) => setAirport(e.target.value.toUpperCase())}
          />
        </Labeled>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-surface">
          {t("common.save")}
        </button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </Section>
  );
}

function SharingSection({ token, onChange }: { token: string | null; onChange: () => void }) {
  const t = useT();
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLink(token ? `${window.location.origin}/s/${token}` : "");
  }, [token]);

  const act = async (a: "enable" | "regenerate" | "disable") => {
    setBusy(true);
    await updateSharing(a);
    setBusy(false);
    onChange();
  };

  return (
    <Section title={t("admin.sharing.title")}>
      <p className="mb-3 text-xs text-muted">
        {t("admin.sharing.hint")}
      </p>
      {token ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={`${input} flex-1`} />
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded-lg border border-line px-3 py-2 text-sm"
            >
              {copied ? t("admin.sharing.copied") : t("admin.sharing.copy")}
            </button>
            <a href={link} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-2 text-sm">
              {t("admin.sharing.open")}
            </a>
          </div>
          <div className="flex gap-4 text-sm">
            <button onClick={() => act("regenerate")} disabled={busy} className="text-muted hover:text-ink disabled:opacity-50">
              {t("admin.sharing.regenerate")}
            </button>
            <button onClick={() => act("disable")} disabled={busy} className="text-[var(--color-arc)] hover:underline disabled:opacity-50">
              {t("admin.sharing.disable")}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => act("enable")}
          disabled={busy}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
        >
          {t("admin.sharing.enable")}
        </button>
      )}
    </Section>
  );
}

// ── Travel plans ─────────────────────────────────────────────────────────────
const MAX_PLAN_BYTES = 10 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Read a picked .html file into a string, or return a translated error. */
async function readHtmlFile(file: File, t: (k: string) => string): Promise<string> {
  if (!/\.(html?|htm)$/i.test(file.name) && file.type !== "text/html")
    throw new Error(t("admin.plans.notHtml"));
  if (file.size > MAX_PLAN_BYTES) throw new Error(t("admin.plans.tooLarge"));
  return file.text();
}

function PlansSection({ plans, onChange }: { plans: PlanSummary[]; onChange: () => void }) {
  const t = useT();
  return (
    <Section title={t("admin.plans.title")}>
      <p className="mb-4 text-xs text-muted">{t("admin.plans.hint")}</p>
      {plans.length === 0 ? (
        <p className="text-sm text-muted">{t("admin.plans.empty")}</p>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <PlanRow key={p.slug} plan={p} onChange={onChange} />
          ))}
        </div>
      )}
      <div className="mt-4 border-t border-line pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          {t("admin.plans.createNew")}
        </p>
        <NewPlanForm onChange={onChange} />
      </div>
    </Section>
  );
}

function NewPlanForm({ onChange }: { onChange: () => void }) {
  const t = useT();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setErr(null);
    if (!file) return setErr(t("admin.plans.noFile"));
    setBusy(true);
    try {
      const html = await readHtmlFile(file, t);
      const res = await createPlan({ slug, title, html, password });
      if (!res.ok) return setErr(res.error ?? t("admin.error"));
      setSlug("");
      setTitle("");
      setPassword("");
      setFile(null);
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("admin.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${input} w-40`}
          placeholder={t("admin.plans.slugPlaceholder")}
          value={slug}
          onChange={(e) => setSlug(normalizeSlug(e.target.value))}
        />
        <input
          className={`${input} flex-1`}
          placeholder={t("admin.plans.titlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className={`${input} w-44`}
          placeholder={t("admin.plans.passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".html,.htm,text/html"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="max-w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-ink"
        />
        <button
          onClick={create}
          disabled={busy}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
        >
          {busy ? t("admin.plans.uploading") : t("admin.plans.create")}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">{t("admin.plans.passwordOptional")}</p>
      {err && <p className="mt-1 text-sm text-[var(--color-arc)]">{err}</p>}
    </div>
  );
}

function PlanRow({ plan, onChange }: { plan: PlanSummary; onChange: () => void }) {
  const t = useT();
  const [slug, setSlug] = useState(plan.slug);
  const [title, setTitle] = useState(plan.title);
  const [published, setPublished] = useState(plan.published);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  const dirty = slug !== plan.slug || title !== plan.title || published !== plan.published;

  // The absolute URL only exists in the browser; fill it in after mount so the
  // server-rendered markup stays identical.
  useEffect(() => {
    if (linkRef.current) linkRef.current.value = `${window.location.origin}/${plan.slug}`;
  }, [plan.slug]);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    setErr(null);
    setMsg(null);
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? t("admin.error"));
    setMsg(okMsg);
    onChange();
  }

  async function replaceFile(file: File | null) {
    if (!file) return;
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const html = await readHtmlFile(file, t);
      const res = await replacePlanHtml(plan.slug, html);
      if (!res.ok) return setErr(res.error ?? t("admin.error"));
      setMsg(t("admin.plans.replaced"));
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("admin.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${input} w-40`}
          value={slug}
          onChange={(e) => setSlug(normalizeSlug(e.target.value))}
        />
        <input
          className={`${input} flex-1`}
          placeholder={t("admin.plans.titlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          {t("admin.plans.published")}
        </label>
        <button
          disabled={!dirty || busy}
          onClick={() => run(() => updatePlan(plan.slug, { slug, title, published }), t("admin.saved"))}
          className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-40"
        >
          {t("common.save")}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={linkRef}
          readOnly
          defaultValue={`/${plan.slug}`}
          onFocus={(e) => e.currentTarget.select()}
          className={`${input} flex-1`}
        />
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(linkRef.current?.value ?? "");
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-lg border border-line px-3 py-2 text-sm"
        >
          {copied ? t("admin.plans.copied") : t("admin.plans.copy")}
        </button>
        <a
          href={`/${plan.slug}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-line px-3 py-2 text-sm"
        >
          {t("admin.plans.open")}
        </a>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          className={`${input} w-44`}
          placeholder={t("admin.plans.passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          disabled={busy || !password.trim()}
          onClick={() =>
            run(() => setPlanPassword(plan.slug, password), t("admin.plans.passwordSet")).then(() =>
              setPassword(""),
            )
          }
          className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-40"
        >
          {t("admin.plans.setPassword")}
        </button>
        {plan.hasPassword && (
          <button
            disabled={busy}
            onClick={() => {
              if (confirm(t("admin.plans.confirmRemovePassword")))
                run(() => setPlanPassword(plan.slug, null), t("admin.plans.passwordRemoved"));
            }}
            className="text-sm text-muted hover:text-ink disabled:opacity-50"
          >
            {t("admin.plans.removePassword")}
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-line pt-2">
        <input
          type="file"
          accept=".html,.htm,text/html"
          disabled={busy}
          onChange={(e) => {
            replaceFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
          className="max-w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-ink"
        />
        <span className="text-xs text-muted">
          {plan.hasPassword ? t("admin.plans.hasPassword") : t("admin.plans.noPassword")} ·{" "}
          {formatBytes(plan.bytes)} ·{" "}
          {t("admin.plans.updated", { date: new Date(plan.updatedAt).toLocaleDateString() })}
        </span>
        <button
          onClick={() => {
            if (confirm(t("admin.plans.confirmDelete", { title: plan.title || plan.slug }))) {
              run(() => deletePlan(plan.slug), t("admin.plans.deleted"));
            }
          }}
          className="ml-auto rounded-lg px-2 py-2 text-sm text-[var(--color-arc)] hover:underline"
        >
          {t("common.delete")}
        </button>
      </div>

      {msg && <p className="mt-1 text-sm text-muted">{msg}</p>}
      {err && <p className="mt-1 text-sm text-[var(--color-arc)]">{err}</p>}
    </div>
  );
}

function PasswordSection() {
  const t = useT();
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Section title={t("admin.password.title")}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          className={`${input} flex-1`}
          placeholder={t("admin.password.placeholder")}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <button
          onClick={async () => {
            const res = await changePassword(pw);
            setMsg(res.ok ? t("admin.password.changed") : res.error ?? t("admin.error"));
            if (res.ok) setPw("");
          }}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-surface"
        >
          {t("admin.password.change")}
        </button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
      <p className="mt-2 text-xs text-muted">{t("admin.password.hint")}</p>
    </Section>
  );
}

// ── Achievements ─────────────────────────────────────────────────────────────
function AchievementsSection({ defs, onChange }: { defs: AchievementDef[]; onChange: () => void }) {
  const t = useT();
  const empty = { id: "", icon: "🏆", title: "", description: "", metric: "trips", target: 1, sort: 999, enabled: true };
  return (
    <Section title={t("admin.achievements.title")}>
      <div className="space-y-3">
        {defs.map((d) => (
          <AchievementRow key={d.id} def={d} onChange={onChange} />
        ))}
      </div>
      <div className="mt-4 border-t border-line pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{t("admin.achievements.createNew")}</p>
        <AchievementRow def={empty} isNew onChange={onChange} />
      </div>
    </Section>
  );
}

function AchievementRow({
  def,
  isNew,
  onChange,
}: {
  def: AchievementDef & { sort?: number };
  isNew?: boolean;
  onChange: () => void;
}) {
  const t = useT();
  const [d, setD] = useState(def);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<typeof d>) => setD((x) => ({ ...x, ...patch }));

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        {isNew && (
          <input
            className={`${input} w-24`}
            placeholder="id"
            value={d.id}
            onChange={(e) => set({ id: e.target.value })}
          />
        )}
        <input className={`${input} w-12 text-center`} value={d.icon} onChange={(e) => set({ icon: e.target.value })} />
        <input
          className={`${input} flex-1`}
          placeholder={t("admin.achievements.titlePlaceholder")}
          value={d.title}
          onChange={(e) => set({ title: e.target.value })}
        />
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={d.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
          {t("admin.achievements.active")}
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          className={`${input} flex-1`}
          placeholder={t("admin.achievements.descriptionPlaceholder")}
          value={d.description}
          onChange={(e) => set({ description: e.target.value })}
        />
        <select className={input} value={d.metric} onChange={(e) => set({ metric: e.target.value })}>
          {ACHIEVEMENT_METRICS.map((m) => (
            <option key={m} value={m}>
              {t("admin.metric." + m)}
            </option>
          ))}
        </select>
        <input
          type="number"
          className={`${input} w-24`}
          placeholder={t("admin.achievements.targetPlaceholder")}
          value={d.target}
          onChange={(e) => set({ target: Number(e.target.value) })}
        />
        <button
          onClick={async () => {
            setErr(null);
            const res = await saveAchievement({
              id: d.id,
              icon: d.icon,
              title: d.title,
              description: d.description,
              metric: d.metric,
              target: d.target,
              sort: d.sort ?? 0,
              enabled: d.enabled,
            });
            if (!res.ok) return setErr(res.error ?? t("admin.error"));
            onChange();
          }}
          className="rounded-lg bg-ink px-3 py-2 text-sm font-medium text-surface"
        >
          {isNew ? t("admin.achievements.create") : t("common.save")}
        </button>
        {!isNew && (
          <button
            onClick={async () => {
              if (confirm(t("admin.achievements.confirmDelete", { title: d.title }))) {
                await deleteAchievement(d.id);
                onChange();
              }
            }}
            className="rounded-lg px-2 py-2 text-sm text-[var(--color-arc)] hover:underline"
          >
            {t("common.delete")}
          </button>
        )}
      </div>
      {err && <p className="mt-1 text-sm text-[var(--color-arc)]">{err}</p>}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}
