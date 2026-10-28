-- Additive migration. Run after schema.sql; never rerun the base schema on live data.
-- No email credentials or suggestions are accessible through profiles or friends.
begin;

create table if not exists public.email_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email text not null,
  refresh_token_encrypted text not null,
  granted_scope text not null,
  consented_at timestamptz not null default now(),
  last_scanned_at timestamptz,
  scan_page_token text,
  scan_query text,
  scan_days integer not null default 30 check (scan_days in (7, 30, 90)),
  scan_lease uuid,
  scan_lease_until timestamptz,
  last_scan_attempt_at timestamptz,
  reconnect_required boolean not null default false
);

alter table public.email_connections enable row level security;
revoke all on public.email_connections from public, anon, authenticated;
grant select, insert, update, delete on public.email_connections to service_role;

create table if not exists public.email_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('gmail', 'paste')),
  source_key text not null,
  thread_key text,
  subject text not null check (length(subject) <= 300),
  sender text not null check (length(sender) <= 300),
  received_at timestamptz not null,
  proposed_status public.application_status not null check (proposed_status <> 'saved'),
  evidence text not null check (length(evidence) <= 400),
  extracted_company text not null default '',
  extracted_role text not null default '',
  action_date_text text not null default '',
  confidence text not null check (confidence in ('high', 'review')),
  suggested_application_id uuid references public.applications(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  previous_status public.application_status,
  decision text not null default 'pending' check (decision in ('pending', 'confirmed', 'dismissed')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, source, source_key)
);

alter table public.email_updates enable row level security;
revoke all on public.email_updates from public, anon, authenticated;
grant select on public.email_updates to authenticated;
grant select, insert, update, delete on public.email_updates to service_role;
create or replace function public.email_scanner_session_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    coalesce(auth.jwt()->>'aal', '') = 'aal2'
    or not exists(select 1 from auth.mfa_factors where user_id = auth.uid() and status = 'verified')
  );
$$;
revoke all on function public.email_scanner_session_ok() from public, anon;
grant execute on function public.email_scanner_session_ok() to authenticated, service_role;
drop policy if exists email_updates_owner_read on public.email_updates;
create policy email_updates_owner_read on public.email_updates for select to authenticated
  using (user_id = (select auth.uid()) and (select public.email_scanner_session_ok()));
create index if not exists email_updates_owner_decision_idx on public.email_updates(user_id, decision, received_at desc);

-- The lease prevents overlapping manual scans and limits requests per account.
create or replace function public.claim_email_scan(p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_lease uuid := gen_random_uuid();
begin
  update public.email_connections set scan_lease = v_lease,
    scan_lease_until = now() + interval '120 seconds', last_scan_attempt_at = now()
  where user_id = p_user_id and not reconnect_required
    and (scan_lease_until is null or scan_lease_until < now())
    and (last_scan_attempt_at is null or last_scan_attempt_at < now() - interval '20 seconds');
  if found then return v_lease; end if;
  return null;
end;
$$;
revoke all on function public.claim_email_scan(uuid) from public, anon, authenticated;
grant execute on function public.claim_email_scan(uuid) to service_role;

-- Commit imports and the pagination checkpoint together. Disconnect and imports
-- lock the same connection, so an in flight scan cannot restore deleted mail.
create or replace function public.save_gmail_updates(
  p_user_id uuid, p_lease uuid, p_updates jsonb, p_next_page text, p_query text, p_days integer
)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_connection public.email_connections%rowtype; v_count integer;
begin
  select * into v_connection from public.email_connections where user_id = p_user_id for update;
  if not found or p_lease is null or v_connection.scan_lease is distinct from p_lease
    or v_connection.scan_lease_until is null or v_connection.scan_lease_until < now() then
    raise exception 'Scan expired or mailbox disconnected. Try again.';
  end if;
  insert into public.email_updates(user_id, source, source_key, thread_key, subject, sender,
    received_at, proposed_status, evidence, extracted_company, extracted_role, action_date_text,
    confidence, suggested_application_id)
  select p_user_id, 'gmail', x.source_key, x.thread_key, x.subject, x.sender,
    x.received_at, x.proposed_status::public.application_status, x.evidence,
    x.extracted_company, x.extracted_role, x.action_date_text, x.confidence, x.suggested_application_id
  from jsonb_to_recordset(p_updates) as x(source_key text, thread_key text, subject text,
    sender text, received_at timestamptz, proposed_status text, evidence text,
    extracted_company text, extracted_role text, action_date_text text, confidence text,
    suggested_application_id uuid)
  on conflict (user_id, source, source_key) do nothing;
  get diagnostics v_count = row_count;
  update public.email_connections set scan_page_token = p_next_page, scan_query = p_query,
    scan_days = p_days, last_scanned_at = now(), scan_lease = null, scan_lease_until = null
    where user_id = p_user_id;
  return v_count;
end;
$$;
revoke all on function public.save_gmail_updates(uuid, uuid, jsonb, text, text, integer) from public, anon, authenticated;
grant execute on function public.save_gmail_updates(uuid, uuid, jsonb, text, text, integer) to service_role;

create or replace function public.disconnect_email_scanner(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.email_connections where user_id = p_user_id for update;
  delete from public.email_updates where user_id = p_user_id and source = 'gmail';
  delete from public.email_connections where user_id = p_user_id;
end;
$$;
revoke all on function public.disconnect_email_scanner(uuid) from public, anon, authenticated;
grant execute on function public.disconnect_email_scanner(uuid) to service_role;

-- One transaction locks both records, verifies ownership and the displayed
-- application version, and records the previous status. No XP is awarded by mail.
create or replace function public.confirm_email_update(
  p_update_id uuid, p_application_id uuid, p_expected_status text,
  p_expected_updated_at timestamptz, p_acknowledge_older boolean default false
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_email public.email_updates%rowtype;
  v_app public.applications%rowtype;
begin
  if v_user is null then raise exception 'Sign in first.'; end if;
  if exists(select 1 from auth.mfa_factors where user_id = v_user and status = 'verified')
    and coalesce(auth.jwt()->>'aal', '') <> 'aal2' then
    raise exception 'Complete two factor authentication first.';
  end if;
  select * into v_email from public.email_updates where id = p_update_id and user_id = v_user for update;
  if not found then raise exception 'Suggestion not found.'; end if;
  if v_email.decision <> 'pending' then raise exception 'This suggestion has already been reviewed.'; end if;
  select * into v_app from public.applications where id = p_application_id and user_id = v_user for update;
  if not found then raise exception 'Application not found.'; end if;
  if v_app.status::text is distinct from p_expected_status
    or v_app.updated_at is distinct from p_expected_updated_at then
    raise exception 'The application changed. Refresh before confirming.';
  end if;
  if v_email.received_at < v_app.updated_at and not coalesce(p_acknowledge_older, false) then
    raise exception 'This email predates the current application state. Acknowledge it before confirming.';
  end if;
  update public.applications set status = v_email.proposed_status, updated_at = now()
    where id = v_app.id and user_id = v_user;
  update public.email_updates set decision = 'confirmed', reviewed_at = now(),
    application_id = v_app.id, previous_status = v_app.status
    where id = v_email.id and user_id = v_user;
  return v_app.id;
end;
$$;
revoke all on function public.confirm_email_update(uuid, uuid, text, timestamptz, boolean) from public, anon;
grant execute on function public.confirm_email_update(uuid, uuid, text, timestamptz, boolean) to authenticated;

commit;
