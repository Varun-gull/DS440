-- Class release: owner-only private profiles, sharing consent, active sessions,
-- protected progress, and non-recursive group membership rules.
begin;
create schema if not exists careerup_private;
revoke create on schema public from public, anon, authenticated;
revoke all on schema careerup_private from public, anon;
grant usage on schema careerup_private to authenticated, service_role;

create or replace function careerup_private.session_ok()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and exists(select 1 from auth.users u where u.id=auth.uid())
 and exists(select 1 from auth.sessions s where s.user_id=auth.uid()
   and s.id=case when coalesce(auth.jwt()->>'session_id','') ~ '^[0-9a-fA-F-]{36}$'
     then (auth.jwt()->>'session_id')::uuid else null end
   and (s.not_after is null or s.not_after>now()))
 and (coalesce(auth.jwt()->>'aal','')='aal2'
   or not exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.status='verified'));
$$;
revoke all on function careerup_private.session_ok() from public, anon;
grant execute on function careerup_private.session_ok() to authenticated, service_role;

create or replace function public.careerup_session_valid()
returns boolean language sql stable security invoker set search_path='' as $$
 select careerup_private.session_ok();
$$;
revoke all on function public.careerup_session_valid() from public, anon;
grant execute on function public.careerup_session_valid() to authenticated;

-- Remove broad row policies and every legacy column grant, not just table grants.
do $$ declare p record; c record; begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='profiles' loop
  execute format('drop policy %I on public.profiles',p.policyname);
 end loop;
 for c in select attname from pg_attribute where attrelid='public.profiles'::regclass and attnum>0 and not attisdropped loop
  execute format('revoke all (%I) on public.profiles from anon, authenticated',c.attname);
 end loop;
end $$;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
revoke insert,update,delete on public.completed_challenges,public.user_rewards from authenticated;
grant select on public.completed_challenges,public.user_rewards to authenticated;
alter table public.profiles enable row level security;
create policy "Read own private profile" on public.profiles for select to authenticated
 using(id=(select auth.uid()));

-- A restrictive policy adds session revocation and enrolled MFA checks to all
-- private browser-accessible records without replacing their ownership rules.
do $$ declare t text; begin
 foreach t in array array['profiles','applications','calendar_events','completed_challenges',
 'user_rewards','interview_answers','friends','peer_messages','career_groups','career_group_members',
 'email_updates','email_connections','assistant_usage','reward_wallets','reward_ledger','reward_activity',
 'reward_redemptions','reward_preferences','reward_streak_days','reward_friend_goals',
 'reward_goal_members','reward_pools','reward_pool_members'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists "Verified active session" on public.%I',t);
  execute format('create policy "Verified active session" on public.%I as restrictive for all to authenticated using ((select careerup_private.session_ok())) with check ((select careerup_private.session_ok()))',t);
 end loop;
end $$;

create or replace function careerup_private.can_view_board(p_owner uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select careerup_private.session_ok() and (p_owner=auth.uid() or (
  exists(select 1 from public.profiles p where p.id=p_owner and p.share_application_board)
  and exists(select 1 from public.friends f where f.status='accepted'
   and ((f.requester_id=auth.uid() and f.addressee_id=p_owner)
     or (f.addressee_id=auth.uid() and f.requester_id=p_owner)))));
$$;
revoke all on function careerup_private.can_view_board(uuid) from public, anon;
grant execute on function careerup_private.can_view_board(uuid) to authenticated;
drop policy if exists "Friends can read shared application boards" on public.applications;
-- Sharing exposes a deliberate projection, never private notes or future columns.
create or replace function public.shared_application_board(p_owner uuid)
returns table(id uuid,company text,role text,location text,source_url text,status public.application_status,
 role_key text,application_year integer,fit_score integer,xp_awarded integer,deadline date,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
 select a.id,a.company,a.role,a.location,a.source_url,a.status,a.role_key,a.application_year,
 a.fit_score,a.xp_awarded,a.deadline,a.updated_at from public.applications a
 where a.user_id=p_owner and careerup_private.can_view_board(p_owner) order by a.updated_at desc limit 1000;
$$;
revoke all on function public.shared_application_board(uuid) from public, anon;
grant execute on function public.shared_application_board(uuid) to authenticated;

-- Browser callers cannot edit progress, award flags, balances, or ranks.
revoke execute on function public.award_xp(integer) from public, anon, authenticated;
create or replace function public.award_careerup_xp(p_user_id uuid,p_amount integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.profiles%rowtype; previous_xp integer; bonus integer:=0; reached text[]:='{}';
 names text[]:=array['Manager','Director','Vice President','CEO'];
 aliases_a text[]:=array['Active Applicant','Qualified Candidate','Interview Ready','Offer Ready'];
 aliases_b text[]:=array['Silver Strategist','Gold Climber','Platinum Candidate','Elite Intern'];
 thresholds integer[]:=array[250,750,1500,3000]; amounts integer[]:=array[50,100,175,300]; i integer;
begin
 if p_amount is null or p_amount<1 or p_amount>10000 then raise exception 'Invalid progress award.'; end if;
 select * into p from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Account profile is unavailable.'; end if;
 previous_xp:=greatest(coalesce(p.xp,0),coalesce(p.total_xp,0));
 for i in 1..4 loop
  if previous_xp<thresholds[i] and previous_xp+p_amount>=thresholds[i]
   and not (coalesce(p.rank_bonus_awarded,'{}') && array[names[i],aliases_a[i],aliases_b[i]]) then
   bonus:=bonus+amounts[i]; reached:=array_append(reached,names[i]);
  end if;
 end loop;
 update public.profiles set xp=previous_xp+p_amount+bonus,total_xp=previous_xp+p_amount+bonus,
  rank_bonus_awarded=coalesce(p.rank_bonus_awarded,'{}')||reached where id=p_user_id;
 return jsonb_build_object('awarded',p_amount,'rankBonus',bonus,'reachedRanks',to_jsonb(reached));
end $$;
revoke all on function public.award_careerup_xp(uuid,integer) from public, anon, authenticated;
grant execute on function public.award_careerup_xp(uuid,integer) to service_role;

-- Accepted friendships require the recipient's approval. The sender cannot
-- rewrite either participant or accept their own invitation through REST.
drop policy if exists "Users can manage own friendships" on public.friends;
drop policy if exists "Read own friendships" on public.friends;
drop policy if exists "Send pending invitation" on public.friends;
drop policy if exists "Recipient accepts invitation" on public.friends;
drop policy if exists "Remove own friendship" on public.friends;
create policy "Read own friendships" on public.friends for select to authenticated
 using((select auth.uid()) in (requester_id,addressee_id));
create policy "Send pending invitation" on public.friends for insert to authenticated
 with check(requester_id=(select auth.uid()) and addressee_id<>requester_id and status='pending');
create policy "Recipient accepts invitation" on public.friends for update to authenticated
 using(addressee_id=(select auth.uid()) and status='pending')
 with check(addressee_id=(select auth.uid()) and status='accepted');
create policy "Remove own friendship" on public.friends for delete to authenticated
 using((select auth.uid()) in (requester_id,addressee_id));
revoke update on public.friends from authenticated;
grant update(status) on public.friends to authenticated;
revoke update on public.peer_messages from authenticated;
grant update(read_at) on public.peer_messages to authenticated;

-- Membership policies must not SELECT their own table through the same RLS
-- policy, which previously caused recursion on real group pages.
create or replace function careerup_private.is_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select careerup_private.session_ok() and (
  exists(select 1 from public.career_groups g where g.id=p_group and g.owner_id=auth.uid())
  or exists(select 1 from public.career_group_members m where m.group_id=p_group and m.user_id=auth.uid()));
$$;
revoke all on function careerup_private.is_group_member(uuid) from public, anon;
grant execute on function careerup_private.is_group_member(uuid) to authenticated;
drop policy if exists "Group members can read groups" on public.career_groups;
create policy "Group members can read groups" on public.career_groups for select to authenticated
 using(owner_id=(select auth.uid()) or careerup_private.is_group_member(id));
drop policy if exists "Group members can read memberships" on public.career_group_members;
create policy "Group members can read memberships" on public.career_group_members for select to authenticated
 using(careerup_private.is_group_member(group_id));
drop policy if exists "Members can add themselves or accepted friends" on public.career_group_members;
create policy "Members can add themselves or accepted friends" on public.career_group_members for insert to authenticated
 with check(added_by=(select auth.uid()) and careerup_private.is_group_member(group_id)
 and (user_id=(select auth.uid()) or exists(select 1 from public.friends f where f.status='accepted'
 and ((f.requester_id=auth.uid() and f.addressee_id=user_id) or (f.addressee_id=auth.uid() and f.requester_id=user_id)))));

-- Every peer result observes the same accepted-friend AND sharing rule.
create or replace function public.get_role_peer_summaries(role_keys text[])
returns table(role_key text,tracked_count integer,applied_count integer,interviewed_count integer,offer_count integer)
language sql stable security definer set search_path='' as $$
 select a.role_key,count(*)::integer,
 count(*) filter(where a.status in ('applied','interviewing','offer'))::integer,
 count(*) filter(where a.status in ('interviewing','offer'))::integer,
 count(*) filter(where a.status='offer')::integer
 from public.applications a where a.role_key=any(role_keys)
 and careerup_private.can_view_board(a.user_id) group by a.role_key;
$$;
create or replace function public.get_role_peer_applicants(target_role_key text)
returns table(application_id uuid,profile_id uuid,full_name text,school text,school_logo_url text,
 company text,role text,location text,status public.application_status,application_year integer,
 updated_at timestamptz,can_message boolean)
language sql stable security definer set search_path='' as $$
 select a.id,p.id,p.full_name,p.school,p.school_logo_url,a.company,a.role,a.location,a.status,
 a.application_year,a.updated_at,a.user_id<>auth.uid()
 from public.applications a join public.profiles p on p.id=a.user_id
 where a.role_key=target_role_key and careerup_private.can_view_board(a.user_id)
 order by case a.status when 'offer' then 1 when 'interviewing' then 2 when 'applied' then 3 when 'saved' then 4 else 5 end,a.updated_at desc;
$$;
create or replace function public.get_peer_messages()
returns table(id uuid,role_key text,application_id uuid,sender_id uuid,recipient_id uuid,subject text,
 body text,read_at timestamptz,created_at timestamptz,other_profile_id uuid,other_full_name text,
 other_school text,other_school_logo_url text,application_company text,application_role text,
 application_status public.application_status,application_year integer)
language sql stable security definer set search_path='' as $$
 select m.id,m.role_key,m.application_id,m.sender_id,m.recipient_id,m.subject,m.body,m.read_at,m.created_at,
 p.id,p.full_name,p.school,p.school_logo_url,a.company,a.role,a.status,a.application_year
 from public.peer_messages m
 left join public.applications a on a.id=m.application_id and careerup_private.can_view_board(a.user_id)
 left join public.profiles p on p.id=case when m.sender_id=auth.uid() then m.recipient_id else m.sender_id end
 where careerup_private.session_ok() and auth.uid() in (m.sender_id,m.recipient_id)
 order by m.created_at desc limit 250;
$$;
create or replace function public.email_scanner_session_ok()
returns boolean language sql stable security definer set search_path='' as $$
 select careerup_private.session_ok();
$$;
create or replace function public.profile_exists_for_message(profile_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select careerup_private.session_ok() and exists(select 1 from public.profiles p where p.id=profile_id);
$$;

-- Existing public helpers retain only the roles they actually need.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.get_role_peer_summaries(text[]),public.get_role_peer_applicants(text),
 public.get_peer_messages(),public.profile_exists_for_message(uuid),
 public.send_direct_profile_message(uuid,text,text),public.email_scanner_session_ok()
 to authenticated;
grant execute on function public.normalize_role_key_part(text),public.build_role_key(text,text)
 to authenticated,service_role;
revoke execute on function public.handle_new_user() from authenticated;
alter function public.set_updated_at() set search_path=public;
alter function public.normalize_role_key_part(text) set search_path=public;
alter function public.build_role_key(text,text) set search_path=public;
alter function public.set_application_search_fields() set search_path=public;
create index if not exists class_friends_requester_status on public.friends(requester_id,status,addressee_id);
create index if not exists class_friends_addressee_status on public.friends(addressee_id,status,requester_id);
create index if not exists class_group_members_user_group on public.career_group_members(user_id,group_id);
create index if not exists class_applications_owner_updated on public.applications(user_id,updated_at desc);
notify pgrst,'reload schema';
commit;
