-- Shared favorite streaming platforms (subscription/"flatrate" only, decided with the
-- user — rent/buy don't map onto "favorite" the same way) — same sharing model as
-- library_entries/viewings (0001's note): either person toggling a platform changes it
-- for both, no user_id.
create table movies.favorite_watch_providers (
  id uuid primary key default gen_random_uuid(),
  provider_id integer not null unique,
  provider_name text not null,
  logo_path text,
  created_at timestamptz not null default now()
);
alter table movies.favorite_watch_providers enable row level security;
create policy "favorite_watch_providers: shared full access" on movies.favorite_watch_providers
  for all to authenticated using (true) with check (true);
-- Table grants are handled automatically by 0003's `alter default privileges`.
