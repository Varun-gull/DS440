-- Keep authoritative balances exclusively in the protected wallet.
-- The legacy public profile field is no longer updated when earning or spending.
begin;

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
end$$;

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
 end loop;
 update public.reward_pools set status='cancelled' where id=p.id;
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

create or replace function careerup_private.close_pools_for_deleted_member()
returns trigger language plpgsql security definer set search_path='' as $$
declare p public.reward_pools%rowtype;m public.reward_pool_members%rowtype;v_balance integer;begin
 for p in select pool.* from public.reward_pools pool join public.reward_pool_members member on member.pool_id=pool.id
  where member.user_id=old.id and pool.status='open' order by pool.id for update of pool loop
  for m in select * from public.reward_pool_members where pool_id=p.id and user_id<>old.id and contribution>0 order by user_id loop
   update public.reward_wallets set balance=balance+m.contribution,spent_total=spent_total-m.contribution where user_id=m.user_id returning balance into v_balance;
   insert into public.reward_ledger(user_id,delta,balance_after,kind,reason,reference_key) values(m.user_id,m.contribution,v_balance,'refund','Returned shared pool contribution','pool-refund:'||p.id::text);
  end loop;
  update public.reward_pools set status='cancelled' where id=p.id;
 end loop;
 return old;
end$$;

commit;
