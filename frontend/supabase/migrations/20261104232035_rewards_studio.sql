-- Rewards are controlled by the authenticated server. No private content is public.
begin;
create schema if not exists careerup_private;
revoke all on schema careerup_private from public, anon, authenticated;
grant usage on schema careerup_private to service_role;

alter table public.profiles add column if not exists total_xp integer;
alter table public.profiles add column if not exists reward_points integer;
alter table public.profiles add column if not exists streak_free_revive_used boolean not null default false;
alter table public.profiles add column if not exists streak_paid_revives integer not null default 0;
alter table public.profiles add column if not exists streak_revive_started_on date;
alter table public.profiles add column if not exists streak_revive_base_count integer;
alter table public.profiles add column if not exists streak_revive_required_applications integer default 0;
update public.profiles set total_xp=greatest(coalesce(total_xp,0),coalesce(xp,0)),reward_points=greatest(0,coalesce(reward_points,xp,0)) where total_xp is null or reward_points is null;
alter table public.profiles alter column total_xp set default 25;
alter table public.profiles alter column reward_points set default 25;

create table if not exists public.reward_wallets (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 balance integer not null default 25 check(balance>=0),
 earned_total integer not null default 0 check(earned_total>=0),
 spent_total integer not null default 0 check(spent_total>=0),
 created_at timestamptz not null default now()
);
create table if not exists public.reward_ledger (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 delta integer not null, balance_after integer not null check(balance_after>=0), kind text not null, reason text not null,
 reference_key text not null, created_at timestamptz not null default now(),unique(user_id,reference_key)
);
create index if not exists reward_ledger_user_date_idx on public.reward_ledger(user_id,created_at desc);
create table if not exists public.reward_activity (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null, event_key text not null, happened_at timestamptz not null default now(),unique(user_id,event_key)
);
create index if not exists reward_activity_user_kind_date_idx on public.reward_activity(user_id,kind,happened_at);
create table if not exists public.reward_store_catalog (
 id text primary key, title text not null, cost integer not null check(cost>=0),kind text not null,
 repeatable boolean not null default false, active boolean not null default true
);
create table if not exists public.reward_redemptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 reward_id text not null references public.reward_store_catalog(id),cost integer not null check(cost>=0),
 status text not null check(status in ('available','generating','ready','used','refunded')),
 content jsonb,details jsonb not null default '{}',request_key uuid not null,generation_key uuid,
 generation_started_at timestamptz,created_at timestamptz not null default now(),unique(user_id,request_key)
);
create index if not exists reward_redemptions_user_kind_idx on public.reward_redemptions(user_id,reward_id,status);
create table if not exists public.reward_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 theme text not null default 'ocean' check(theme in ('ocean','forest','plum')),
 avatar text not null default 'initials' check(avatar in ('initials','compass','rocket','graduate')),
 badge text not null default ''
);
create table if not exists public.reward_streak_days (
 user_id uuid not null references public.profiles(id) on delete cascade,protected_on date not null,
 redemption_id uuid not null unique references public.reward_redemptions(id) on delete cascade,primary key(user_id,protected_on)
);
create table if not exists public.reward_friend_goals (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check(length(title) between 3 and 80),metric text not null check(metric in ('practice','save','apply','skill')),
 target integer not null check(target between 1 and 20),ends_at timestamptz not null,created_at timestamptz not null default now()
);
create table if not exists public.reward_goal_members (
 goal_id uuid not null references public.reward_friend_goals(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,
 state text not null check(state in ('invited','accepted','declined')),joined_at timestamptz,primary key(goal_id,user_id)
);
create index if not exists reward_goal_members_user_idx on public.reward_goal_members(user_id,goal_id);
create table if not exists public.reward_pools (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check(length(title) between 3 and 80),target integer not null check(target between 40 and 120),
 raised integer not null default 0 check(raised>=0),status text not null default 'open' check(status in ('open','funded','cancelled')),
 ends_at timestamptz not null default(now()+interval '14 days'),created_at timestamptz not null default now(),check(raised<=target)
);
create table if not exists public.reward_pool_members (
 pool_id uuid not null references public.reward_pools(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,
 state text not null check(state in ('invited','accepted','declined')),contribution integer not null default 0 check(contribution>=0),primary key(pool_id,user_id)
);
create index if not exists reward_pool_members_user_idx on public.reward_pool_members(user_id,pool_id);

-- These tables are accessed only after the app verifies the user and enrolled MFA.
do $$declare t text; begin foreach t in array array['reward_wallets','reward_ledger','reward_activity','reward_store_catalog','reward_redemptions','reward_preferences','reward_streak_days','reward_friend_goals','reward_goal_members','reward_pools','reward_pool_members'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to service_role',t);
end loop; end$$;
revoke insert,update,delete on public.user_rewards from anon,authenticated;
grant select,insert,update,delete on public.user_rewards to service_role;
grant select,update on public.profiles to service_role;
grant select on public.applications,public.friends,public.interview_answers to service_role;

-- Preserve existing balances; migration never changes permanent XP or charges a user.
insert into public.reward_wallets(user_id,balance) select id,greatest(0,coalesce(reward_points,xp,0)) from public.profiles on conflict do nothing;
insert into public.reward_ledger(user_id,delta,balance_after,kind,reason,reference_key)
select user_id,balance,balance,'opening','Your existing Reward Points','opening' from public.reward_wallets on conflict do nothing;

create or replace function careerup_private.reward_event(p_user uuid,p_key text,p_kind text,p_points integer,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_inserted uuid; v_balance integer; v_earned integer; v_today timestamptz; v_points integer;
begin
 insert into public.reward_activity(user_id,event_key,kind) values(p_user,p_key,p_kind) on conflict do nothing returning id into v_inserted;
 if v_inserted is null then return; end if;
 select balance into v_balance from public.reward_wallets where user_id=p_user for update;
 if not found then return; end if;
 v_today:=date_trunc('day',now() at time zone 'America/New_York') at time zone 'America/New_York';
 select coalesce(sum(delta),0) into v_earned from public.reward_ledger where user_id=p_user and kind='earn' and created_at>=v_today;
 v_points:=least(greatest(p_points,0),greatest(0,30-v_earned));
 if v_points=0 then return; end if;
 update public.reward_wallets set balance=balance+v_points,earned_total=earned_total+v_points where user_id=p_user returning balance into v_balance;
 insert into public.reward_ledger(user_id,delta,balance_after,kind,reason,reference_key) values(p_user,v_points,v_balance,'earn',p_reason,'earn:'||p_key);
 update public.profiles set reward_points=v_balance where id=p_user;
end$$;
revoke all on function careerup_private.reward_event(uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function careerup_private.reward_event(uuid,text,text,integer,text) to service_role;

create or replace function careerup_private.reward_profile_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
  insert into public.reward_wallets(user_id,balance) values(new.id,25) on conflict do nothing;
  insert into public.reward_ledger(user_id,delta,balance_after,kind,reason,reference_key) values(new.id,25,25,'opening','Welcome to CareerUp','opening') on conflict do nothing;
 end if;
 if length(coalesce(new.resume_text,''))>50 then perform careerup_private.reward_event(new.id,'resume:first','resume',8,'Uploaded your first resume'); end if;
 if coalesce(new.full_name,'')<>'' and coalesce(new.school,'')<>'' and coalesce(new.major,'')<>'' and coalesce(new.graduation_year,'')<>'' and cardinality(new.target_roles)>0 and cardinality(new.target_locations)>0 then
  perform careerup_private.reward_event(new.id,'profile:first','profile',6,'Completed your career profile');
 end if;
 return new;
end$$;
revoke all on function careerup_private.reward_profile_event() from public,anon,authenticated;
create or replace function careerup_private.reward_application_event() returns trigger language plpgsql security definer set search_path='' as $$
declare v_key text; begin
 v_key:=md5(lower(trim(new.company))||'|'||lower(trim(new.role))||'|'||coalesce(new.application_year,extract(year from new.created_at)::integer)::text);
 perform careerup_private.reward_event(new.user_id,'save:'||v_key,'save',1,'Saved a distinct career opportunity');
 if new.status::text in ('applied','interviewing','offer','rejected') then perform careerup_private.reward_event(new.user_id,'apply:'||v_key,'apply',4,'Recorded an application'); end if;
 if new.status::text in ('interviewing','offer') then perform careerup_private.reward_event(new.user_id,'interview:'||v_key,'interview',3,'Reached the interview stage'); end if;
 if new.status::text='offer' then perform careerup_private.reward_event(new.user_id,'offer:'||v_key,'offer',10,'Recorded an offer'); end if;
 return new;
end$$;
revoke all on function careerup_private.reward_application_event() from public,anon,authenticated;
create or replace function careerup_private.reward_practice_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if length(trim(coalesce(new.situation,'')))>=20 and length(trim(coalesce(new.task,'')))>=20 and length(trim(coalesce(new.action_taken,'')))>=20 and length(trim(coalesce(new.result_outcome,'')))>=20 then
  perform careerup_private.reward_event(new.user_id,'practice:'||md5(lower(trim(new.prompt)))||':'||(now() at time zone 'America/New_York')::date::text,'practice',6,'Saved a complete STAR practice answer');
 end if;return new;
end$$;
revoke all on function careerup_private.reward_practice_event() from public,anon,authenticated;

-- Mark old activity as historical, so editing it does not earn duplicate points.
insert into public.reward_activity(user_id,event_key,kind,happened_at)
select user_id,'save:'||md5(lower(trim(company))||'|'||lower(trim(role))||'|'||coalesce(application_year,extract(year from created_at)::integer)::text),'save',created_at from public.applications on conflict do nothing;
insert into public.reward_activity(user_id,event_key,kind,happened_at)
select user_id,'apply:'||md5(lower(trim(company))||'|'||lower(trim(role))||'|'||coalesce(application_year,extract(year from created_at)::integer)::text),'apply',updated_at from public.applications where status::text in ('applied','interviewing','offer','rejected') on conflict do nothing;
insert into public.reward_activity(user_id,event_key,kind,happened_at)
select id,'resume:first','resume',coalesce(resume_updated_at,created_at) from public.profiles where length(coalesce(resume_text,''))>50 on conflict do nothing;
insert into public.reward_activity(user_id,event_key,kind,happened_at)
select id,'profile:first','profile',created_at from public.profiles where coalesce(school,'')<>'' and coalesce(major,'')<>'' and coalesce(graduation_year,'')<>'' and cardinality(target_roles)>0 and cardinality(target_locations)>0 on conflict do nothing;
drop trigger if exists reward_profile_activity on public.profiles;
create trigger reward_profile_activity after insert or update of resume_text,full_name,school,major,graduation_year,target_roles,target_locations on public.profiles for each row execute function careerup_private.reward_profile_event();
drop trigger if exists reward_application_activity on public.applications;
create trigger reward_application_activity after insert or update of status on public.applications for each row execute function careerup_private.reward_application_event();
drop trigger if exists reward_practice_activity on public.interview_answers;
create trigger reward_practice_activity after insert or update on public.interview_answers for each row execute function careerup_private.reward_practice_event();

create or replace function public.redeem_careerup_reward(p_user_id uuid,p_reward_id text,p_request_key uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare c public.reward_store_catalog%rowtype; w public.reward_wallets%rowtype; v_id uuid; v_status text;
begin
 select * into w from public.reward_wallets where user_id=p_user_id for update;
 if not found then raise exception 'Rewards wallet is unavailable.'; end if;
 select id into v_id from public.reward_redemptions where user_id=p_user_id and request_key=p_request_key;
 if found then return v_id; end if;
 select * into c from public.reward_store_catalog where id=p_reward_id and active=true;
 if not found or c.kind in ('pool','workshop') then raise exception 'This reward is not available to redeem.'; end if;
 if not c.repeatable and exists(select 1 from public.reward_redemptions where user_id=p_user_id and reward_id=c.id and status<>'refunded') then raise exception 'This reward is already in your library.'; end if;
 if w.balance<c.cost then raise exception 'You need % more points.',c.cost-w.balance; end if;
 v_status:=case when c.kind in ('insights','appearance','template') then 'ready' else 'available' end;
 insert into public.reward_redemptions(user_id,reward_id,cost,status,request_key) values(p_user_id,c.id,c.cost,v_status,p_request_key) returning id into v_id;
 update public.reward_wallets set balance=balance-c.cost,spent_total=spent_total+c.cost where user_id=p_user_id returning balance into w.balance;
 insert into public.reward_ledger(user_id,delta,balance_after,kind,reason,reference_key) values(p_user_id,-c.cost,w.balance,'redeem',c.title,'redeem:'||v_id::text);
 update public.profiles set reward_points=w.balance where id=p_user_id;
 if c.kind='template' then insert into public.user_rewards(user_id,reward_id) values(p_user_id,c.id) on conflict do nothing; end if;
 return v_id;
end$$;
create or replace function public.refund_careerup_reward(p_user_id uuid,p_redemption_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare r public.reward_redemptions%rowtype; v_balance integer; begin
 perform 1 from public.reward_wallets where user_id=p_user_id for update;
 select * into r from public.reward_redemptions where id=p_redemption_id and user_id=p_user_id for update;
 if not found then raise exception 'Reward not found.'; end if;
 if r.status='refunded' then return; end if;
 if r.status<>'available' or r.cost=0 or r.created_at<=now()-interval '7 days' then raise exception 'Only unused rewards from the last seven days can be returned.'; end if;
 update public.reward_redemptions set status='refunded' where id=r.id;
 update public.reward_wallets set balance=balance+r.cost,spent_total=spent_total-r.cost where user_id=p_user_id returning balance into v_balance;
 insert into public.reward_ledger(user_id,delta,balance_after,kind,reason,reference_key) values(p_user_id,r.cost,v_balance,'refund','Returned an unused reward','refund:'||r.id::text);
 update public.profiles set reward_points=v_balance where id=p_user_id;
end$$;

create or replace function public.activate_streak_day(p_user_id uuid,p_redemption_id uuid,p_day date)
returns void language plpgsql security invoker set search_path='' as $$
declare v_today date:=(now() at time zone 'America/New_York')::date; begin
 perform 1 from public.reward_wallets where user_id=p_user_id for update;
 if p_day<v_today or p_day>v_today+7 then raise exception 'Choose today or a day in the next week.'; end if;
 if exists(select 1 from public.reward_streak_days where user_id=p_user_id and protected_on=p_day and redemption_id=p_redemption_id) then return; end if;
 if exists(select 1 from public.reward_streak_days where user_id=p_user_id and protected_on=p_day) then raise exception 'That day is already protected.'; end if;
 if exists(select 1 from generate_series(p_day-6,p_day,interval '1 day') d where (select count(*) from public.reward_streak_days where user_id=p_user_id and protected_on between d::date and d::date+6)>=2) then raise exception 'You can protect up to two days in any seven day period.'; end if;
 update public.reward_redemptions set status='used',details=jsonb_build_object('protectedOn',p_day) where id=p_redemption_id and user_id=p_user_id and reward_id='streak-day-pass' and status='available';
 if not found then raise exception 'An unused day pass is required.'; end if;
 insert into public.reward_streak_days values(p_user_id,p_day,p_redemption_id);
end$$;

create or replace function public.set_reward_appearance(p_user_id uuid,p_theme text,p_avatar text,p_badge text)
returns void language plpgsql security invoker set search_path='' as $$
declare v_apps integer;v_threshold integer;begin
 if p_theme not in ('ocean','forest','plum') or p_avatar not in ('initials','compass','rocket','graduate') then raise exception 'Choose one of the available styles.'; end if;
 if not exists(select 1 from public.reward_redemptions where user_id=p_user_id and reward_id='profile-studio' and status='ready') then raise exception 'Unlock Profile Studio first.'; end if;
 v_threshold:=case p_badge when '' then 0 when 'apps-bronze' then 1 when 'apps-silver' then 25 when 'apps-gold' then 100 when 'apps-platinum' then 250 when 'apps-diamond' then 1000 else 2147483647 end;
 select coalesce(applications_applied,0) into v_apps from public.profiles where id=p_user_id;
 if v_apps<v_threshold then raise exception 'Choose an achievement you have already earned.'; end if;
 insert into public.reward_preferences values(p_user_id,p_theme,p_avatar,p_badge) on conflict(user_id) do update set theme=excluded.theme,avatar=excluded.avatar,badge=excluded.badge;
end$$;

create or replace function public.begin_reward_generation(p_user_id uuid,p_redemption_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$declare v_key uuid:=gen_random_uuid();begin
 update public.reward_redemptions set status='generating',generation_key=v_key,generation_started_at=now()
 where id=p_redemption_id and user_id=p_user_id and reward_id in ('deep-resume-review','personal-interview-pack','personal-skill-challenge')
 and (status='available' or(status='generating' and generation_started_at<now()-interval '2 minutes'));
 if not found then raise exception 'This tool is already being prepared, completed, or unavailable.'; end if;return v_key;
end$$;
create or replace function public.finish_reward_generation(p_user_id uuid,p_redemption_id uuid,p_key uuid,p_content jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$begin
 update public.reward_redemptions set status=case when p_content is null then 'available' else 'ready' end,content=p_content,generation_key=null,generation_started_at=null
 where id=p_redemption_id and user_id=p_user_id and status='generating' and generation_key=p_key;
 return found;
end$$;
create or replace function public.complete_reward_skill(p_user_id uuid,p_redemption_id uuid,p_reflection text)
returns void language plpgsql security invoker set search_path='' as $$begin
 perform 1 from public.reward_wallets where user_id=p_user_id for update;
 if length(trim(p_reflection)) not between 80 and 2000 then raise exception 'Write a reflection between 80 and 2,000 characters.'; end if;
 update public.reward_redemptions set status='used',details=details||jsonb_build_object('reflection',trim(p_reflection),'completedAt',now()) where id=p_redemption_id and user_id=p_user_id and reward_id='personal-skill-challenge' and status='ready';
 if not found then raise exception 'Complete a prepared skill exercise first.'; end if;
 perform careerup_private.reward_event(p_user_id,'skill:'||p_redemption_id::text,'skill',4,'Reflected on a completed skill exercise');
end$$;

create or replace function public.get_reward_insights(p_user_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_stages jsonb;v_locations jsonb;v_companies jsonb;v_weeks jsonb;v_total integer;v_practice integer;begin
 if not exists(select 1 from public.reward_redemptions where user_id=p_user_id and reward_id='career-insights' and status='ready') then raise exception 'Unlock Career Insights first.'; end if;
 select count(*) into v_total from public.applications where user_id=p_user_id;
 select count(*) into v_practice from public.reward_activity where user_id=p_user_id and kind='practice';
 select coalesce(jsonb_agg(jsonb_build_object('label',label,'value',value)),'[]') into v_stages from
  (select s.status label,count(a.id) value from unnest(array['saved','applied','interviewing','offer','rejected']) with ordinality s(status,ord) left join public.applications a on a.user_id=p_user_id and a.status::text=s.status group by s.status,s.ord order by s.ord)x;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_locations from(select coalesce(nullif(trim(location),''),'Not specified') label,count(*) value from public.applications where user_id=p_user_id group by 1 order by 2 desc,1 limit 5)x;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_companies from(select company label,count(*) value from public.applications where user_id=p_user_id group by company order by 2 desc,1 limit 5)x;
 select jsonb_agg(jsonb_build_object('label',to_char(week,'Mon DD'),'saved',saved,'applied',applied,'practice',practice,'skill',skill) order by week) into v_weeks from
  (select d.week,count(a.id) filter(where a.kind='save') saved,count(a.id) filter(where a.kind='apply') applied,count(a.id) filter(where a.kind='practice') practice,count(a.id) filter(where a.kind='skill') skill
  from generate_series(date_trunc('week',now() at time zone 'America/New_York')-interval '3 weeks',date_trunc('week',now() at time zone 'America/New_York'),interval '1 week') d(week)
  left join public.reward_activity a on a.user_id=p_user_id and a.happened_at>=d.week at time zone 'America/New_York' and a.happened_at<(d.week+interval '1 week') at time zone 'America/New_York' group by d.week)x;
 return jsonb_build_object('total',v_total,'practice',v_practice,'stages',v_stages,'weeks',v_weeks,'locations',v_locations,'companies',v_companies,'generatedAt',now());
end$$;
revoke all on function public.get_reward_insights(uuid) from public,anon,authenticated;
grant execute on function public.get_reward_insights(uuid) to service_role;

create or replace function careerup_private.check_reward_friends(p_user uuid,p_friends uuid[]) returns void language plpgsql security invoker set search_path='' as $$
declare v_friend uuid;begin
 if coalesce(cardinality(p_friends),0) not between 1 and 5 or cardinality(p_friends)<>(select count(distinct x) from unnest(p_friends)x) or p_user=any(p_friends) then raise exception 'Choose one to five different friends.'; end if;
 foreach v_friend in array p_friends loop
  if not exists(select 1 from public.friends where status::text='accepted' and ((requester_id=p_user and addressee_id=v_friend) or(requester_id=v_friend and addressee_id=p_user))) then raise exception 'Invite accepted friends only.'; end if;
 end loop;
end$$;
revoke all on function careerup_private.check_reward_friends(uuid,uuid[]) from public,anon,authenticated;
grant execute on function careerup_private.check_reward_friends(uuid,uuid[]) to service_role;
create or replace function public.create_reward_goal(p_user_id uuid,p_title text,p_metric text,p_target integer,p_days integer,p_friends uuid[],p_redemption_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$declare v_id uuid;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,82712));
 perform careerup_private.check_reward_friends(p_user_id,p_friends);
 if p_days not in (7,14) then raise exception 'Choose seven or fourteen days.'; end if;
 if exists(select 1 from public.reward_friend_goals where owner_id=p_user_id and ends_at>now()) then raise exception 'Finish your current hosted challenge before creating another.'; end if;
 update public.reward_redemptions set status='used' where id=p_redemption_id and user_id=p_user_id and reward_id='friend-challenge-pass' and status='available';
 if not found then raise exception 'An unused friend challenge pass is required.'; end if;
 insert into public.reward_friend_goals(owner_id,title,metric,target,ends_at) values(p_user_id,trim(p_title),p_metric,p_target,now()+make_interval(days=>p_days)) returning id into v_id;
 insert into public.reward_goal_members values(v_id,p_user_id,'accepted',now());
 insert into public.reward_goal_members select v_id,x,'invited',null from unnest(p_friends)x;
 update public.reward_redemptions set details=details||jsonb_build_object('goalId',v_id) where id=p_redemption_id;
 return v_id;
end$$;
create or replace function public.leave_reward_goal(p_user_id uuid,p_goal_id uuid)
returns void language plpgsql security invoker set search_path='' as $$declare g public.reward_friend_goals%rowtype;begin
 select * into g from public.reward_friend_goals where id=p_goal_id for update;
 if not found or not exists(select 1 from public.reward_goal_members where goal_id=g.id and user_id=p_user_id and state='accepted') then raise exception 'Challenge not found.'; end if;
 if g.owner_id=p_user_id then
  update public.reward_friend_goals set ends_at=least(ends_at,now()) where id=g.id;
  if not exists(select 1 from public.reward_goal_members where goal_id=g.id and user_id<>p_user_id and state='accepted') then
   update public.reward_redemptions set status='available',details=details-'goalId' where user_id=p_user_id and reward_id='friend-challenge-pass' and status='used' and details->>'goalId'=g.id::text;
  end if;
 else update public.reward_goal_members set state='declined' where goal_id=g.id and user_id=p_user_id; end if;
end$$;
revoke all on function public.leave_reward_goal(uuid,uuid) from public,anon,authenticated;
grant execute on function public.leave_reward_goal(uuid,uuid) to service_role;
create or replace function public.respond_reward_goal(p_user_id uuid,p_goal_id uuid,p_accept boolean)
returns void language plpgsql security invoker set search_path='' as $$begin
 if not exists(select 1 from public.reward_friend_goals where id=p_goal_id and ends_at>now()) then raise exception 'This challenge has ended.'; end if;
 update public.reward_goal_members set state=case when p_accept then 'accepted' else 'declined' end,joined_at=case when p_accept then now() else null end where user_id=p_user_id and goal_id=p_goal_id and state='invited';
 if not found then raise exception 'This invitation is no longer available.'; end if;
end$$;

create or replace function public.create_reward_pool(p_user_id uuid,p_title text,p_friends uuid[])
returns uuid language plpgsql security invoker set search_path='' as $$declare v_id uuid;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,82713));
 perform careerup_private.check_reward_friends(p_user_id,p_friends);
 if exists(select 1 from public.reward_pools where owner_id=p_user_id and status='open') then raise exception 'Finish or cancel your current pool first.'; end if;
 insert into public.reward_pools(owner_id,title,target) values(p_user_id,trim(p_title),(cardinality(p_friends)+1)*20) returning id into v_id;
 insert into public.reward_pool_members values(v_id,p_user_id,'accepted',0);
 insert into public.reward_pool_members select v_id,x,'invited',0 from unnest(p_friends)x;
 return v_id;
end$$;
create or replace function public.cancel_reward_pool(p_user_id uuid,p_pool_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare p public.reward_pools%rowtype; m public.reward_pool_members%rowtype; v_balance integer;begin
 select * into p from public.reward_pools where id=p_pool_id for update;
 if not found or not exists(select 1 from public.reward_pool_members where pool_id=p.id and user_id=p_user_id) then raise exception 'Pool not found.'; end if;
 if p.status='cancelled' then return; end if;
 if p.status<>'open' then raise exception 'A completed pool cannot be cancelled.'; end if;
 for m in select * from public.reward_pool_members where pool_id=p.id and contribution>0 order by user_id loop
  update public.reward_wallets set balance=balance+m.contribution,spent_total=spent_total-m.contribution where user_id=m.user_id returning balance into v_balance;
  insert into public.reward_ledger(user_id,delta,balance_after,kind,reason,reference_key) values(m.user_id,m.contribution,v_balance,'refund','Returned shared pool contribution','pool-refund:'||p.id::text);
  update public.profiles set reward_points=v_balance where id=m.user_id;
 end loop;
 update public.reward_pools set status='cancelled' where id=p.id;
end$$;
create or replace function public.respond_reward_pool(p_user_id uuid,p_pool_id uuid,p_accept boolean)
returns void language plpgsql security invoker set search_path='' as $$begin
 perform 1 from public.reward_pools where id=p_pool_id and status='open' and ends_at>now() for update;
 if not found then raise exception 'This pool is no longer accepting invitations.'; end if;
 update public.reward_pool_members set state=case when p_accept then 'accepted' else 'declined' end where pool_id=p_pool_id and user_id=p_user_id and state='invited';
 if not found then raise exception 'This invitation is no longer available.'; end if;
 if not p_accept then perform public.cancel_reward_pool(p_user_id,p_pool_id); end if;
end$$;
create or replace function public.contribute_reward_pool(p_user_id uuid,p_pool_id uuid,p_points integer,p_request_key uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare p public.reward_pools%rowtype;v_balance integer;m public.reward_pool_members%rowtype;v_key text;begin
 select * into p from public.reward_pools where id=p_pool_id for update;
 if not found or not exists(select 1 from public.reward_pool_members where pool_id=p.id and user_id=p_user_id and state='accepted') then raise exception 'Join this pool before contributing.'; end if;
 v_key:='pool-contribution:'||p_request_key::text;
 if exists(select 1 from public.reward_ledger where user_id=p_user_id and reference_key=v_key) then return; end if;
 if p.status<>'open' or p.ends_at<=now() then raise exception 'This pool is no longer accepting points.'; end if;
 if exists(select 1 from public.reward_pool_members where pool_id=p.id and state<>'accepted') then raise exception 'Everyone must accept before points can be contributed.'; end if;
 if p_points is null or p_points<1 or p_points>p.target-p.raised then raise exception 'Choose an amount up to the remaining pool goal.'; end if;
 update public.reward_wallets set balance=balance-p_points,spent_total=spent_total+p_points where user_id=p_user_id and balance>=p_points returning balance into v_balance;
 if not found then raise exception 'You do not have enough Reward Points.'; end if;
 insert into public.reward_ledger(user_id,delta,balance_after,kind,reason,reference_key) values(p_user_id,-p_points,v_balance,'pool','Contributed to an interview night',v_key);
 update public.profiles set reward_points=v_balance where id=p_user_id;
 update public.reward_pool_members set contribution=contribution+p_points where pool_id=p.id and user_id=p_user_id;
 update public.reward_pools set raised=raised+p_points where id=p.id returning * into p;
 if p.raised=p.target then
  for m in select * from public.reward_pool_members where pool_id=p.id order by user_id loop
   insert into public.reward_redemptions(user_id,reward_id,cost,status,request_key,details) values(m.user_id,'extra-voice-session',0,'available',gen_random_uuid(),jsonb_build_object('poolId',p.id,'source','Interview night'));
   insert into public.reward_redemptions(user_id,reward_id,cost,status,request_key,details) values(m.user_id,'personal-interview-pack',0,'available',gen_random_uuid(),jsonb_build_object('poolId',p.id,'source','Interview night'));
  end loop;
  update public.reward_pools set status='funded' where id=p.id;
 end if;
end$$;

-- Paid voice credits extend the existing free allowance; overlapping sessions stay blocked.
alter table public.assistant_usage add column if not exists reward_voice_sessions integer not null default 0;
alter table public.assistant_usage add column if not exists voice_request_id uuid;
alter table public.assistant_usage add column if not exists voice_reward_id uuid;
create or replace function public.reserve_careerup_assistant(p_user_id uuid,p_mode text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_day date:=(now() at time zone 'UTC')::date; u public.assistant_usage%rowtype;v_reward uuid;v_request uuid:=gen_random_uuid();begin
 if p_user_id is null or p_mode not in ('text','voice') then return jsonb_build_object('allowed',false); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,18421));
 if p_mode='voice' and exists(select 1 from public.assistant_usage where user_id=p_user_id and voice_until>now()) then return jsonb_build_object('allowed',false); end if;
 insert into public.assistant_usage(user_id,usage_day) values(p_user_id,v_day) on conflict do nothing;
 select * into u from public.assistant_usage where user_id=p_user_id and usage_day=v_day for update;
 if p_mode='text' then
  if u.text_requests>=50 or u.last_text_at>now()-interval '2 seconds' then return jsonb_build_object('allowed',false); end if;
  update public.assistant_usage set text_requests=text_requests+1,last_text_at=now() where user_id=p_user_id and usage_day=v_day;
 else
  if u.voice_sessions>=10 then return jsonb_build_object('allowed',false); end if;
  if u.voice_sessions-u.reward_voice_sessions>=3 then
   select id into v_reward from public.reward_redemptions where user_id=p_user_id and reward_id='extra-voice-session' and status='available' order by created_at for update skip locked limit 1;
   if v_reward is null then return jsonb_build_object('allowed',false); end if;
   update public.reward_redemptions set status='used' where id=v_reward;
  end if;
  update public.assistant_usage set voice_sessions=voice_sessions+1,reward_voice_sessions=reward_voice_sessions+case when v_reward is null then 0 else 1 end,
   voice_until=now()+interval '5 minutes',voice_request_id=v_request,voice_reward_id=v_reward where user_id=p_user_id and usage_day=v_day;
 end if;
 return jsonb_build_object('allowed',true,'reservationId',v_request,'rewardUsed',v_reward is not null);
end$$;
create or replace function public.cancel_careerup_voice(p_user_id uuid,p_reservation uuid)
returns void language plpgsql security invoker set search_path='' as $$declare u public.assistant_usage%rowtype;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,18421));
 select * into u from public.assistant_usage where user_id=p_user_id and voice_request_id=p_reservation for update;
 if not found then return; end if;
 if u.voice_reward_id is not null then update public.reward_redemptions set status='available' where id=u.voice_reward_id and user_id=p_user_id and status='used'; end if;
 update public.assistant_usage set voice_sessions=greatest(0,voice_sessions-1),reward_voice_sessions=greatest(0,reward_voice_sessions-case when u.voice_reward_id is null then 0 else 1 end),voice_until=null,voice_request_id=null,voice_reward_id=null where user_id=p_user_id and usage_day=u.usage_day;
end$$;

-- None of these privileged operations can be called directly by a browser.
do $$declare f record;begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('redeem_careerup_reward','refund_careerup_reward','activate_streak_day','set_reward_appearance','begin_reward_generation','finish_reward_generation','complete_reward_skill','create_reward_goal','respond_reward_goal','create_reward_pool','cancel_reward_pool','respond_reward_pool','contribute_reward_pool','reserve_careerup_assistant','cancel_careerup_voice') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
end loop;end$$;

insert into public.reward_store_catalog(id,title,cost,kind,repeatable,active) values
('extra-voice-session','One more practice round',25,'voice',true,true),
('deep-resume-review','A second look at your resume',35,'resume',true,true),
('personal-interview-pack','Walk in prepared',25,'interview',true,true),
('personal-skill-challenge','Turn a gap into a strength',20,'skill',true,true),
('career-insights','See your search clearly',30,'insights',false,true),
('profile-studio','Make CareerUp yours',30,'appearance',false,true),
('streak-day-pass','A little breathing room',12,'shield',true,true),
('friend-challenge-pass','Bring a friend along',20,'challenge',true,true),
('shared-reward-pool','Make it an interview night',0,'pool',true,false),
('career-workshop-pass','Take the next step, together',0,'workshop',false,false),
('behavioral-interview-pack','Behavioral Interview Prep Kit',28,'template',false,true),
('recruiter-message-kit','Recruiter Outreach Pack',26,'template',false,true),
('technical-screen-checklist','Technical Screen Prep Plan',35,'template',false,true),
('application-quality-audit','High-Priority Application Checklist',16,'template',false,true),
('company-research-template','Company Research Brief',18,'template',false,true),
('resume-bullet-scorer','Resume Keyword Tailor Kit',30,'template',false,true),
('follow-up-calendar-system','Follow-up Calendar System',20,'template',false,true),
('cold-email-outline','Networking Tracker Template',19,'template',false,true),
('offer-negotiation-primer','Offer Decision Kit',48,'template',false,true),
('rejection-recovery-plan','Rejection Recovery Plan',12,'template',false,true),
('referral-ask-playbook','Referral Ask Playbook',22,'template',false,true),
('phone-screen-survival-kit','Phone Screen Survival Kit',28,'template',false,true),
('linkedin-profile-audit','LinkedIn Profile Audit',26,'template',false,true),
('career-fair-game-plan','Career Fair Game Plan',18,'template',false,true)
on conflict(id) do update set title=excluded.title,cost=excluded.cost,kind=excluded.kind,repeatable=excluded.repeatable,active=excluded.active;
insert into public.reward_redemptions(user_id,reward_id,cost,status,request_key,created_at,details)
select r.user_id,r.reward_id,0,'ready',r.id,r.unlocked_at,'{"source":"Previously unlocked"}'::jsonb from public.user_rewards r join public.reward_store_catalog c on c.id=r.reward_id on conflict(user_id,request_key) do nothing;

commit;
