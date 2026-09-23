create table if not exists public.postings (
  id uuid primary key default gen_random_uuid(),
  posting_key text not null unique,
  kind text not null check (kind in ('internship', 'new-grad')),
  company text not null,
  title text not null,
  location text not null default 'United States',
  source text not null,
  source_url text not null,
  work_mode text not null default 'onsite' check (work_mode in ('remote', 'hybrid', 'onsite')),
  remote boolean not null default false,
  posted_at_label text not null default 'Recently',
  recency_score numeric not null default 999999,
  tags text[] not null default '{}',
  tags_text text not null default '',
  description text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb
);

create index if not exists postings_kind_recency_idx on public.postings (kind, recency_score, last_seen_at desc);
create index if not exists postings_kind_company_idx on public.postings (kind, company);
create index if not exists postings_kind_work_mode_idx on public.postings (kind, work_mode);
create index if not exists postings_source_url_idx on public.postings (source_url);

alter table public.postings enable row level security;

drop policy if exists "Anyone can read cached postings" on public.postings;
create policy "Anyone can read cached postings"
on public.postings
for select
to anon, authenticated
using (true);
