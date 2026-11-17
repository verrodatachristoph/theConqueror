-- ============================================================================
-- Standalone travel-plan pages.
-- A self-contained HTML document served at /<slug>, behind its own password —
-- independent of the family gate, and showing nothing else of the app.
-- ============================================================================
create table if not exists public.travel_plans (
  slug          text primary key,
  title         text not null default '',
  html          text not null default '',
  bytes         integer not null default 0,   -- size of html, for the admin list
  password_hash text,                          -- null => reachable by secret slug alone
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint travel_plans_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$')
);

alter table public.travel_plans enable row level security;
-- No policies: only the service/secret key (server-side) reads/writes.
