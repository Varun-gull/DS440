begin;
alter table careerup_private.voice_leases add column if not exists credential_encrypted text;
alter table careerup_private.voice_leases add column if not exists model text;
alter table careerup_private.voice_leases add column if not exists token_expires_at timestamptz;
alter table careerup_private.voice_leases add column if not exists connect_until timestamptz;
alter table careerup_private.voice_leases add column if not exists released_at timestamptz;
create or replace function public.claim_careerup_voice_turn(p_user_id uuid,p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_now timestamptz:=clock_timestamp(); v_position integer; v_active integer;
 v_joined timestamptz; v_reservation jsonb; v_lease careerup_private.voice_leases%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('careerup-shared-voice',27121));
 if p_request_id is null or not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Account unavailable'; end if;
 delete from careerup_private.voice_waiters where last_seen_at<v_now-interval '90 seconds';
 delete from careerup_private.voice_leases where expires_at<=v_now;
 select * into v_lease from careerup_private.voice_leases where user_id=p_user_id;
 if found then
  if v_lease.request_id=p_request_id and v_lease.released_at is null then
   if v_lease.credential_encrypted is not null and v_lease.connect_until>v_now then
    return jsonb_build_object('state','cached','encryptedCredential',v_lease.credential_encrypted,'model',v_lease.model,'expiresAt',v_lease.token_expires_at,'reservationId',v_lease.reservation_id);
   end if;
   if v_lease.credential_encrypted is null then return jsonb_build_object('state','preparing'); end if;
  end if;
  return jsonb_build_object('state','active','availableAt',v_lease.expires_at);
 end if;
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
 update careerup_private.voice_leases set expires_at=least(expires_at,clock_timestamp()+interval '10 seconds'),released_at=clock_timestamp(),credential_encrypted=null
 where user_id=p_user_id and request_id=p_request_id;
 if found then
  update public.assistant_usage set voice_until=least(voice_until,now())
  where user_id=p_user_id and voice_request_id=(select reservation_id from careerup_private.voice_leases where user_id=p_user_id and request_id=p_request_id);
 end if;
 return true;
end$$;

create or replace function public.store_careerup_voice_credential(p_user_id uuid,p_request_id uuid,p_reservation uuid,p_credential text,p_model text,p_expires_at timestamptz,p_connect_until timestamptz)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_credential is null or p_model is null or p_connect_until is null or p_expires_at is null or length(p_credential) not between 10 and 30000 or length(p_model) not between 1 and 120 or p_connect_until<=now() or p_connect_until>now()+interval '60 seconds' or p_expires_at>now()+interval '5 minutes 10 seconds' then raise exception 'Invalid voice delivery'; end if;
 update careerup_private.voice_leases set credential_encrypted=p_credential,model=p_model,token_expires_at=p_expires_at,connect_until=p_connect_until
 where user_id=p_user_id and request_id=p_request_id and reservation_id=p_reservation and released_at is null and expires_at>now() and credential_encrypted is null;
 return found;
end$$;
revoke all on function public.store_careerup_voice_credential(uuid,uuid,uuid,text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.store_careerup_voice_credential(uuid,uuid,uuid,text,text,timestamptz,timestamptz) to service_role;
revoke all on function public.claim_careerup_voice_turn(uuid,uuid),public.leave_careerup_voice_turn(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_careerup_voice_turn(uuid,uuid),public.leave_careerup_voice_turn(uuid,uuid) to service_role;
commit;
