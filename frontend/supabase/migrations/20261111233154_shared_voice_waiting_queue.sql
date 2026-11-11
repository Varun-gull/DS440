begin;
create table if not exists careerup_private.voice_waiters (
 user_id uuid primary key references auth.users(id) on delete cascade,
 request_id uuid not null,
 joined_at timestamptz not null default clock_timestamp(),
 last_seen_at timestamptz not null default clock_timestamp()
);
create table if not exists careerup_private.voice_leases (
 user_id uuid primary key references auth.users(id) on delete cascade,
 request_id uuid not null,
 reservation_id uuid not null unique,
 expires_at timestamptz not null
);
alter table careerup_private.voice_waiters enable row level security;
alter table careerup_private.voice_leases enable row level security;
revoke all on careerup_private.voice_waiters,careerup_private.voice_leases from public,anon,authenticated;
grant select,insert,update,delete on careerup_private.voice_waiters,careerup_private.voice_leases to service_role;

create or replace function public.claim_careerup_voice_turn(p_user_id uuid,p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_now timestamptz:=clock_timestamp(); v_position integer; v_active integer;
 v_joined timestamptz; v_reservation jsonb; v_existing timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended('careerup-shared-voice',27121));
 if p_request_id is null or not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Account unavailable'; end if;
 delete from careerup_private.voice_waiters where last_seen_at<v_now-interval '90 seconds';
 delete from careerup_private.voice_leases where expires_at<=v_now;
 select expires_at into v_existing from careerup_private.voice_leases where user_id=p_user_id;
 if found then return jsonb_build_object('state','active','availableAt',v_existing); end if;
 insert into careerup_private.voice_waiters(user_id,request_id,joined_at,last_seen_at) values(p_user_id,p_request_id,v_now,v_now)
 on conflict(user_id) do update set request_id=excluded.request_id,joined_at=case when careerup_private.voice_waiters.request_id=excluded.request_id then careerup_private.voice_waiters.joined_at else excluded.joined_at end,last_seen_at=excluded.last_seen_at;
 select joined_at into v_joined from careerup_private.voice_waiters where user_id=p_user_id;
 select count(*)+1 into v_position from careerup_private.voice_waiters where (joined_at,user_id)<(v_joined,p_user_id);
 select count(*) into v_active from careerup_private.voice_leases;
 if v_active>=3 or v_position>3-v_active then
  return jsonb_build_object('state','queued','position',v_position,'pollAfterSeconds',5);
 end if;
 v_reservation:=public.reserve_careerup_assistant(p_user_id,'voice');
 delete from careerup_private.voice_waiters where user_id=p_user_id;
 if not coalesce((v_reservation->>'allowed')::boolean,false) then return jsonb_build_object('state','unavailable'); end if;
 insert into careerup_private.voice_leases(user_id,request_id,reservation_id,expires_at)
 values(p_user_id,p_request_id,(v_reservation->>'reservationId')::uuid,v_now+interval '5 minutes 10 seconds');
 return v_reservation||jsonb_build_object('state','ready');
end$$;

create or replace function public.leave_careerup_voice_turn(p_user_id uuid,p_request_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('careerup-shared-voice',27121));
 delete from careerup_private.voice_waiters where user_id=p_user_id and request_id=p_request_id;
 -- Allow the provider socket time to close before another student takes the slot.
 update careerup_private.voice_leases set expires_at=least(expires_at,clock_timestamp()+interval '10 seconds')
 where user_id=p_user_id and request_id=p_request_id;
 if found then
  update public.assistant_usage set voice_until=least(voice_until,now())
  where user_id=p_user_id and voice_request_id=(select reservation_id from careerup_private.voice_leases where user_id=p_user_id and request_id=p_request_id);
 end if;
 return true;
end$$;
revoke all on function public.claim_careerup_voice_turn(uuid,uuid),public.leave_careerup_voice_turn(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_careerup_voice_turn(uuid,uuid),public.leave_careerup_voice_turn(uuid,uuid) to service_role;
commit;
