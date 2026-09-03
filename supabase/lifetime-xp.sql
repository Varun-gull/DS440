-- Split spendable XP from lifetime leaderboard XP.
-- Run this once in Supabase SQL Editor.

alter table public.profiles
  add column if not exists total_xp integer not null default 25;

alter table public.profiles
  add column if not exists reward_points integer not null default 25;

with reward_spend as (
  select
    user_id,
    sum(
      case reward_id
        when 'behavioral-interview-pack' then 100
        when 'recruiter-message-kit' then 120
        when 'technical-screen-checklist' then 160
        when 'application-quality-audit' then 90
        when 'company-research-template' then 80
        when 'resume-bullet-scorer' then 130
        when 'follow-up-calendar-system' then 110
        when 'offer-negotiation-primer' then 240
        else 0
      end
    )::integer as spent_xp
  from public.user_rewards
  group by user_id
)
update public.profiles
set total_xp = greatest(
    profiles.total_xp,
    profiles.xp + coalesce(reward_spend.spent_xp, 0) + (coalesce(profiles.streak_paid_revives, 0) * 50)
  ),
  updated_at = now()
from reward_spend
where profiles.id = reward_spend.user_id;

update public.profiles
set total_xp = greatest(total_xp, xp + (coalesce(streak_paid_revives, 0) * 50)),
  updated_at = now()
where total_xp < xp + (coalesce(streak_paid_revives, 0) * 50);

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
      end,
      updated_at = now()
  where id = auth.uid();
$$;

grant select (id, full_name, school, school_logo_url, major, graduation_year, target_roles, target_locations, xp, total_xp, reward_points, streak_count, applications_applied, share_application_board)
on public.profiles to anon;

grant execute on function public.award_xp(integer) to authenticated;
