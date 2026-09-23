-- Privacy prompt and friend board visibility settings
-- Run this in Supabase SQL Editor after the existing schema is installed.

alter table public.profiles
  add column if not exists privacy_prompt_answered boolean not null default false;

alter table public.profiles
  add column if not exists share_application_board boolean not null default false;

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
