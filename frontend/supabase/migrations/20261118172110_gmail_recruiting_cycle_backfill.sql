begin;
-- Keep existing users' selected recent-mail scope until they choose a cycle.
alter table public.email_connections
 add column scan_mode text not null default 'recent' check(scan_mode in ('recent','cycle','custom')),
 add column scan_start_date date, add column scan_end_date date,
 add column scan_cycle_year integer, add column scan_checked integer not null default 0 check(scan_checked>=0),
 add column scan_completed_at timestamptz;
alter table public.email_connections alter column scan_mode set default 'cycle';
alter table public.email_updates add column recruiting_cycle_year integer check(recruiting_cycle_year between 2000 and 2100);

-- Service-only, lease-bound persistence of a complete page and its search scope.
create function public.save_gmail_cycle_batch(p_user_id uuid,p_lease uuid,p_updates jsonb,p_next_page text,p_query text,p_days integer,
 p_mode text,p_start_date date,p_end_date date,p_cycle_year integer,p_parser_version integer,p_checked integer,p_restart boolean)
returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_mode not in ('recent','cycle','custom') or p_start_date is null or p_end_date is null or p_start_date>p_end_date
 or p_end_date>(now() at time zone 'America/New_York')::date or p_end_date-p_start_date>731
 or p_cycle_year is distinct from (extract(year from p_start_date)::integer - case when extract(month from p_start_date)<7 then 1 else 0 end)
 or p_parser_version is null or p_parser_version<3 or p_checked is null or p_checked not between 0 and 20 or p_restart is null
 then raise exception 'Invalid recruiting cycle scan context.'; end if;
 if exists(select 1 from jsonb_to_recordset(p_updates) as x(received_at timestamptz)
 where (x.received_at at time zone 'America/New_York')::date not between p_start_date and p_end_date) then raise exception 'Email outside requested dates.'; end if;
 n:=public.save_gmail_updates(p_user_id,p_lease,p_updates,p_next_page,p_query,p_days);
 update public.email_updates e set recruiting_cycle_year=case when p_mode='recent' then null else
  extract(year from e.received_at at time zone 'America/New_York')::integer - case when extract(month from e.received_at at time zone 'America/New_York')<7 then 1 else 0 end end
 where e.user_id=p_user_id and e.source='gmail' and e.decision='pending'
 and e.source_key in(select x.source_key from jsonb_to_recordset(p_updates) as x(source_key text));
 update public.email_connections set scan_mode=p_mode,scan_start_date=p_start_date,scan_end_date=p_end_date,
  scan_cycle_year=p_cycle_year,scan_parser_version=p_parser_version,
  scan_checked=case when p_restart then p_checked else scan_checked+p_checked end,
  scan_completed_at=case when p_next_page is null then now() else null end where user_id=p_user_id;
 return n;
end$$;
revoke all on function public.save_gmail_cycle_batch(uuid,uuid,jsonb,text,text,integer,text,date,date,integer,integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.save_gmail_cycle_batch(uuid,uuid,jsonb,text,text,integer,text,date,date,integer,integer,integer,boolean) to service_role;

create function careerup_private.create_email_application(p_update_id uuid,p_company text,p_role text,p_year integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e public.email_updates%rowtype; result uuid;
begin
 if not careerup_private.session_ok() then raise exception 'Sign in and complete two factor authentication first.'; end if;
 if coalesce(length(btrim(p_company)),0) not between 2 and 70 or coalesce(length(btrim(p_role)),0) not between 3 and 160
 or p_year is null or p_year not between 2000 and extract(year from now())::integer+1 then raise exception 'Enter a company, role and valid cycle year.'; end if;
 select * into e from public.email_updates where id=p_update_id and user_id=u and decision='pending' for update;
 if not found then raise exception 'This email has already been reviewed or was not found.'; end if;
 if e.received_at>now()+interval '5 minutes' then raise exception 'Check the email date before creating a card.'; end if;
 -- Serialize manual imports for this account; no duplicate company/role/cycle.
 perform 1 from public.profiles where id=u for update;
 if exists(select 1 from public.applications where user_id=u and application_year=p_year
 and careerup_private.email_identity_key(company,role)=careerup_private.email_identity_key(p_company,p_role))
 then raise exception 'An application already exists for this role and cycle. Choose it to confirm the update.'; end if;
 perform set_config('careerup.email_automation','on',true);
 insert into public.applications(user_id,company,role,status,fit_score,created_at,application_year,email_status_received_at,email_status_applied_at)
 values(u,btrim(p_company),btrim(p_role),e.proposed_status,0,e.received_at,p_year,e.received_at,now()) returning id into result;
 update public.email_updates set decision='confirmed',application_id=result,previous_status=e.proposed_status,reviewed_at=now(),
  extracted_company=btrim(p_company),extracted_role=btrim(p_role),recruiting_cycle_year=p_year,
  automation_note='Created after reviewing company, role and recruiting cycle.',automatically_applied=false where id=e.id;
 perform set_config('careerup.email_automation','off',true);
 return result;
end$$;
revoke all on function careerup_private.create_email_application(uuid,text,text,integer) from public,anon,service_role;
grant execute on function careerup_private.create_email_application(uuid,text,text,integer) to authenticated;
create function public.create_email_application(p_update_id uuid,p_company text,p_role text,p_year integer)
returns uuid language sql security invoker set search_path='' as $$select careerup_private.create_email_application(p_update_id,p_company,p_role,p_year);$$;
revoke all on function public.create_email_application(uuid,text,text,integer) from public,anon,service_role;
grant execute on function public.create_email_application(uuid,text,text,integer) to authenticated;

create or replace function careerup_private.apply_gmail_board_updates()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e public.email_updates%rowtype; a public.applications%rowtype; ids uuid[]; added integer:=0; changed integer:=0; held integer:=0; note text; stamp timestamptz;
begin
 if not careerup_private.session_ok() then raise exception 'Sign in and complete two factor authentication first.'; end if;
 perform 1 from public.email_connections where user_id=u and auto_sync_enabled for update;
 if not found then return jsonb_build_object('added',0,'updated',0,'review',0); end if;
 -- Do not award progress, points or streak credit for imported messages.
 perform set_config('careerup.email_automation','on',true);
 for e in select * from public.email_updates where user_id=u and source='gmail' and decision='pending' and automation_note='' order by received_at,id limit 200 for update loop
  note:=''; a:=null;
  if e.received_at>now()+interval '5 minutes' then note:='Check the email date before applying.';
  elsif e.suggested_application_id is not null and e.confidence='high' then
   select * into a from public.applications where id=e.suggested_application_id and user_id=u for update;
   if not found or (e.recruiting_cycle_year is not null and a.application_year is distinct from e.recruiting_cycle_year) or public.build_role_key(a.company,a.role)<>public.build_role_key(e.extracted_company,e.extracted_role) then note:='The matched application changed. Review it first.'; end if;
  elsif e.identity_complete and length(btrim(e.extracted_company)) between 2 and 70 and length(btrim(e.extracted_role)) between 3 and 160 then
   select array_agg(id) into ids from public.applications where user_id=u and (e.recruiting_cycle_year is null or application_year=e.recruiting_cycle_year) and careerup_private.email_identity_key(company,role)=careerup_private.email_identity_key(e.extracted_company,e.extracted_role);
   if cardinality(ids)>1 then note:='More than one recruiting cycle matches. Choose the application.';
   elsif cardinality(ids)=1 then select * into a from public.applications where id=ids[1] and user_id=u for update;
   else
    insert into public.applications(user_id,company,role,status,fit_score,created_at,email_status_received_at,email_status_applied_at,application_year)
    values(u,e.extracted_company,e.extracted_role,e.proposed_status,0,e.received_at,e.received_at,now(),coalesce(e.recruiting_cycle_year,extract(year from e.received_at)::integer)) returning * into a;
    added:=added+1;
   end if;
  else note:='Company and role are not clear enough for an automatic change.';
  end if;
  if note='' and a.id is not null then
   stamp:=case when a.email_status_applied_at is not null and a.updated_at=a.email_status_applied_at then a.email_status_received_at else a.updated_at end;
   if e.received_at<coalesce(stamp,a.updated_at) then note:='Older than the latest board change. Review it first.';
   elsif a.status in('offer','rejected') and e.proposed_status<>a.status then note:='A final status is already recorded. Review this change.';
   elsif a.status='interviewing' and e.proposed_status='applied' then note:='A receipt would move this application backwards. Review it first.';
   else
    update public.applications set status=e.proposed_status,email_status_received_at=e.received_at,email_status_applied_at=now() where id=a.id and user_id=u;
    update public.email_updates set decision='confirmed',application_id=a.id,previous_status=a.status,reviewed_at=now(),automatically_applied=true,automation_note='Automatically synced to the application board.' where id=e.id and user_id=u;
    if a.status<>e.proposed_status then changed:=changed+1; end if;
   end if;
  end if;
  if note<>'' then
   update public.email_updates set automation_note=note where id=e.id and user_id=u;
   held:=held+1;
  end if;
 end loop;
 perform set_config('careerup.email_automation','off',true);
 return jsonb_build_object('added',added,'updated',changed,'review',held);
end$$;

commit;

