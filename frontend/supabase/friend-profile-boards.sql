-- Friend profile application boards
-- Run this in Supabase SQL Editor after the main schema is already installed.

alter table public.profiles
  add column if not exists share_application_board boolean not null default false;

alter table public.profiles
  add column if not exists privacy_prompt_answered boolean not null default false;

grant select (id, full_name, school, school_logo_url, major, graduation_year, target_roles, target_locations, xp, total_xp, streak_count, applications_applied, share_application_board)
on public.profiles to anon;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, share_application_board, privacy_prompt_answered)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'share_application_board')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'privacy_prompt_answered')::boolean, false)
  );
  return new;
end;
$$;

drop policy if exists "Friends can read shared application boards" on public.applications;

create policy "Friends can read shared application boards"
on public.applications for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = applications.user_id
      and profiles.share_application_board = true
  )
  and exists (
    select 1
    from public.friends
    where friends.status = 'accepted'
      and (
        (friends.requester_id = auth.uid() and friends.addressee_id = applications.user_id)
        or (friends.addressee_id = auth.uid() and friends.requester_id = applications.user_id)
      )
  )
);
