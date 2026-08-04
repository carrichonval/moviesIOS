-- Logs a timeline event for every episode checked — no un-check/"unwatched" event, same
-- philosophy as 'wishlisted' only logging the false->true transition (0004_movies_events.sql).
create function movies.handle_episode_watch_insert()
returns trigger
language plpgsql
security definer
set search_path = movies
as $$
begin
  insert into movies.events (library_entry_id, event_type, occurred_at, season_number, episode_number)
  values (new.library_entry_id, 'episode_watched', new.watched_at, new.season_number, new.episode_number);
  return new;
end;
$$;

create trigger on_episode_watch_inserted after insert on movies.episode_watches
  for each row execute function movies.handle_episode_watch_insert();
