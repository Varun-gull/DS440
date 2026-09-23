-- CareerUp gamification, replenishing challenges, and groups.
-- Run this in Supabase SQL Editor after the base schema.

alter table public.profiles
  add column if not exists rank_bonus_awarded text[] not null default '{}',
  add column if not exists resume_uploaded_awarded boolean not null default false;

create table if not exists public.career_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.career_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

drop trigger if exists career_groups_set_updated_at on public.career_groups;
create trigger career_groups_set_updated_at before update on public.career_groups
  for each row execute procedure public.set_updated_at();

alter table public.career_groups enable row level security;
alter table public.career_group_members enable row level security;

grant select, insert, update, delete on public.career_groups to authenticated;
grant select, insert, delete on public.career_group_members to authenticated;

drop policy if exists "Group members can read groups" on public.career_groups;
drop policy if exists "Users can create groups" on public.career_groups;
drop policy if exists "Group owners can update groups" on public.career_groups;
drop policy if exists "Group owners can delete groups" on public.career_groups;
drop policy if exists "Group members can read memberships" on public.career_group_members;
drop policy if exists "Members can add themselves or accepted friends" on public.career_group_members;
drop policy if exists "Members can leave groups" on public.career_group_members;

create policy "Group members can read groups"
on public.career_groups for select
to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1
    from public.career_group_members
    where career_group_members.group_id = career_groups.id
      and career_group_members.user_id = auth.uid()
  )
);

create policy "Users can create groups"
on public.career_groups for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Group owners can update groups"
on public.career_groups for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Group owners can delete groups"
on public.career_groups for delete
to authenticated
using (owner_id = auth.uid());

create policy "Group members can read memberships"
on public.career_group_members for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.career_group_members own_membership
    where own_membership.group_id = career_group_members.group_id
      and own_membership.user_id = auth.uid()
  )
);

create policy "Members can add themselves or accepted friends"
on public.career_group_members for insert
to authenticated
with check (
  added_by = auth.uid()
  and (
    user_id = auth.uid()
    or exists (
      select 1
      from public.career_group_members own_membership
      where own_membership.group_id = career_group_members.group_id
        and own_membership.user_id = auth.uid()
    )
  )
  and (
    user_id = auth.uid()
    or exists (
      select 1
      from public.friends
      where friends.status = 'accepted'
        and (
          (friends.requester_id = auth.uid() and friends.addressee_id = career_group_members.user_id)
          or (friends.addressee_id = auth.uid() and friends.requester_id = career_group_members.user_id)
        )
    )
  )
);

create policy "Members can leave groups"
on public.career_group_members for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.career_groups
    where career_groups.id = career_group_members.group_id
      and career_groups.owner_id = auth.uid()
  )
);

create index if not exists career_group_members_user_idx on public.career_group_members(user_id);
create index if not exists career_group_members_group_idx on public.career_group_members(group_id);

insert into public.challenges (title, description, xp_reward, target, active)
select title, description, xp_reward, target, true
from (
  values
    ('Daily Apply Sprint', 'Submit one high-quality application today.', 40, 1),
    ('Apply Duo', 'Move two roles to applied today for a stronger recruiting day.', 70, 2),
    ('Watchlist Builder', 'Save five roles worth reviewing later.', 35, 5),
    ('Pipeline Builder', 'Track ten roles in your application board.', 80, 10),
    ('Profile Power-Up', 'Complete school, major, graduation year, goals, and resume signals.', 45, 6),
    ('Resume Ready', 'Upload or paste a readable resume so matching can improve.', 40, 1),
    ('Interview Momentum', 'Move one role into interviewing.', 90, 1),
    ('Offer Celebration', 'Move one role into offer.', 150, 1),
    ('Friend Builder', 'Add one accepted friend to CareerUp.', 35, 1),
    ('Group Launch', 'Create or join one recruiting group.', 55, 1),
    ('Peer Message', 'Send one helpful message to another applicant.', 30, 1)
) as seed(title, description, xp_reward, target)
where not exists (
  select 1
  from public.challenges
  where lower(public.challenges.title) = lower(seed.title)
);
