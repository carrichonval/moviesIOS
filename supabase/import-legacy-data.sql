-- One-time import from the old public.movies / public.historique into the new movies.*
-- schema. Run AFTER 0002_fix_ratings_scale.sql, and after replacing the two placeholder
-- UUIDs below with real ones (this is plain SQL meant for Supabase Studio's SQL editor —
-- no psql variables, just find-and-replace the two placeholder strings).
--
-- Findings this script relies on (see supabase/legacy-data-check.sql for how these were
-- verified):
--   - Ratings are 0-5, no decimals. 0 is a "not rated yet" sentinel, not a real score —
--     rows with note_maeva/note_valentin = 0 are skipped, not imported as a rating of 0.
--   - Every historique.movie_id has a matching public.movies row (no orphans) — no need
--     to hit TMDB during import.
--   - historique is the reliable source for viewings; public.movies.view_counter/
--     last_view were just a derived cache (off by ~1s from historique — a write-order
--     artifact, not a real discrepancy) and are intentionally NOT imported directly —
--     view count / last viewed are computed from movies.viewings going forward.
--   - media_type is clean ('movie' | 'tv' only).
--   - genres: the old `infos` JSON stores TMDB genre_ids (ints), not names, and there's
--     no local id→name table here — left null on import, refreshed live by the app
--     later (same "cache what's needed now, fetch the rest live" approach as the rest
--     of this schema).
--
-- TODO before running: find-and-replace both placeholders below with real UUIDs from
-- `select id, username, email from public.users;` — Valentin already has an account
-- (same shared auth as gameTracker), no signup needed for him. Maeva needs to sign up
-- in the app first so her row exists.
--   00000000-0000-0000-0000-000000000001  →  Valentin's real user id
--   00000000-0000-0000-0000-000000000002  →  Maeva's real user id

-- 1. Titles — backfilled from the old `infos` JSON blob instead of re-querying TMDB for
--    every historical title. `genres` intentionally left null (see note above).
insert into movies.titles (tmdb_id, media_type, name, poster_url, release_date, overview, created_at)
select
  m.movie_id,
  m.media_type::movies.media_type,
  coalesce(m.infos::jsonb ->> 'title', m.infos::jsonb ->> 'name') as name,
  case when (m.infos::jsonb ->> 'poster_path') is not null
    then 'https://image.tmdb.org/t/p/w500' || (m.infos::jsonb ->> 'poster_path')
    else null
  end as poster_url,
  nullif(coalesce(m.infos::jsonb ->> 'release_date', m.infos::jsonb ->> 'first_air_date'), '')::date as release_date,
  m.infos::jsonb ->> 'overview' as overview,
  coalesce(m.date, now())
from public.movies m
on conflict (tmdb_id, media_type) do nothing;

-- 2. Library entries — every old `movies` row was deliberately added at some point,
--    regardless of its current wishlist/watched flags, so all of them get one.
insert into movies.library_entries (title_id, is_wishlist, added_at)
select t.id, (m.wishlist <> 0), coalesce(m.date, now())
from public.movies m
join movies.titles t on t.tmdb_id = m.movie_id and t.media_type = m.media_type::movies.media_type
on conflict (title_id) do nothing;

-- 3. Viewings — from historique, joined through public.movies to resolve media_type
--    (historique.movie_id alone is ambiguous: a movie and a TV show can share the same
--    TMDB id since TMDB ids are only unique within a media type).
insert into movies.viewings (library_entry_id, viewed_at, created_at)
select le.id, h.date::date, h.date
from public.historique h
join public.movies m on m.movie_id = h.movie_id
join movies.titles t on t.tmdb_id = m.movie_id and t.media_type = m.media_type::movies.media_type
join movies.library_entries le on le.title_id = t.id;

-- 4. Ratings — skips 0 (not a real rating, see note above).
--    Replace the placeholder UUIDs below before running.
insert into movies.ratings (library_entry_id, user_id, rating)
select le.id, '00000000-0000-0000-0000-000000000001'::uuid, m.note_valentin
from public.movies m
join movies.titles t on t.tmdb_id = m.movie_id and t.media_type = m.media_type::movies.media_type
join movies.library_entries le on le.title_id = t.id
where m.note_valentin > 0
on conflict (library_entry_id, user_id) do nothing;

insert into movies.ratings (library_entry_id, user_id, rating)
select le.id, '00000000-0000-0000-0000-000000000002'::uuid, m.note_maeva
from public.movies m
join movies.titles t on t.tmdb_id = m.movie_id and t.media_type = m.media_type::movies.media_type
join movies.library_entries le on le.title_id = t.id
where m.note_maeva > 0
on conflict (library_entry_id, user_id) do nothing;

-- Sanity check after running: row counts should roughly match the legacy data
-- (189 movies + 24 tv = 213 titles/library_entries expected).
select
  (select count(*) from movies.titles) as titles_count,
  (select count(*) from movies.library_entries) as library_entries_count,
  (select count(*) from movies.viewings) as viewings_count,
  (select count(*) from movies.ratings) as ratings_count;
