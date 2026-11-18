begin;
alter table public.email_connections add column auto_sync_enabled boolean not null default false, add column auto_sync_consented_at timestamptz;
alter table public.email_updates add column identity_complete boolean not null default false, add column automation_note text not null default '', add column automatically_applied boolean not null default false;
alter table public.applications add column email_status_received_at timestamptz, add column email_status_applied_at timestamptz;

-- Preserve existing lease, mailbox lock, cursor and duplicate protections.
create or replace function public.save_gmail_updates(p_user_id uuid,p_lease uuid,p_updates jsonb,p_next_page text,p_query text,p_days integer)
returns integer language plpgsql security invoker set search_path='' as $$
declare c public.email_connections%rowtype; n integer;
begin
 select * into c from public.email_connections where user_id=p_user_id for update;
 if not found or p_lease is null or c.scan_lease is distinct from p_lease or c.scan_lease_until is null or c.scan_lease_until<now() then raise exception 'Scan expired or mailbox disconnected. Try again.'; end if;
 insert into public.email_updates(user_id,source,source_key,thread_key,subject,sender,received_at,proposed_status,evidence,extracted_company,extracted_role,action_date_text,confidence,suggested_application_id,identity_complete)
 select p_user_id,'gmail',x.source_key,x.thread_key,x.subject,x.sender,x.received_at,x.proposed_status::public.application_status,x.evidence,x.extracted_company,x.extracted_role,x.action_date_text,x.confidence,x.suggested_application_id,coalesce(x.identity_complete,false)
 from jsonb_to_recordset(p_updates) as x(source_key text,thread_key text,subject text,sender text,received_at timestamptz,proposed_status text,evidence text,extracted_company text,extracted_role text,action_date_text text,confidence text,suggested_application_id uuid,identity_complete boolean)
 on conflict(user_id,source,source_key) do nothing;
 get diagnostics n=row_count;
 update public.email_connections set scan_page_token=p_next_page,scan_query=p_query,scan_days=p_days,last_scanned_at=now(),scan_lease=null,scan_lease_until=null where user_id=p_user_id;
 return n;
end$$;
revoke all on function public.save_gmail_updates(uuid,uuid,jsonb,text,text,integer) from public,anon,authenticated;
grant execute on function public.save_gmail_updates(uuid,uuid,jsonb,text,text,integer) to service_role;

create function careerup_private.email_identity_key(company text,role text)
returns text language sql immutable set search_path='' as $$
 select public.build_role_key(regexp_replace(company,'\m(inc|llc|ltd|corp|corporation|company|the)\M','','gi'),
 regexp_replace(regexp_replace(regexp_replace(lower(role),'artificial intelligence','ai','g'),'machine learning','ml','g'),'engineering','engineer','g'));
$$;
revoke all on function careerup_private.email_identity_key(text,text) from public,anon,authenticated,service_role;

create function careerup_private.apply_gmail_board_updates()
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
   if not found or public.build_role_key(a.company,a.role)<>public.build_role_key(e.extracted_company,e.extracted_role) then note:='The matched application changed. Review it first.'; end if;
  elsif e.identity_complete and length(btrim(e.extracted_company)) between 2 and 70 and length(btrim(e.extracted_role)) between 3 and 100 then
   select array_agg(id) into ids from public.applications where user_id=u and careerup_private.email_identity_key(company,role)=careerup_private.email_identity_key(e.extracted_company,e.extracted_role);
   if cardinality(ids)>1 then note:='More than one recruiting cycle matches. Choose the application.';
   elsif cardinality(ids)=1 then select * into a from public.applications where id=ids[1] and user_id=u for update;
   else
    insert into public.applications(user_id,company,role,status,fit_score,created_at,email_status_received_at,email_status_applied_at,application_year)
    values(u,e.extracted_company,e.extracted_role,e.proposed_status,0,e.received_at,e.received_at,now(),extract(year from e.received_at)::integer) returning * into a;
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
revoke all on function careerup_private.apply_gmail_board_updates() from public,anon,service_role;
grant execute on function careerup_private.apply_gmail_board_updates() to authenticated;
create function public.apply_gmail_board_updates() returns jsonb language sql security invoker set search_path='' as $$select careerup_private.apply_gmail_board_updates();$$;
revoke all on function public.apply_gmail_board_updates() from public,anon,service_role;
grant execute on function public.apply_gmail_board_updates() to authenticated;

-- Keep the existing reward rules for manual actions; imports are not activity.
create or replace function careerup_private.reward_application_event() returns trigger language plpgsql security definer set search_path='' as $$
declare k text; begin
 if current_setting('careerup.email_automation',true)='on' then return new; end if;
 k:=md5(lower(trim(new.company))||'|'||lower(trim(new.role))||'|'||coalesce(new.application_year,extract(year from new.created_at)::integer)::text);
 perform careerup_private.reward_event(new.user_id,'save:'||k,'save',1,'Saved a distinct career opportunity');
 if new.status::text in('applied','interviewing','offer','rejected') then perform careerup_private.reward_event(new.user_id,'apply:'||k,'apply',4,'Recorded an application'); end if;
 if new.status::text in('interviewing','offer') then perform careerup_private.reward_event(new.user_id,'interview:'||k,'interview',3,'Reached the interview stage'); end if;
 if new.status::text='offer' then perform careerup_private.reward_event(new.user_id,'offer:'||k,'offer',10,'Recorded an offer'); end if;
 return new;
end$$;
commit;
