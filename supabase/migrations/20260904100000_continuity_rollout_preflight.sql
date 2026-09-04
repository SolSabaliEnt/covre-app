-- Covre continuity rollout preflight.
--
-- This migration intentionally sorts before the continuity bundle. It does not create product
-- schema; it verifies that the existing Covre marketplace baseline is present before continuity
-- tables/views/RPCs are layered on top. A failure here is safer than a partially deployed bundle.
--
-- The public repository currently carries the continuity bundle, not the historical baseline
-- migrations that originally created the marketplace schema. Therefore a genuinely empty database
-- is expected to fail this preflight until the Covre baseline schema has been deployed first.

do $$
declare
  missing text[] := array[]::text[];
begin
  -- Base relations required by one or more continuity migrations.
  if to_regclass('public.worker_profiles') is null then
    missing := array_append(missing, 'table public.worker_profiles');
  end if;
  if to_regclass('public.provider_organizations') is null then
    missing := array_append(missing, 'table public.provider_organizations');
  end if;
  if to_regclass('public.provider_members') is null then
    missing := array_append(missing, 'table public.provider_members');
  end if;
  if to_regclass('public.care_sites') is null then
    missing := array_append(missing, 'table public.care_sites');
  end if;
  if to_regclass('public.shifts') is null then
    missing := array_append(missing, 'table public.shifts');
  end if;
  if to_regclass('public.bookings') is null then
    missing := array_append(missing, 'table public.bookings');
  end if;
  if to_regclass('public.shift_requests') is null then
    missing := array_append(missing, 'table public.shift_requests');
  end if;
  if to_regclass('public.timesheets') is null then
    missing := array_append(missing, 'table public.timesheets');
  end if;
  if to_regclass('public.user_roles') is null then
    missing := array_append(missing, 'table public.user_roles');
  end if;

  -- Columns used by foreign keys, RLS predicates, canonical continuity views, invitation response,
  -- booking reconciliation, or the admin readiness diagnostic.
  if to_regclass('public.worker_profiles') is not null then
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'worker_profiles' and column_name = 'id') then
      missing := array_append(missing, 'column worker_profiles.id');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'worker_profiles' and column_name = 'user_id') then
      missing := array_append(missing, 'column worker_profiles.user_id');
    end if;
  end if;

  if to_regclass('public.provider_organizations') is not null then
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'provider_organizations' and column_name = 'id') then
      missing := array_append(missing, 'column provider_organizations.id');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'provider_organizations' and column_name = 'name') then
      missing := array_append(missing, 'column provider_organizations.name');
    end if;
  end if;

  if to_regclass('public.provider_members') is not null then
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'provider_members' and column_name = 'provider_id') then
      missing := array_append(missing, 'column provider_members.provider_id');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'provider_members' and column_name = 'user_id') then
      missing := array_append(missing, 'column provider_members.user_id');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'provider_members' and column_name = 'role') then
      missing := array_append(missing, 'column provider_members.role');
    end if;
  end if;

  if to_regclass('public.care_sites') is not null then
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'care_sites' and column_name = 'id') then
      missing := array_append(missing, 'column care_sites.id');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'care_sites' and column_name = 'name') then
      missing := array_append(missing, 'column care_sites.name');
    end if;
  end if;

  if to_regclass('public.shifts') is not null then
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shifts' and column_name = 'id') then
      missing := array_append(missing, 'column shifts.id');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shifts' and column_name = 'provider_id') then
      missing := array_append(missing, 'column shifts.provider_id');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shifts' and column_name = 'site_id') then
      missing := array_append(missing, 'column shifts.site_id');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shifts' and column_name = 'status') then
      missing := array_append(missing, 'column shifts.status');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shifts' and column_name = 'starts_at') then
      missing := array_append(missing, 'column shifts.starts_at');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shifts' and column_name = 'ends_at') then
      missing := array_append(missing, 'column shifts.ends_at');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shifts' and column_name = 'bill_rate_cents') then
      missing := array_append(missing, 'column shifts.bill_rate_cents');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shifts' and column_name = 'worker_rate_cents') then
      missing := array_append(missing, 'column shifts.worker_rate_cents');
    end if;
  end if;

  if to_regclass('public.bookings') is not null then
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'id') then
      missing := array_append(missing, 'column bookings.id');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'shift_id') then
      missing := array_append(missing, 'column bookings.shift_id');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'worker_id') then
      missing := array_append(missing, 'column bookings.worker_id');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'status') then
      missing := array_append(missing, 'column bookings.status');
    end if;
  end if;

  if to_regclass('public.shift_requests') is not null then
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shift_requests' and column_name = 'id') then
      missing := array_append(missing, 'column shift_requests.id');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shift_requests' and column_name = 'shift_id') then
      missing := array_append(missing, 'column shift_requests.shift_id');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shift_requests' and column_name = 'worker_id') then
      missing := array_append(missing, 'column shift_requests.worker_id');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shift_requests' and column_name = 'status') then
      missing := array_append(missing, 'column shift_requests.status');
    end if;
  end if;

  if to_regclass('public.timesheets') is not null then
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'timesheets' and column_name = 'booking_id') then
      missing := array_append(missing, 'column timesheets.booking_id');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'timesheets' and column_name = 'status') then
      missing := array_append(missing, 'column timesheets.status');
    end if;
  end if;

  if to_regclass('public.user_roles') is not null then
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_roles' and column_name = 'user_id') then
      missing := array_append(missing, 'column user_roles.user_id');
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_roles' and column_name = 'role') then
      missing := array_append(missing, 'column user_roles.role');
    end if;
  end if;

  -- Slice 17 deliberately hands accepted invitations into the existing booking transaction. The
  -- continuity bundle must never deploy into a database where that canonical booking RPC is absent.
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'book_worker_for_shift'
  ) then
    missing := array_append(missing, 'function public.book_worker_for_shift');
  end if;

  if cardinality(missing) > 0 then
    raise exception using
      message = 'Covre continuity rollout preflight failed.',
      detail = 'Missing base capabilities: ' || array_to_string(missing, ', '),
      hint = 'Deploy/verify the Covre marketplace baseline first. Do not bypass this preflight and do not apply these migrations to a different product database.';
  end if;
end
$$;
