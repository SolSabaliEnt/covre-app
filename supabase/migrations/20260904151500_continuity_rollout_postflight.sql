-- Covre continuity rollout postflight.
--
-- This migration sorts after the continuity bundle and fails the deployment if the expected
-- capabilities/security posture are not present. It is intentionally read-only apart from raising
-- an exception: a postflight check should reveal drift, not silently repair it.

do $$
declare
  missing text[] := array[]::text[];
  insecure text[] := array[]::text[];
begin
  -- Required product capabilities.
  if to_regclass('public.worker_site_return_preferences') is null then
    missing := array_append(missing, 'worker_site_return_preferences');
  end if;
  if to_regclass('public.worker_site_continuity_v1') is null then
    missing := array_append(missing, 'worker_site_continuity_v1');
  end if;
  if to_regclass('public.worker_provider_continuity_v1') is null then
    missing := array_append(missing, 'worker_provider_continuity_v1');
  end if;
  if to_regclass('public.provider_worker_relationships') is null then
    missing := array_append(missing, 'provider_worker_relationships');
  end if;
  if to_regclass('public.provider_shift_invitations') is null then
    missing := array_append(missing, 'provider_shift_invitations');
  end if;
  if to_regprocedure('public.respond_to_provider_shift_invitation(uuid,text)') is null then
    missing := array_append(missing, 'respond_to_provider_shift_invitation(uuid,text)');
  end if;
  if to_regprocedure('public.admin_continuity_readiness()') is null then
    missing := array_append(missing, 'admin_continuity_readiness()');
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_shift_invitations'
      and column_name = 'resolved_at'
  ) then
    missing := array_append(missing, 'provider_shift_invitations.resolved_at');
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_shift_invitations'
      and column_name = 'resolution_reason'
  ) then
    missing := array_append(missing, 'provider_shift_invitations.resolution_reason');
  end if;
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'bookings'
      and t.tgname = 'reconcile_shift_coverage_after_booking'
      and not t.tgisinternal
  ) then
    missing := array_append(missing, 'trigger reconcile_shift_coverage_after_booking');
  end if;

  -- RLS must remain enabled on mutable private-state tables.
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'worker_site_return_preferences'
      and c.relkind = 'r'
      and not c.relrowsecurity
  ) then
    insecure := array_append(insecure, 'RLS disabled on worker_site_return_preferences');
  end if;
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'provider_worker_relationships'
      and c.relkind = 'r'
      and not c.relrowsecurity
  ) then
    insecure := array_append(insecure, 'RLS disabled on provider_worker_relationships');
  end if;
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'provider_shift_invitations'
      and c.relkind = 'r'
      and not c.relrowsecurity
  ) then
    insecure := array_append(insecure, 'RLS disabled on provider_shift_invitations');
  end if;

  -- Canonical continuity views must keep base-table permissions through security_invoker.
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'worker_site_continuity_v1'
      and not (coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true'])
  ) then
    insecure := array_append(insecure, 'worker_site_continuity_v1 is not security_invoker');
  end if;
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'worker_provider_continuity_v1'
      and not (coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true'])
  ) then
    insecure := array_append(insecure, 'worker_provider_continuity_v1 is not security_invoker');
  end if;

  -- Private continuity tables must never be directly granted to anon.
  if has_table_privilege('anon', 'public.worker_site_return_preferences', 'SELECT') then
    insecure := array_append(insecure, 'anon SELECT on worker_site_return_preferences');
  end if;
  if has_table_privilege('anon', 'public.provider_worker_relationships', 'SELECT') then
    insecure := array_append(insecure, 'anon SELECT on provider_worker_relationships');
  end if;
  if has_table_privilege('anon', 'public.provider_shift_invitations', 'SELECT') then
    insecure := array_append(insecure, 'anon SELECT on provider_shift_invitations');
  end if;

  if cardinality(missing) > 0 or cardinality(insecure) > 0 then
    raise exception using
      message = 'Covre continuity rollout postflight failed.',
      detail = concat_ws(
        ' | ',
        case when cardinality(missing) > 0 then 'Missing: ' || array_to_string(missing, ', ') end,
        case when cardinality(insecure) > 0 then 'Security drift: ' || array_to_string(insecure, ', ') end
      ),
      hint = 'Stop rollout. Fix the failed continuity migration or permission drift, then rerun verification before enabling Supabase continuity UI.';
  end if;
end
$$;
