-- Per-episode "watched" checkbox for TV shows — shared, same sharing model as
-- library_entries/viewings (see 0001's note): no user_id, either person checking an
-- episode marks it for both. Presence of a row means that episode has been watched;
-- unchecking deletes the row rather than storing a boolean, so "watched" and "never
-- watched" aren't distinguishable from "watched then unmarked", matching how the rest of
-- this schema avoids storing negative/absent state.
--
-- Movies don't use this table at all — the existing movies.viewings/"Revu" flow is
-- untouched for them, this only replaces that flow for media_type = 'tv'.
create table movies.episode_watches (
  id uuid primary key default gen_random_uuid(),
  library_entry_id uuid not null references movies.library_entries(id) on delete cascade,
  season_number integer not null,
  episode_number integer not null,
  watched_at timestamptz not null default now(),
  unique (library_entry_id, season_number, episode_number)
);
alter table movies.episode_watches enable row level security;
create policy "episode_watches: shared full access" on movies.episode_watches
  for all to authenticated using (true) with check (true);
-- Table grants are handled automatically by 0003's `alter default privileges`.

-- Cached total episode count (TV only, null for movies) — lets the library screen compute
-- "every episode watched" for a show from a plain count() against episode_watches,
-- without re-fetching TMDB's season/episode lists for every title just to know when
-- it's complete. Populated from TMDB's numberOfEpisodes whenever a show's details are
-- fetched (movie/[id].tsx, season screen), same on-demand caching as the other detail
-- fields already on this table.
alter table movies.titles add column total_episodes integer;
