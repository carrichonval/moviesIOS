-- Real per-device badge accumulation, replacing the fixed badge=1 from 0011. Badge counts
-- are inherently per app-install (that's how iOS tracks them), not per-person, hence a
-- counter column on push_tokens (one row per device) rather than on public.users.
alter table movies.push_tokens add column badge_count integer not null default 0;

-- Atomically increments and reads back in the same statement (UPDATE ... RETURNING inside
-- a FOR loop is valid PL/pgSQL, not just for SELECT) — if a person has two devices
-- registered, each row/device gets its own +1 and its own count, which is correct: two
-- installs can have different "caught up" states.
create or replace function movies.notify_push(target_user_id uuid, notif_title text, notif_body text, notif_data jsonb)
returns void
language plpgsql
security definer
set search_path = movies
as $$
declare
  rec record;
begin
  for rec in
    update movies.push_tokens
    set badge_count = badge_count + 1, updated_at = now()
    where user_id = target_user_id
    returning expo_push_token, badge_count
  loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      body := jsonb_build_object(
        'to', rec.expo_push_token, 'title', notif_title, 'body', notif_body,
        'data', notif_data, 'badge', rec.badge_count
      )
    );
  end loop;
end;
$$;
