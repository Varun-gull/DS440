-- Split permanent leaderboard XP from spendable Reward Points.
-- Run this once in Supabase SQL Editor.

alter table public.profiles
  add column if not exists reward_points integer not null default 25;

update public.profiles
set
  reward_points = case
    when reward_points = 25 and coalesce(xp, 0) <> 25 then coalesce(xp, 0)
    else coalesce(reward_points, xp, 0)
  end,
  xp = greatest(coalesce(xp, 0), coalesce(total_xp, xp, 0)),
  total_xp = greatest(coalesce(total_xp, 0), coalesce(xp, 0));

create or replace function public.award_xp(amount integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set xp = xp + greatest(amount, 0),
      total_xp = total_xp + greatest(amount, 0),
      reward_points = reward_points + case
        when greatest(amount, 0) = 0 then 0
        else greatest(1, round(greatest(amount, 0)::numeric * 0.2)::integer)
      end
  where id = auth.uid();
$$;

grant select (id, full_name, school, school_logo_url, major, graduation_year, target_roles, target_locations, xp, total_xp, reward_points, streak_count, applications_applied, share_application_board)
on public.profiles to anon;

grant select (id, full_name, school, school_logo_url, major, graduation_year, target_roles, target_locations, xp, total_xp, reward_points, streak_count, applications_applied, share_application_board)
on public.profiles to authenticated;
