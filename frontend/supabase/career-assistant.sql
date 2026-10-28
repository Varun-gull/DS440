-- Additive server controlled daily limits. No conversations or audio stored.
begin;
create table if not exists public.assistant_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_day date not null default (now() at time zone 'UTC')::date,
  text_requests integer not null default 0,
  voice_sessions integer not null default 0,
  last_text_at timestamptz,
  voice_until timestamptz,
  primary key(user_id, usage_day)
);
alter table public.assistant_usage enable row level security;
revoke all on public.assistant_usage from public, anon, authenticated;
grant select, insert, update, delete on public.assistant_usage to service_role;

create or replace function public.reserve_assistant_usage(p_user_id uuid, p_mode text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_day date := (now() at time zone 'UTC')::date; v_row public.assistant_usage%rowtype;
begin
  if p_user_id is null or p_mode is null or p_mode not in ('text','voice') then return false; end if;
  -- Serialize the same account even across the UTC day boundary.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 18421));
  if p_mode = 'voice' and exists(select 1 from public.assistant_usage where user_id = p_user_id and voice_until > now()) then
    return false;
  end if;
  insert into public.assistant_usage(user_id,usage_day) values(p_user_id,v_day) on conflict do nothing;
  select * into v_row from public.assistant_usage where user_id=p_user_id and usage_day=v_day for update;
  if p_mode = 'text' then
    if v_row.text_requests >= 50 or v_row.last_text_at > now() - interval '2 seconds' then return false; end if;
    update public.assistant_usage set text_requests=text_requests+1,last_text_at=now() where user_id=p_user_id and usage_day=v_day;
  else
    if v_row.voice_sessions >= 3 then return false; end if;
    update public.assistant_usage set voice_sessions=voice_sessions+1,voice_until=now()+interval '5 minutes' where user_id=p_user_id and usage_day=v_day;
  end if;
  return true;
end;
$$;
revoke all on function public.reserve_assistant_usage(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_assistant_usage(uuid,text) to service_role;
commit;
