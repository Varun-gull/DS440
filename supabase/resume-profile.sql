alter table public.profiles
  add column if not exists resume_text text,
  add column if not exists resume_keywords text[] not null default '{}',
  add column if not exists resume_file_name text,
  add column if not exists resume_updated_at timestamptz;
