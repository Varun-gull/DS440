create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  application_id text not null,
  company text not null,
  role text not null,
  status text not null default 'saved',
  event_type text not null default 'custom',
  date date not null,
  time text,
  notes text,
  created_at timestamptz default now()
);

alter table public.calendar_events
  add column if not exists time text,
  add column if not exists notes text;

alter table public.calendar_events enable row level security;

grant select, insert, update, delete on public.calendar_events to authenticated;

drop policy if exists "Users manage own calendar events" on public.calendar_events;
drop policy if exists "Users can manage own calendar events" on public.calendar_events;

create policy "Users can manage own calendar events"
  on public.calendar_events
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists calendar_events_user_date_idx on public.calendar_events (user_id, date);
