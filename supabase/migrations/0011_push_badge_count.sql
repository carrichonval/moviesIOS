-- iOS never shows an app-icon badge unless the push payload explicitly declares one —
-- notify_push wasn't sending one. No per-device unread count is tracked server-side, so
-- every push just declares badge = 1; the client clears it back to 0 on launch and on
-- tapping a notification (see setup.ts / useNotificationResponseHandler.ts).
create or replace function movies.notify_push(target_user_id uuid, notif_title text, notif_body text, notif_data jsonb)
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
      body := jsonb_build_object('to', token, 'title', notif_title, 'body', notif_body, 'data', notif_data, 'badge', 1)
    );
  end loop;
end;
$$;
