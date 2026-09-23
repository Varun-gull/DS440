select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'applications'
      and column_name = 'role_key'
  ) as has_role_key,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'applications'
      and column_name = 'application_year'
  ) as has_application_year,
  to_regclass('public.peer_messages') is not null as has_peer_messages,
  exists (
    select 1
    from pg_proc
    where proname = 'get_role_peer_summaries'
  ) as has_role_peer_summaries,
  exists (
    select 1
    from pg_proc
    where proname = 'get_role_peer_applicants'
  ) as has_role_peer_applicants,
  exists (
    select 1
    from pg_proc
    where proname = 'get_peer_messages'
  ) as has_peer_messages_rpc;
