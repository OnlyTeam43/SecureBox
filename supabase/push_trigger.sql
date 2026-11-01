-- SecureBox push notifications. Run ONCE in the Supabase SQL editor.
-- Behaviour:
--   Discreet ON  : messages and requests send a disguised Animal Smash game notification ("🐼 Panda is missing you!").
--                  Calls send a disguised game challenge notification.
--   Discreet OFF : messages send a silent data push with no lockscreen banner.
-- The push contains NO user names, NO message text, and NO conversation IDs.

alter table public.users add column if not exists push_token text;
alter table public.users add column if not exists discreet_push boolean not null default true;

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
    '🐼 Panda is missing you! Let''s play!',
    '🐾 Your pet wants to play Brick Breaker!',
    '🎮 High score challenge waiting for you!',
    '✨ Panda has a daily reward for you!',
    '🏆 Ready to smash some bricks?'
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
        'title', 'Animal Smash 🐾',
        'body', case when kind = 'call' then '🐼 Panda challenge is starting! Tap to play!' else texts[1 + floor(random() * array_length(texts, 1))::int] end,
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
