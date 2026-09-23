create table if not exists public.interview_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  prompt text not null,
  situation text not null,
  task text not null,
  action_taken text not null,
  result_outcome text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists interview_answers_set_updated_at on public.interview_answers;
create trigger interview_answers_set_updated_at before update on public.interview_answers
  for each row execute procedure public.set_updated_at();

alter table public.interview_answers enable row level security;

grant select, insert, update, delete on public.interview_answers to authenticated;

drop policy if exists "Users can manage own interview answers" on public.interview_answers;

create policy "Users can manage own interview answers"
on public.interview_answers for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
