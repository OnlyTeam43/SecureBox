-- SecureBox push notifications. Run ONCE in the Supabase SQL editor.
-- Behaviour:
--   Discreet ON  : messages and requests send a disguised notification with sound.
--                  Calls send a disguised high-priority call notification.
--   Discreet OFF : messages and requests send a silent data push. The phone plays a
--                  quick sound with no popup. Calls send nothing (silent).
-- The push contains NO names, NO message text and NO conversation ids.

alter table public.users add column if not exists push_token text;
alter table public.users add column if not exists discreet_push boolean not null default false;

create extension if not exists pg_net with schema extensions;

create or replace function public.send_push_on_message()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u record;
  kind text;
  texts text[] := array[
    'Storage optimization completed',
    'Battery check finished',
    'System update checked',
    'Cache cleaned',
    'Security scan complete'
  ];
  payload jsonb;
begin
  -- Never let a push problem block a message from being saved.
  begin
    if new.type not in ('text', 'image', 'call_req', 'contact_req', 'contact_accepted') then
      return new;
    end if;

    select push_token, discreet_push into u
    from public.users
    where handle = new.receiver
    limit 1;

    if u.push_token is null or u.push_token not like 'ExponentPushToken[%' then
      return new;
    end if;

    kind := case new.type
      when 'call_req' then 'call'
      when 'text' then 'msg'
      when 'image' then 'msg'
      else 'req'
    end;

    if u.discreet_push then
      payload := jsonb_build_object(
        'to', u.push_token,
        'title', 'System',
        'body', texts[1 + floor(random() * array_length(texts, 1))::int],
        'sound', 'default',
        'priority', 'high',
        'channelId', case when kind = 'call' then 'calls_incoming_v2' else 'discreet_alert_v1' end,
        'ttl', case when kind = 'call' then 30 else 86400 end,
        'data', jsonb_build_object('k', kind)
      );
    elsif kind <> 'call' then
      payload := jsonb_build_object(
        'to', u.push_token,
        'priority', 'high',
        '_contentAvailable', true,
        'ttl', 3600,
        'data', jsonb_build_object('k', kind)
      );
    else
      return new; -- calls are silent when Discreet is OFF
    end if;

    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      body := payload
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists push_on_message on public.messages;
create trigger push_on_message
after insert on public.messages
for each row execute function public.send_push_on_message();

-- To see whether Expo accepted the pushes (look for "status":"error" and the reason):
--   select created, status_code, content from net._http_response order by created desc limit 20;
