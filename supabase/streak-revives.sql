alter table public.profiles
  add column if not exists streak_free_revive_used boolean not null default false,
  add column if not exists streak_paid_revives integer not null default 0 check (streak_paid_revives >= 0),
  add column if not exists streak_revive_started_on date,
  add column if not exists streak_revive_base_count integer,
  add column if not exists streak_revive_required_applications integer not null default 0;
