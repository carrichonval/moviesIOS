-- 0009 notified only "the other person" for every event. Corrected per the user: wishlist
-- adds and first viewings should always push to BOTH people (including the device that
-- just performed the action) — only the rating invitation stays targeted at the other
-- person specifically, since its whole point is "you haven't rated this yet".
create function movies.notify_push_both(notif_title text, notif_body text, notif_data jsonb)
returns void
language plpgsql
security definer
set search_path = movies
as $$
begin
  perform movies.notify_push('b2a5b7f1-64f4-405d-9c83-41dae3150838'::uuid, notif_title, notif_body, notif_data);
  perform movies.notify_push('75fe8048-4742-4ca8-a589-2b85d361468e'::uuid, notif_title, notif_body, notif_data);
end;
$$;

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

    perform movies.notify_push_both(
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

    perform movies.notify_push_both(
      'Nouvelle envie 🍿',
      title_name || ' a été ajouté à la liste de souhait',
      jsonb_build_object('type', 'movie', 'tmdbId', title_tmdb_id, 'mediaType', title_media_type)
    );
  end if;
  return new;
end;
$$;

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

    perform movies.notify_push_both(
      'Vu ! 👀',
      title_name || ' vient d''être marqué comme vu',
      jsonb_build_object('type', 'movie', 'tmdbId', title_tmdb_id, 'mediaType', title_media_type)
    );
  end if;

  return new;
end;
$$;
