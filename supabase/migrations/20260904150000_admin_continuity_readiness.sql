-- Covre continuity slice: admin-visible infrastructure readiness.
--
-- This diagnostic reports capabilities, not migration-history rows. That keeps the result useful
-- whether a capability was applied by Supabase migrations or an equivalent controlled deployment.
-- The function is security-definer only so it can inspect PostgreSQL catalogs; it explicitly gates
-- access to Covre admin-console roles and never returns worker/provider data.

create or replace function public.admin_continuity_readiness()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_catalog
as $$
declare
  caller_is_admin boolean;
  invitation_resolution_columns_ready boolean;
  coverage_trigger_ready boolean;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'ops', 'support', 'finance', 'compliance')
  )
  into caller_is_admin;

  if not caller_is_admin then
    raise exception 'admin_access_required';
  end if;

  select
    exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'provider_shift_invitations'
        and c.column_name = 'resolved_at'
    )
    and exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'provider_shift_invitations'
        and c.column_name = 'resolution_reason'
    )
  into invitation_resolution_columns_ready;

  select exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'bookings'
      and t.tgname = 'reconcile_shift_coverage_after_booking'
      and not t.tgisinternal
  )
  into coverage_trigger_ready;

  return jsonb_build_object(
    'checkedAt', now(),
    'readyCount', (
      select count(*)
      from (
        values
          (to_regclass('public.worker_site_return_preferences') is not null),
          (to_regclass('public.worker_site_continuity_v1') is not null),
          (to_regclass('public.worker_provider_continuity_v1') is not null),
          (to_regclass('public.provider_worker_relationships') is not null),
          (to_regclass('public.provider_shift_invitations') is not null),
          (to_regprocedure('public.respond_to_provider_shift_invitation(uuid,text)') is not null),
          (invitation_resolution_columns_ready and coverage_trigger_ready)
      ) as checks(is_ready)
      where is_ready
    ),
    'totalCount', 7,
    'items', jsonb_build_array(
      jsonb_build_object(
        'key', 'worker_return_preferences',
        'label', 'Private worker return preferences',
        'kind', 'table',
        'migration', '20260904104500_worker_site_return_preferences.sql',
        'ready', to_regclass('public.worker_site_return_preferences') is not null
      ),
      jsonb_build_object(
        'key', 'worker_site_continuity',
        'label', 'Worker ↔ site continuity read model',
        'kind', 'view',
        'migration', '20260904113000_continuity_read_models.sql',
        'ready', to_regclass('public.worker_site_continuity_v1') is not null
      ),
      jsonb_build_object(
        'key', 'worker_provider_continuity',
        'label', 'Worker ↔ provider continuity read model',
        'kind', 'view',
        'migration', '20260904113000_continuity_read_models.sql',
        'ready', to_regclass('public.worker_provider_continuity_v1') is not null
      ),
      jsonb_build_object(
        'key', 'provider_worker_relationships',
        'label', 'Provider-owned relationship state',
        'kind', 'table',
        'migration', '20260904123000_provider_worker_relationships.sql',
        'ready', to_regclass('public.provider_worker_relationships') is not null
      ),
      jsonb_build_object(
        'key', 'provider_shift_invitations',
        'label', 'Provider shift invitations',
        'kind', 'table',
        'migration', '20260904131500_provider_shift_invitations.sql',
        'ready', to_regclass('public.provider_shift_invitations') is not null
      ),
      jsonb_build_object(
        'key', 'worker_invitation_response',
        'label', 'Worker invitation response transaction',
        'kind', 'rpc',
        'migration', '20260904140000_worker_shift_invitation_responses.sql',
        'ready', to_regprocedure('public.respond_to_provider_shift_invitation(uuid,text)') is not null
      ),
      jsonb_build_object(
        'key', 'coverage_reconciliation',
        'label', 'Coverage terminal-state reconciliation',
        'kind', 'trigger',
        'migration', '20260904144500_reconcile_coverage_terminal_state.sql',
        'ready', invitation_resolution_columns_ready and coverage_trigger_ready
      )
    )
  );
end;
$$;

revoke all on function public.admin_continuity_readiness() from public;
revoke all on function public.admin_continuity_readiness() from anon;
grant execute on function public.admin_continuity_readiness() to authenticated;

comment on function public.admin_continuity_readiness() is
  'Admin-only Covre continuity infrastructure diagnostic. Returns capability presence only; no worker/provider records.';
