-- 0001 assumed a 1-10 rating scale. Checking the legacy data (public.movies.note_maeva /
-- note_valentin) showed the real scale is 0-5 with no decimals, and 0 is used as a
-- "not rated yet" sentinel rather than a genuine score of 0 — the import script treats
-- 0 as "no rating", so the real range actually stored is 1-5.
alter table movies.ratings drop constraint if exists ratings_rating_check;
alter table movies.ratings add constraint ratings_rating_check check (rating between 1 and 5);
