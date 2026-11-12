begin;
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
  if not careerup_private.session_ok() then raise exception 'Your session expired or needs two factor authentication. Sign in again.'; end if;
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

revoke all on function public.confirm_email_update(uuid,uuid,text,timestamptz,boolean) from public,anon;
grant execute on function public.confirm_email_update(uuid,uuid,text,timestamptz,boolean) to authenticated,service_role;

create or replace function public.send_direct_profile_message(target_recipient_id uuid,message_subject text,message_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare inserted_message_id uuid;
begin
 if not careerup_private.session_ok() then raise exception 'Your session expired or needs two factor authentication. Sign in again.'; end if;
 if target_recipient_id is null or target_recipient_id=auth.uid() then raise exception 'Choose another profile.'; end if;
 if message_subject is null or message_body is null or length(btrim(message_subject)) not between 1 and 300 or length(btrim(message_body)) not between 1 and 10000 then
  raise exception 'Use a subject up to 300 characters and a message up to 10,000 characters.';
 end if;
 if not public.profile_exists_for_message(target_recipient_id) then raise exception 'Profile not found.'; end if;
 insert into public.peer_messages(sender_id,recipient_id,application_id,role_key,subject,body)
 values(auth.uid(),target_recipient_id,null,concat('profile::',target_recipient_id::text),btrim(message_subject),btrim(message_body)) returning id into inserted_message_id;
 return inserted_message_id;
end$$;
revoke all on function public.send_direct_profile_message(uuid,text,text) from public,anon;
grant execute on function public.send_direct_profile_message(uuid,text,text) to authenticated,service_role;
commit;
