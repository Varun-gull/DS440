-- Role peer insights, application years, and peer messaging.
-- Run this in Supabase SQL Editor after the base schema is installed.

create or replace function public.normalize_role_key_part(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(trim(regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', ' ', 'g')), '\s+', ' ', 'g');
$$;

create or replace function public.build_role_key(company text, role text)
returns text
language sql
immutable
as $$
  select concat_ws('::', nullif(public.normalize_role_key_part(company), ''), nullif(public.normalize_role_key_part(role), ''));
$$;

alter table public.profiles
  add column if not exists school_logo_url text,
  add column if not exists share_application_board boolean not null default false,
  add column if not exists privacy_prompt_answered boolean not null default false;

alter table public.applications
  add column if not exists role_key text;

alter table public.applications
  add column if not exists application_year integer not null default extract(year from now())::integer;

update public.applications
set role_key = public.build_role_key(company, role)
where role_key is null or role_key = '';

create index if not exists applications_role_key_idx on public.applications(role_key);
create index if not exists applications_application_year_idx on public.applications(user_id, application_year);

create or replace function public.set_application_search_fields()
returns trigger
language plpgsql
as $$
begin
  new.role_key := public.build_role_key(new.company, new.role);
  if new.application_year is null then
    new.application_year := extract(year from coalesce(new.created_at, now()))::integer;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_set_search_fields on public.applications;
create trigger applications_set_search_fields
  before insert or update of company, role, created_at, application_year on public.applications
  for each row execute procedure public.set_application_search_fields();

create table if not exists public.peer_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  role_key text not null,
  subject text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists peer_messages_sender_idx on public.peer_messages(sender_id, created_at desc);
create index if not exists peer_messages_recipient_idx on public.peer_messages(recipient_id, created_at desc);
create index if not exists peer_messages_role_key_idx on public.peer_messages(role_key);

alter table public.peer_messages enable row level security;

grant select, insert, update on public.peer_messages to authenticated;

drop policy if exists "Users can read own peer messages" on public.peer_messages;
create policy "Users can read own peer messages"
on public.peer_messages for select
to authenticated
using (auth.uid() = sender_id or auth.uid() = recipient_id);

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

drop policy if exists "Recipients can mark peer messages read" on public.peer_messages;
create policy "Recipients can mark peer messages read"
on public.peer_messages for update
to authenticated
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);

create or replace function public.get_role_peer_summaries(role_keys text[])
returns table (
  role_key text,
  tracked_count integer,
  applied_count integer,
  interviewed_count integer,
  offer_count integer
)
language sql
security definer
set search_path = public
as $$
  select
    applications.role_key,
    count(*)::integer as tracked_count,
    count(*) filter (where applications.status in ('applied', 'interviewing', 'offer'))::integer as applied_count,
    count(*) filter (where applications.status in ('interviewing', 'offer'))::integer as interviewed_count,
    count(*) filter (where applications.status = 'offer')::integer as offer_count
  from public.applications
  where applications.role_key = any(role_keys)
  group by applications.role_key;
$$;

create or replace function public.get_role_peer_applicants(target_role_key text)
returns table (
  application_id uuid,
  profile_id uuid,
  full_name text,
  school text,
  school_logo_url text,
  company text,
  role text,
  location text,
  status public.application_status,
  application_year integer,
  updated_at timestamptz,
  can_message boolean
)
language sql
security definer
set search_path = public
as $$
  select
    applications.id as application_id,
    profiles.id as profile_id,
    profiles.full_name,
    profiles.school,
    profiles.school_logo_url,
    applications.company,
    applications.role,
    applications.location,
    applications.status,
    applications.application_year,
    applications.updated_at,
    (applications.user_id <> auth.uid()) as can_message
  from public.applications
  join public.profiles on profiles.id = applications.user_id
  where applications.role_key = target_role_key
    and (
      applications.user_id = auth.uid()
      or profiles.share_application_board = true
      or exists (
        select 1
        from public.friends
        where friends.status = 'accepted'
          and (
            (friends.requester_id = auth.uid() and friends.addressee_id = applications.user_id)
            or (friends.addressee_id = auth.uid() and friends.requester_id = applications.user_id)
          )
      )
    )
  order by
    case applications.status
      when 'offer' then 1
      when 'interviewing' then 2
      when 'applied' then 3
      when 'saved' then 4
      else 5
    end,
    applications.updated_at desc;
$$;

grant execute on function public.get_role_peer_summaries(text[]) to authenticated;
grant execute on function public.get_role_peer_applicants(text) to authenticated;

create or replace function public.get_peer_messages()
returns table (
  id uuid,
  role_key text,
  application_id uuid,
  sender_id uuid,
  recipient_id uuid,
  subject text,
  body text,
  read_at timestamptz,
  created_at timestamptz,
  other_profile_id uuid,
  other_full_name text,
  other_school text,
  other_school_logo_url text,
  application_company text,
  application_role text,
  application_status public.application_status,
  application_year integer
)
language sql
security definer
set search_path = public
as $$
  select
    peer_messages.id,
    peer_messages.role_key,
    peer_messages.application_id,
    peer_messages.sender_id,
    peer_messages.recipient_id,
    peer_messages.subject,
    peer_messages.body,
    peer_messages.read_at,
    peer_messages.created_at,
    other_profile.id as other_profile_id,
    other_profile.full_name as other_full_name,
    other_profile.school as other_school,
    other_profile.school_logo_url as other_school_logo_url,
    applications.company as application_company,
    applications.role as application_role,
    applications.status as application_status,
    applications.application_year
  from public.peer_messages
  left join public.applications on applications.id = peer_messages.application_id
  left join public.profiles other_profile
    on other_profile.id = case
      when peer_messages.sender_id = auth.uid() then peer_messages.recipient_id
      else peer_messages.sender_id
    end
  where auth.uid() = peer_messages.sender_id
     or auth.uid() = peer_messages.recipient_id
  order by peer_messages.created_at desc;
$$;

grant execute on function public.get_peer_messages() to authenticated;

notify pgrst, 'reload schema';
