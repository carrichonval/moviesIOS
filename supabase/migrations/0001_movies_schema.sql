-- Already applied directly against the shared Supabase project (run manually before this
-- repo existed) — kept here for version control / documentation, not meant to be re-run.
-- Lives in its own `movies` schema rather than `public` so it stays cleanly namespaced
-- from gameTracker's and the other personal apps' tables sharing this same project.
--
-- One manual step this file can't do: expose schema `movies` in the Supabase dashboard
-- under Project Settings > Data API > Exposed schemas. Without that, PostgREST won't
-- serve it and the client's `supabase.schema('movies').from(...)` calls will 404.
--
-- Sharing model (important, do not "fix" by adding user_id to titles/library_entries/
-- viewings): this app is for two people (a couple). Wishlist status, watched status, and
-- the viewing log are fully shared with zero attribution — either person's action
-- changes it for both, there's no "who did it". The ONLY per-person thing in the whole
-- schema is `ratings`: each person rates independently, both ratings are visible to
-- both, but you can only write/edit your own.

create schema if not exists movies;
create type movies.media_type as enum ('movie', 'tv');

-- TMDB cache, mirrors gameTracker's public.games: minimal fields for list/grid UI,
-- richer fields (cast, similar titles, etc.) fetched live and optionally cached later
-- via the same `details_cached_at` pattern. Deliberately does NOT store the full raw
-- TMDB API response (the old web app did — wasteful, and it just goes stale).
create table movies.titles (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer not null,
  media_type movies.media_type not null,
  name text not null,
  poster_url text,
  release_date date,
  overview text,
  genres text[],
  created_at timestamptz not null default now(),
  details_cached_at timestamptz,
  unique (tmdb_id, media_type)
);
alter table movies.titles enable row level security;
create policy "titles: read" on movies.titles for select to authenticated using (true);
create policy "titles: insert" on movies.titles for insert to authenticated with check (true);
create policy "titles: update" on movies.titles for update to authenticated using (true) with check (true);

-- The shared "our list" — NOT per-user, both people see/edit the same rows.
create table movies.library_entries (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references movies.titles(id) on delete cascade,
  is_wishlist boolean not null default false,
  added_at timestamptz not null default now(),
  unique (title_id)
);
alter table movies.library_entries enable row level security;
create policy "library_entries: shared full access" on movies.library_entries
  for all to authenticated using (true) with check (true);

-- One row per viewing event — view count = count(*), last viewed = max(viewed_at).
-- Also doubles as a natural "activity history" for movies, same idea as gameTracker's
-- game_events timeline.
create table movies.viewings (
  id uuid primary key default gen_random_uuid(),
  library_entry_id uuid not null references movies.library_entries(id) on delete cascade,
  viewed_at date not null default current_date,
  created_at timestamptz not null default now()
);
alter table movies.viewings enable row level security;
create policy "viewings: shared full access" on movies.viewings
  for all to authenticated using (true) with check (true);

-- Personal rating per title — both people can see either rating, but each can only
-- write/edit their own. References the shared public.users table (same one
-- gameTracker/templateIOS use) — no new users table.
create table movies.ratings (
  id uuid primary key default gen_random_uuid(),
  library_entry_id uuid not null references movies.library_entries(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (library_entry_id, user_id)
);
alter table movies.ratings enable row level security;
create policy "ratings: read" on movies.ratings for select to authenticated using (true);
create policy "ratings: insert own" on movies.ratings for insert to authenticated with check (user_id = auth.uid());
create policy "ratings: update own" on movies.ratings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ratings: delete own" on movies.ratings for delete to authenticated using (user_id = auth.uid());
