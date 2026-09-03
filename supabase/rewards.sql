create table if not exists public.user_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_id text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, reward_id)
);

alter table public.user_rewards enable row level security;

grant select, insert, delete on public.user_rewards to authenticated;

drop policy if exists "Users can manage own rewards" on public.user_rewards;

create policy "Users can manage own rewards"
on public.user_rewards for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
