alter table public.peer_messages
  alter column application_id drop not null;

grant select, insert, update on public.peer_messages to authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "Users can read leaderboard profiles" on public.profiles;
create policy "Users can read leaderboard profiles"
on public.profiles for select
to authenticated
using (true);

create or replace function public.profile_exists_for_message(profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = profile_id
  );
$$;

grant execute on function public.profile_exists_for_message(uuid) to authenticated;

create or replace function public.send_direct_profile_message(
  target_recipient_id uuid,
  message_subject text,
  message_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_message_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Log in before sending messages.';
  end if;

  if target_recipient_id is null or message_subject is null or message_body is null then
    raise exception 'Add a subject and message before sending.';
  end if;

  if btrim(message_subject) = '' or btrim(message_body) = '' then
    raise exception 'Add a subject and message before sending.';
  end if;

  if target_recipient_id = auth.uid() then
    raise exception 'You cannot message yourself.';
  end if;

  if not public.profile_exists_for_message(target_recipient_id) then
    raise exception 'Profile not found.';
  end if;

  insert into public.peer_messages (
    sender_id,
    recipient_id,
    application_id,
    role_key,
    subject,
    body
  )
  values (
    auth.uid(),
    target_recipient_id,
    null,
    concat('profile::', target_recipient_id::text),
    btrim(message_subject),
    btrim(message_body)
  )
  returning id into inserted_message_id;

  return inserted_message_id;
end;
$$;

grant execute on function public.send_direct_profile_message(uuid, text, text) to authenticated;

drop policy if exists "Users can send peer messages" on public.peer_messages;

create policy "Users can send peer messages"
on public.peer_messages for insert
to authenticated
with check (
  auth.uid() = sender_id
  and recipient_id <> sender_id
  and (
    (
      application_id is not null
      and exists (
        select 1
        from public.applications
        where applications.id = peer_messages.application_id
          and applications.role_key = peer_messages.role_key
          and applications.user_id in (peer_messages.sender_id, peer_messages.recipient_id)
      )
    )
    or (
      application_id is null
      and role_key = concat('profile::', recipient_id::text)
      and public.profile_exists_for_message(recipient_id)
    )
  )
);

notify pgrst, 'reload schema';

select
  'direct profile messages ready' as check_name,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'peer_messages'
      and policyname = 'Users can send peer messages'
  ) as has_send_policy,
  exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname = 'profile_exists_for_message'
  ) as has_profile_helper,
  exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname = 'send_direct_profile_message'
  ) as has_direct_message_rpc,
  (
    select is_nullable = 'YES'
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'peer_messages'
      and column_name = 'application_id'
  ) as application_id_allows_profile_messages;
