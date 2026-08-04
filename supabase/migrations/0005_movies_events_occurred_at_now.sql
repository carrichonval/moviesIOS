-- occurred_at for 'viewed' events was derived from viewed_at (a date-only column, always
-- midnight) evaluated against the DB server's UTC clock, not the device's local calendar
-- day — around local midnight this could show "Hier" for something just done "aujourd'hui".
-- Switch to now() (the actual moment the row was inserted), matching how gameTracker's
-- game_events timeline works: it logs when the action happened, not a business date.
create or replace function movies.handle_viewing_insert()
returns trigger
language plpgsql
security definer
set search_path = movies
as $$
begin
  insert into movies.events (library_entry_id, event_type, occurred_at)
  values (new.library_entry_id, 'viewed', now());
  return new;
end;
$$;
