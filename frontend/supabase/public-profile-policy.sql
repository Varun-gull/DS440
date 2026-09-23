grant select (id, full_name, school, school_logo_url, major, graduation_year, target_roles, target_locations, xp, total_xp, streak_count, applications_applied)
on public.profiles
to anon;

drop policy if exists "Anyone can read public profile summaries" on public.profiles;

create policy "Anyone can read public profile summaries"
on public.profiles for select
to anon
using (true);
