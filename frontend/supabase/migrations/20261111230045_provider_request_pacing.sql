-- One schedule shared by every deployment using this database. No prompts,
-- resumes, API keys or user identifiers are stored in the scheduler.
begin;
create schema if not exists careerup_private;
create table if not exists careerup_private.provider_schedule (
  bucket text primary key,
  next_start_at timestamptz not null
);
alter table careerup_private.provider_schedule enable row level security;
revoke all on careerup_private.provider_schedule from public, anon, authenticated;
grant usage on schema careerup_private to service_role;
grant select, insert, update on careerup_private.provider_schedule to service_role;

create or replace function public.reserve_provider_slot(p_bucket text, p_spacing_ms integer default 4500)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_now timestamptz := clock_timestamp(); v_slot timestamptz;
begin
  if length(p_bucket) not between 1 and 120 or p_spacing_ms not between 4500 and 60000 then
    raise exception 'Invalid provider schedule configuration';
  end if;
  insert into careerup_private.provider_schedule(bucket,next_start_at) values(p_bucket,v_now)
    on conflict(bucket) do nothing;
  select greatest(next_start_at,v_now) into v_slot
    from careerup_private.provider_schedule where bucket=p_bucket for update;
  -- Bound the queue so a request always fits inside the function deadline.
  if v_slot > v_now + interval '126 seconds' then
    return jsonb_build_object('allowed',false,'waitMs',ceil(extract(epoch from (v_slot-v_now))*1000));
  end if;
  update careerup_private.provider_schedule
    set next_start_at=v_slot+make_interval(secs=>p_spacing_ms/1000.0) where bucket=p_bucket;
  return jsonb_build_object('allowed',true,'waitMs',greatest(0,ceil(extract(epoch from (v_slot-v_now))*1000)));
end $$;
revoke all on function public.reserve_provider_slot(text,integer) from public,anon,authenticated;
grant execute on function public.reserve_provider_slot(text,integer) to service_role;

-- A report may spend two minutes waiting for provider capacity before generation.
create or replace function public.begin_reward_generation(p_user_id uuid,p_redemption_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$declare v_key uuid:=gen_random_uuid();begin
 update public.reward_redemptions set status='generating',generation_key=v_key,generation_started_at=now()
 where id=p_redemption_id and user_id=p_user_id and reward_id in ('deep-resume-review','personal-interview-pack','personal-skill-challenge')
 and (status='available' or(status='generating' and generation_started_at<now()-interval '5 minutes'));
 if not found then raise exception 'This tool is already being prepared, completed, or unavailable.'; end if;return v_key;
end$$;
revoke all on function public.begin_reward_generation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_reward_generation(uuid,uuid) to service_role;
commit;
