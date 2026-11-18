begin;
alter table public.email_updates add column parser_version integer not null default 1 check(parser_version > 0);
alter table public.email_connections add column scan_parser_version integer not null default 1 check(scan_parser_version > 0);

-- A newer parser may improve a pending suggestion. Reviewed decisions are never
-- overwritten, and an unchanged analysis does not clear chronology safeguards.
create or replace function public.save_gmail_updates(p_user_id uuid,p_lease uuid,p_updates jsonb,p_next_page text,p_query text,p_days integer)
returns integer language plpgsql security invoker set search_path='' as $$
declare c public.email_connections%rowtype; n integer;
begin
 select * into c from public.email_connections where user_id=p_user_id for update;
 if not found or p_lease is null or c.scan_lease is distinct from p_lease or c.scan_lease_until is null or c.scan_lease_until<now() then raise exception 'Scan expired or mailbox disconnected. Try again.'; end if;
 insert into public.email_updates as e(user_id,source,source_key,thread_key,subject,sender,received_at,proposed_status,evidence,extracted_company,extracted_role,action_date_text,confidence,suggested_application_id,identity_complete,parser_version)
 select p_user_id,'gmail',x.source_key,x.thread_key,x.subject,x.sender,x.received_at,x.proposed_status::public.application_status,x.evidence,x.extracted_company,x.extracted_role,x.action_date_text,x.confidence,x.suggested_application_id,coalesce(x.identity_complete,false),coalesce(x.parser_version,1)
 from jsonb_to_recordset(p_updates) as x(source_key text,thread_key text,subject text,sender text,received_at timestamptz,proposed_status text,evidence text,extracted_company text,extracted_role text,action_date_text text,confidence text,suggested_application_id uuid,identity_complete boolean,parser_version integer)
 on conflict(user_id,source,source_key) do update set
  proposed_status=excluded.proposed_status,evidence=excluded.evidence,
  extracted_company=excluded.extracted_company,extracted_role=excluded.extracted_role,
  action_date_text=excluded.action_date_text,confidence=excluded.confidence,
  suggested_application_id=excluded.suggested_application_id,identity_complete=excluded.identity_complete,
  parser_version=excluded.parser_version,automation_note=''
 where e.decision='pending' and excluded.parser_version>=e.parser_version and
  (excluded.parser_version>e.parser_version or
   (e.proposed_status,e.extracted_company,e.extracted_role,e.confidence,e.suggested_application_id,e.identity_complete)
   is distinct from (excluded.proposed_status,excluded.extracted_company,excluded.extracted_role,excluded.confidence,excluded.suggested_application_id,excluded.identity_complete));
 get diagnostics n=row_count;
 -- Previously imported outgoing replies are not employer status updates.
 update public.email_updates set decision='dismissed',reviewed_at=now(),parser_version=greatest(parser_version,2),
  automation_note='Outgoing message excluded. Only incoming employer updates change the board.'
 where user_id=p_user_id and source='gmail' and decision='pending' and
  (lower(btrim(sender))=lower(c.email) or lower(substring(sender from '<([^<>]+)>'))=lower(c.email));
 update public.email_connections set scan_page_token=p_next_page,scan_query=p_query,scan_days=p_days,
  scan_parser_version=2,last_scanned_at=now(),scan_lease=null,scan_lease_until=null where user_id=p_user_id;
 return n;
end$$;
revoke all on function public.save_gmail_updates(uuid,uuid,jsonb,text,text,integer) from public,anon,authenticated;
grant execute on function public.save_gmail_updates(uuid,uuid,jsonb,text,text,integer) to service_role;
commit;
