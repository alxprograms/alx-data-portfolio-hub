-- Credentials are accessible only through the server's secret Supabase client.
create table public.gmail_sender_connection (
  id boolean primary key default true check (id),
  version uuid not null default gen_random_uuid(),
  sender_email text,
  encrypted_refresh_token text,
  status text not null default 'disconnected' check (status in ('connected', 'needs_reconnection', 'disconnected')),
  connected_by uuid references auth.users(id) on delete set null,
  connected_by_email text,
  connected_at timestamptz,
  last_successful_send_at timestamptz,
  last_test_at timestamptz,
  last_test_recipient text,
  last_test_status text check (last_test_status in ('pending', 'sent', 'failed', 'unknown')),
  last_test_message_id text,
  last_safe_error text,
  updated_at timestamptz not null default now(),
  check ((status = 'disconnected' and encrypted_refresh_token is null) or
         (status <> 'disconnected' and encrypted_refresh_token is not null and sender_email is not null))
);

create table public.gmail_sender_events (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('connected', 'replaced', 'disconnected', 'test')),
  previous_sender_email text,
  sender_email text,
  performed_by uuid references auth.users(id) on delete set null,
  performed_by_email text not null,
  recipient_email text,
  result text check (result in ('pending', 'sent', 'failed', 'unknown')),
  message_id text,
  safe_error text,
  created_at timestamptz not null default now()
);

alter table public.gmail_sender_connection enable row level security;
alter table public.gmail_sender_events enable row level security;
revoke all on public.gmail_sender_connection, public.gmail_sender_events from public, anon, authenticated;
grant all on public.gmail_sender_connection, public.gmail_sender_events to service_role;
insert into public.gmail_sender_connection (id) values (true);

-- Changing the connection and writing its history must happen together.
-- Version matching also prevents an old OAuth callback replacing a newer sender.
create function public.gmail_change_sender(
  p_version uuid, p_email text, p_token text, p_actor uuid, p_actor_email text
) returns void language plpgsql set search_path = '' as $$
declare previous_email text;
begin
  select sender_email into previous_email from public.gmail_sender_connection
    where id = true and version = p_version for update;
  if not found then raise exception 'GMAIL_CONNECTION_CHANGED'; end if;
  if (p_email is null) <> (p_token is null) then raise exception 'Invalid connection'; end if;
  update public.gmail_sender_connection set
    version = gen_random_uuid(), sender_email = p_email, encrypted_refresh_token = p_token,
    status = case when p_email is null then 'disconnected' else 'connected' end,
    connected_by = case when p_email is null then null else p_actor end,
    connected_by_email = case when p_email is null then null else p_actor_email end,
    connected_at = case when p_email is null then null else now() end,
    last_successful_send_at = null, last_test_at = null, last_test_recipient = null,
    last_test_status = null, last_test_message_id = null, last_safe_error = null, updated_at = now()
    where id = true;
  insert into public.gmail_sender_events (action, previous_sender_email, sender_email, performed_by, performed_by_email)
    values (case when p_email is null then 'disconnected' when previous_email is null then 'connected' else 'replaced' end,
      previous_email, p_email, p_actor, p_actor_email);
end;
$$;

-- One test per 30 seconds for the shared mailbox; reserve before calling Gmail.
create function public.gmail_begin_test(p_version uuid, p_recipient text, p_actor uuid, p_actor_email text)
returns uuid language plpgsql set search_path = '' as $$
declare connection public.gmail_sender_connection; event_id uuid;
begin
  select * into connection from public.gmail_sender_connection where id = true for update;
  if not found then raise exception 'GMAIL_CONNECTION_CHANGED'; end if;
  if connection.version <> p_version or connection.status <> 'connected' then
    raise exception 'GMAIL_CONNECTION_CHANGED';
  end if;
  if connection.last_test_at > now() - interval '30 seconds' then raise exception 'GMAIL_TEST_COOLDOWN'; end if;
  insert into public.gmail_sender_events (action, sender_email, performed_by, performed_by_email, recipient_email, result)
    values ('test', connection.sender_email, p_actor, p_actor_email, p_recipient, 'pending') returning id into event_id;
  update public.gmail_sender_connection set last_test_at = now(), last_test_recipient = p_recipient,
    last_test_status = 'pending', last_test_message_id = null, last_safe_error = null, updated_at = now() where id = true;
  return event_id;
end;
$$;

create function public.gmail_finish_test(
  p_version uuid, p_event uuid, p_result text, p_message_id text, p_error text, p_reconnect boolean
) returns void language plpgsql set search_path = '' as $$
begin
  if p_result not in ('sent', 'failed', 'unknown') then raise exception 'Invalid test result'; end if;
  update public.gmail_sender_events set result = p_result, message_id = p_message_id, safe_error = p_error
    where id = p_event and action = 'test' and result = 'pending';
  update public.gmail_sender_connection set last_test_status = p_result, last_test_message_id = p_message_id,
    last_safe_error = p_error, updated_at = now(),
    last_successful_send_at = case when p_result = 'sent' then now() else last_successful_send_at end,
    status = case when p_reconnect then 'needs_reconnection' else status end
    where id = true and version = p_version;
end;
$$;

revoke all on function public.gmail_change_sender(uuid,text,text,uuid,text) from public, anon, authenticated;
revoke all on function public.gmail_begin_test(uuid,text,uuid,text) from public, anon, authenticated;
revoke all on function public.gmail_finish_test(uuid,uuid,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.gmail_change_sender(uuid,text,text,uuid,text) to service_role;
grant execute on function public.gmail_begin_test(uuid,text,uuid,text) to service_role;
grant execute on function public.gmail_finish_test(uuid,uuid,text,text,text,boolean) to service_role;
