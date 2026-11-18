begin;
-- Used only to detect lookalikes. Never merge distinct requisitions by this key.
create function careerup_private.email_role_base(role text)
returns text language sql immutable set search_path='' as $$
 select btrim(regexp_replace(regexp_replace(coalesce(role,''),',\s*(R-?)?[0-9]{4,}\s*$','','i'),
 '[[:space:]–—-]+(winter|summer|spring|fall)[[:space:]]+20[0-9]{2}[[:space:]]*$','','i'),' -–—,');
$$;
revoke all on function careerup_private.email_role_base(text) from public,anon,authenticated,service_role;

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
   elsif exists(select 1 from public.applications where user_id=u and (e.recruiting_cycle_year is null or application_year=e.recruiting_cycle_year)
    and careerup_private.email_identity_key(company,careerup_private.email_role_base(role))=careerup_private.email_identity_key(e.extracted_company,careerup_private.email_role_base(e.extracted_role)))
   then note:='A similar job title is already tracked. Review the role and requisition before adding another card.';
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

