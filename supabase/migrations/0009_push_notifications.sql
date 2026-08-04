-- Push notifications between the two people sharing this library: wishlist adds, a title
-- being watched for the first time, and rating invitations. library_entries/viewings/
-- episode_watches are deliberately unattributed (see 0001's sharing-model note) — the
-- *actor* for a notification is read from auth.uid() at trigger time instead of a stored
-- column, and "the other person" is resolved via movies.other_user_id() below rather than
-- a generic "any other row in public.users" query: that table is shared across several
-- personal apps on this same Supabase project, so picking "not me" there could return a
-- completely unrelated account. Hardcoding the two known people mirrors what the client
-- already does in src/constants/people.ts.
create extension if not exists pg_net;

create table movies.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- Unique on its own, not per-user: a push token identifies one app install on one
  -- device, not a person — if the same device is ever re-registered under the other
  -- account, the upsert below should reassign the row rather than create a duplicate.
  expo_push_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table movies.push_tokens enable row level security;
create policy "push_tokens: select own" on movies.push_tokens for select to authenticated using (user_id = auth.uid());
create policy "push_tokens: insert own" on movies.push_tokens for insert to authenticated with check (user_id = auth.uid());
-- `using (true)` (not `user_id = auth.uid()`) so a token can be reassigned to whoever is
-- currently registering it, not just updated by its current owner — see the uniqueness
-- comment above.
create policy "push_tokens: update own" on movies.push_tokens for update to authenticated using (true) with check (user_id = auth.uid());
create policy "push_tokens: delete own" on movies.push_tokens for delete to authenticated using (user_id = auth.uid());
-- Table grants are handled automatically by 0003's `alter default privileges`.

create function movies.other_user_id(acting_user_id uuid)
returns uuid
language sql
immutable
as $$
  select case
    when acting_user_id is null then null
    when acting_user_id = 'b2a5b7f1-64f4-405d-9c83-41dae3150838'::uuid
      then '75fe8048-4742-4ca8-a589-2b85d361468e'::uuid
    else 'b2a5b7f1-64f4-405d-9c83-41dae3150838'::uuid
  end
$$;

-- Fire-and-forget: sends to every token registered for target_user_id via Expo's push
-- API (https://exp.host/--/api/v2/push/send — public, no key needed for a basic send).
-- security definer because the caller (the *other* person's own action, e.g. adding to
-- the wishlist) is never the target, so "select own token" RLS would otherwise block it
-- from reading who to notify.
create function movies.notify_push(target_user_id uuid, notif_title text, notif_body text, notif_data jsonb)
returns void
language plpgsql
security definer
set search_path = movies
as $$
declare
  token text;
begin
  for token in select expo_push_token from movies.push_tokens where user_id = target_user_id
  loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      body := jsonb_build_object('to', token, 'title', notif_title, 'body', notif_body, 'data', notif_data)
    );
  end loop;
end;
$$;

-- Extends 0004's wishlist triggers with a push to the other person. Re-wishlisting later
-- (after unwishlisting) still only fires on the false->true transition, same as the
-- existing 'wishlisted' event this piggybacks on.
create or replace function movies.handle_library_entry_insert_wishlist()
returns trigger
language plpgsql
security definer
set search_path = movies
as $$
declare
  title_name text;
  title_tmdb_id integer;
  title_media_type movies.media_type;
begin
  if new.is_wishlist then
    insert into movies.events (library_entry_id, event_type, occurred_at)
    values (new.id, 'wishlisted', now());

    select t.name, t.tmdb_id, t.media_type into title_name, title_tmdb_id, title_media_type
    from movies.titles t where t.id = new.title_id;

    perform movies.notify_push(
      movies.other_user_id(auth.uid()),
      'Nouvelle envie 🍿',
      title_name || ' a été ajouté à la liste de souhait',
      jsonb_build_object('type', 'movie', 'tmdbId', title_tmdb_id, 'mediaType', title_media_type)
    );
  end if;
  return new;
end;
$$;

create or replace function movies.handle_library_entry_update_wishlist()
returns trigger
language plpgsql
security definer
set search_path = movies
as $$
declare
  title_name text;
  title_tmdb_id integer;
  title_media_type movies.media_type;
begin
  if new.is_wishlist and not old.is_wishlist then
    insert into movies.events (library_entry_id, event_type, occurred_at)
    values (new.id, 'wishlisted', now());

    select t.name, t.tmdb_id, t.media_type into title_name, title_tmdb_id, title_media_type
    from movies.titles t where t.id = new.title_id;

    perform movies.notify_push(
      movies.other_user_id(auth.uid()),
      'Nouvelle envie 🍿',
      title_name || ' a été ajouté à la liste de souhait',
      jsonb_build_object('type', 'movie', 'tmdbId', title_tmdb_id, 'mediaType', title_media_type)
    );
  end if;
  return new;
end;
$$;

-- Extends 0004's viewing trigger — only notifies on the first viewing for a given
-- library_entry (viewing_count = 1 right after this insert), never on a later "Revu".
create or replace function movies.handle_viewing_insert()
returns trigger
language plpgsql
security definer
set search_path = movies
as $$
declare
  viewing_count integer;
  title_name text;
  title_tmdb_id integer;
  title_media_type movies.media_type;
begin
  insert into movies.events (library_entry_id, event_type, occurred_at)
  values (new.library_entry_id, 'viewed', now());

  select count(*) into viewing_count from movies.viewings where library_entry_id = new.library_entry_id;

  if viewing_count = 1 then
    select t.name, t.tmdb_id, t.media_type into title_name, title_tmdb_id, title_media_type
    from movies.titles t
    join movies.library_entries le on le.title_id = t.id
    where le.id = new.library_entry_id;

    perform movies.notify_push(
      movies.other_user_id(auth.uid()),
      'Vu ! 👀',
      title_name || ' vient d''être marqué comme vu',
      jsonb_build_object('type', 'movie', 'tmdbId', title_tmdb_id, 'mediaType', title_media_type)
    );
  end if;

  return new;
end;
$$;

-- New: invites the other person to rate too, unless they already have. Scoped to INSERT
-- only (not UPDATE) on purpose — useRateTitle() upserts on (library_entry_id, user_id), so
-- a first-ever rating from someone is always an INSERT and a later change to their own
-- score is always an UPDATE; restricting to AFTER INSERT means re-rating never re-notifies.
create function movies.handle_rating_insert()
returns trigger
language plpgsql
security definer
set search_path = movies
as $$
declare
  target_user uuid;
  title_name text;
  title_tmdb_id integer;
  title_media_type movies.media_type;
begin
  target_user := movies.other_user_id(new.user_id);

  if not exists (
    select 1 from movies.ratings where library_entry_id = new.library_entry_id and user_id = target_user
  ) then
    select t.name, t.tmdb_id, t.media_type into title_name, title_tmdb_id, title_media_type
    from movies.titles t
    join movies.library_entries le on le.title_id = t.id
    where le.id = new.library_entry_id;

    perform movies.notify_push(
      target_user,
      'À toi de noter ⭐',
      title_name || ' a été noté, viens donner ton avis',
      jsonb_build_object('type', 'movie', 'tmdbId', title_tmdb_id, 'mediaType', title_media_type)
    );
  end if;

  return new;
end;
$$;

create trigger on_rating_inserted after insert on movies.ratings
  for each row execute function movies.handle_rating_insert();
