-- Read-only checks, run in Supabase Studio's SQL editor before writing the real
-- import script. Nothing here writes anything — safe to run anytime.

-- 1. What does the rating scale actually look like? (need this to size the
--    `movies.ratings.rating` check constraint correctly before importing)
select
  min(note_maeva) as min_maeva, max(note_maeva) as max_maeva,
  min(note_valentin) as min_valentin, max(note_valentin) as max_valentin,
  count(*) filter (where note_maeva <> round(note_maeva)) as maeva_has_decimals,
  count(*) filter (where note_valentin <> round(note_valentin)) as valentin_has_decimals,
  count(*) filter (where note_maeva = 0) as maeva_zero_count,
  count(*) filter (where note_valentin = 0) as valentin_zero_count
from public.movies;

-- 2. Is `wishlist` genuinely binary in practice?
select distinct wishlist, count(*) from public.movies group by wishlist;

-- 3. Any `historique` rows whose movie_id has no matching row in `movies`?
--    (these would need a fresh TMDB fetch during import instead of reusing `movies`)
select h.movie_id, count(*) as viewing_rows
from public.historique h
left join public.movies m on m.movie_id = h.movie_id
where m.movie_id is null
group by h.movie_id;

-- 4. Sanity check: does view_counter/last_view actually match what historique says?
--    (large mismatches would suggest the counter drifted from the real log at some point)
select
  m.movie_id,
  m.view_counter as stored_counter,
  m.last_view as stored_last_view,
  count(h.id) as actual_viewing_count,
  max(h.date) as actual_last_view
from public.movies m
left join public.historique h on h.movie_id = m.movie_id
group by m.movie_id, m.view_counter, m.last_view
having count(h.id) <> m.view_counter or max(h.date) is distinct from m.last_view;

-- 5. media_type values actually in use (must match the new `movies.media_type` enum:
--    'movie' | 'tv' — anything else needs a mapping decision).
select distinct media_type, count(*) from public.movies group by media_type;
