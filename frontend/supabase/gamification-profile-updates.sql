-- Gamification and profile updates
-- Run this in Supabase SQL Editor after the existing schema is installed.

alter table public.profiles
  add column if not exists school_logo_url text;

alter table public.profiles
  add column if not exists privacy_prompt_answered boolean not null default false;

alter table public.completed_challenges
  add column if not exists completed_on date not null default current_date;

alter table public.completed_challenges
  drop constraint if exists completed_challenges_user_id_challenge_id_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'completed_challenges_user_id_challenge_id_completed_on_key'
  ) then
    alter table public.completed_challenges
      add constraint completed_challenges_user_id_challenge_id_completed_on_key unique (user_id, challenge_id, completed_on);
  end if;
end $$;

grant select (id, full_name, school, school_logo_url, major, graduation_year, target_roles, target_locations, xp, total_xp, streak_count, applications_applied, share_application_board)
on public.profiles to anon;
