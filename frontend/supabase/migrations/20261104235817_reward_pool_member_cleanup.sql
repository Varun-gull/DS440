-- Return other members' held points before an account deletion cascades into a pool.
begin;
create or replace function careerup_private.close_pools_for_deleted_member()
returns trigger language plpgsql security definer set search_path='' as $$
declare p public.reward_pools%rowtype;m public.reward_pool_members%rowtype;v_balance integer;begin
 for p in select pool.* from public.reward_pools pool join public.reward_pool_members member on member.pool_id=pool.id
  where member.user_id=old.id and pool.status='open' order by pool.id for update of pool loop
  for m in select * from public.reward_pool_members where pool_id=p.id and user_id<>old.id and contribution>0 order by user_id loop
   update public.reward_wallets set balance=balance+m.contribution,spent_total=spent_total-m.contribution where user_id=m.user_id returning balance into v_balance;
   insert into public.reward_ledger(user_id,delta,balance_after,kind,reason,reference_key) values(m.user_id,m.contribution,v_balance,'refund','Returned shared pool contribution','pool-refund:'||p.id::text);
   update public.profiles set reward_points=v_balance where id=m.user_id;
  end loop;
  update public.reward_pools set status='cancelled' where id=p.id;
 end loop;
 return old;
end$$;
revoke all on function careerup_private.close_pools_for_deleted_member() from public,anon,authenticated;
drop trigger if exists reward_pool_member_deleted on public.profiles;
create trigger reward_pool_member_deleted before delete on public.profiles for each row execute function careerup_private.close_pools_for_deleted_member();
commit;
