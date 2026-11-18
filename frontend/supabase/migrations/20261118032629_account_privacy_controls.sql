begin;

-- Acknowledgment is evidence, never a JWT permission or an invented acceptance
-- for existing accounts. Only the new-user trigger writes this record.
create table public.account_legal_acceptances (
 user_id uuid primary key references auth.users(id) on delete cascade,
 terms_version text not null,
 privacy_version text not null,
 adult_confirmed boolean not null check(adult_confirmed),
 accepted_at timestamptz not null default now()
);
alter table public.account_legal_acceptances enable row level security;
revoke all on public.account_legal_acceptances from public,anon,authenticated;
grant select on public.account_legal_acceptances to authenticated,service_role;
create policy "Read own legal acknowledgment" on public.account_legal_acceptances for select to authenticated
 using(user_id=(select auth.uid()) and (select careerup_private.session_ok()));

create function careerup_private.record_signup_agreement()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.raw_user_meta_data->>'terms_version'='2026-11-17'
 and new.raw_user_meta_data->>'privacy_version'='2026-11-17'
 and new.raw_user_meta_data->>'adult_confirmed'='true' then
  insert into public.account_legal_acceptances(user_id,terms_version,privacy_version,adult_confirmed)
  values(new.id,'2026-11-17','2026-11-17',true);
 end if;
 return new;
end$$;
revoke all on function careerup_private.record_signup_agreement() from public,anon,authenticated,service_role;
create trigger careerup_record_signup_agreement after insert on auth.users
 for each row execute function careerup_private.record_signup_agreement();

-- Fixed allowlist, no caller-supplied user identifier, no credentials or tokens.
-- A single JSON result avoids PostgREST's usual per-table row limit.
create function careerup_private.export_account()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); result jsonb; t text; rows jsonb;
begin
 if not careerup_private.session_ok() then raise exception 'Sign in and complete two factor authentication first.'; end if;
 select jsonb_build_object('id',id,'email',email,'created_at',created_at,'email_confirmed_at',email_confirmed_at)
 into result from auth.users where id=u;
 result:=jsonb_build_object('account',result);
 select to_jsonb(p) into rows from public.profiles p where id=u;
 result:=result||jsonb_build_object('profile',rows);
 foreach t in array array['applications','calendar_events','interview_answers','completed_challenges','user_rewards',
  'reward_wallets','reward_ledger','reward_activity','reward_preferences','reward_streak_days','account_legal_acceptances'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r where user_id=$1',t) into rows using u;
  result:=result||jsonb_build_object(t,rows);
 end loop;
 select coalesce(jsonb_agg(to_jsonb(r)-array['generation_key','request_key']), '[]'::jsonb) into rows from public.reward_redemptions r where user_id=u;
 result:=result||jsonb_build_object('reward_redemptions',rows);
 select coalesce(jsonb_agg(to_jsonb(r)-array['source_key','thread_key']),'[]'::jsonb) into rows from public.email_updates r where user_id=u;
 result:=result||jsonb_build_object('email_updates',rows);
 select jsonb_build_object('email',email,'granted_scope',granted_scope,'consented_at',consented_at,'last_scanned_at',last_scanned_at,'scan_days',scan_days,'reconnect_required',reconnect_required)
 into rows from public.email_connections where user_id=u;
 result:=result||jsonb_build_object('gmail_connection',rows);
 select coalesce(jsonb_agg(jsonb_build_object('usage_day',usage_day,'text_requests',text_requests,'voice_sessions',voice_sessions,'reward_voice_sessions',reward_voice_sessions)),'[]'::jsonb) into rows from public.assistant_usage where user_id=u;
 result:=result||jsonb_build_object('assistant_usage',rows);
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows from public.friends r where u in(requester_id,addressee_id);
 result:=result||jsonb_build_object('friendships',rows);
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows from public.peer_messages r where u in(sender_id,recipient_id);
 result:=result||jsonb_build_object('messages',rows);
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows from public.career_group_members r where user_id=u;
 result:=result||jsonb_build_object('group_memberships',rows);
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows from public.career_groups r where owner_id=u or exists(select 1 from public.career_group_members m where m.group_id=r.id and m.user_id=u);
 result:=result||jsonb_build_object('groups',rows);
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows from public.reward_goal_members r where user_id=u;
 result:=result||jsonb_build_object('goal_memberships',rows);
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows from public.reward_friend_goals r where owner_id=u or exists(select 1 from public.reward_goal_members m where m.goal_id=r.id and m.user_id=u);
 result:=result||jsonb_build_object('shared_goals',rows);
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows from public.reward_pool_members r where user_id=u;
 result:=result||jsonb_build_object('pool_memberships',rows);
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rows from public.reward_pools r where owner_id=u or exists(select 1 from public.reward_pool_members m where m.pool_id=r.id and m.user_id=u);
 return result||jsonb_build_object('shared_pools',rows);
end$$;
revoke all on function careerup_private.export_account() from public,anon,authenticated,service_role;
grant execute on function careerup_private.export_account() to authenticated;
create function public.export_careerup_account() returns jsonb language sql stable security invoker set search_path='' as $$select careerup_private.export_account();$$;
revoke all on function public.export_careerup_account() from public,anon,service_role;
grant execute on function public.export_careerup_account() to authenticated;

-- Runs atomically with Auth deletion. If cleanup fails the deletion rolls back.
-- Pool locks serialize cancellation against concurrent funding/contributions.
create function careerup_private.cleanup_deleted_account()
returns trigger language plpgsql security definer set search_path='' as $$
declare p record;
begin
 for p in select r.id from public.reward_pools r
 where r.status='open' and (r.owner_id=old.id or exists(select 1 from public.reward_pool_members m where m.pool_id=r.id and m.user_id=old.id))
 order by r.id for update loop
  perform public.cancel_reward_pool(old.id,p.id);
 end loop;
 -- Legacy calendar FK does not cascade. Other account records cascade via profile.
 delete from public.calendar_events where user_id=old.id;
 delete from auth.sessions where user_id=old.id;
 return old;
end$$;
revoke all on function careerup_private.cleanup_deleted_account() from public,anon,authenticated,service_role;
create trigger careerup_cleanup_deleted_account before delete on auth.users
 for each row execute function careerup_private.cleanup_deleted_account();
create table careerup_private.account_action_attempts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_start timestamptz not null default now(), attempts integer not null default 1
);
alter table careerup_private.account_action_attempts enable row level security;
revoke all on careerup_private.account_action_attempts from public,anon,authenticated;
grant select,insert,update,delete on careerup_private.account_action_attempts to service_role;
create function public.claim_careerup_account_action(p_user_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 insert into careerup_private.account_action_attempts(user_id) values(p_user_id)
 on conflict(user_id) do update set
 attempts=case when account_action_attempts.window_start<now()-interval '5 minutes' then 1 else account_action_attempts.attempts+1 end,
 window_start=case when account_action_attempts.window_start<now()-interval '5 minutes' then now() else account_action_attempts.window_start end
 returning attempts into n;
 return n<=5;
end$$;
revoke all on function public.claim_careerup_account_action(uuid) from public,anon,authenticated;
grant execute on function public.claim_careerup_account_action(uuid) to service_role;
commit;
