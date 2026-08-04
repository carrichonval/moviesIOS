-- Timeline of "things that happened" to a shared movie/show — same idea as gameTracker's
-- game_events (see gameTracker's 0008_game_events.sql), but not per-user: this library is
-- shared with zero attribution (see 0001's sharing-model note), so there's no user_id here.
-- Populated by triggers so every mutation path (current and future) is captured for free.
--
-- Only two event types on purpose, matching what the Stats timeline actually needs to show:
--   - 'wishlisted': logged only on the false -> true transition. The opposite direction
--     (unwishlisting) isn't a moment worth showing on a "what did we do" timeline, and
--     skipping it means re-wishlisting later just logs a fresh event, which is exactly
--     the desired behavior — no need to track the off-state at all.
--   - 'viewed': logged on every insert into movies.viewings. The first 'viewed' event for
--     a given library_entry reads as "Vu" in the UI, every one after that as "Revu" —
--     that distinction is computed at read time from ordering, not stored here.
create type movies.event_type as enum ('wishlisted', 'viewed');

create table movies.events (
  id uuid primary key default gen_random_uuid(),
  library_entry_id uuid not null references movies.library_entries(id) on delete cascade,
  event_type movies.event_type not null,
  -- The date the event actually happened, not necessarily when the row was written —
  -- viewings can be backdated (viewed_at is a plain date, no time-of-day to preserve).
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index events_occurred_at_idx on movies.events(occurred_at desc);

alter table movies.events enable row level security;
-- No insert/update/delete policy: rows are only ever written by the security-definer
-- trigger functions below, never directly by a client.
create policy "events: read" on movies.events for select to authenticated using (true);
-- Table-level grant, not just RLS — see 0003_movies_schema_grants.sql for why this schema
-- needs it spelled out explicitly (the `alter default privileges` there already covers
-- this table too, this is just belt-and-suspenders in case migration order ever changes).
grant select on movies.events to authenticated, service_role;

create function movies.handle_library_entry_insert_wishlist()
returns trigger
language plpgsql
security definer
set search_path = movies
as $$
begin
  if new.is_wishlist then
    insert into movies.events (library_entry_id, event_type, occurred_at)
    values (new.id, 'wishlisted', now());
  end if;
  return new;
end;
$$;

create trigger on_library_entry_inserted after insert on movies.library_entries
  for each row execute function movies.handle_library_entry_insert_wishlist();

create function movies.handle_library_entry_update_wishlist()
returns trigger
language plpgsql
security definer
set search_path = movies
as $$
begin
  if new.is_wishlist and not old.is_wishlist then
    insert into movies.events (library_entry_id, event_type, occurred_at)
    values (new.id, 'wishlisted', now());
  end if;
  return new;
end;
$$;

create trigger on_library_entry_updated after update on movies.library_entries
  for each row execute function movies.handle_library_entry_update_wishlist();

-- occurred_at is now() (the real moment of the insert), not derived from viewed_at — see
-- 0005_movies_events_occurred_at_now.sql for why (viewed_at is a date-only column
-- evaluated in the DB's UTC clock, not the device's local calendar day).
create function movies.handle_viewing_insert()
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

create trigger on_viewing_inserted after insert on movies.viewings
  for each row execute function movies.handle_viewing_insert();
