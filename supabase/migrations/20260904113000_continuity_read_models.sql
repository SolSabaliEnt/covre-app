-- Covre continuity slice: canonical read models derived only from approved work.
--
-- These views are intentionally descriptive, not evaluative. They do not create trust scores,
-- popularity rankings, or public relationship states. A relationship exists here only when an
-- approved timesheet proves work actually happened.

create or replace view public.worker_site_continuity_v1
with (security_invoker = true)
as
select
  b.worker_id,
  s.site_id,
  s.provider_id,
  cs.name as site_name,
  count(distinct b.id)::integer as approved_shift_count,
  min(s.starts_at) as first_worked_at,
  max(s.starts_at) as last_worked_at,
  (count(distinct b.id) >= 2) as is_repeat
from public.timesheets t
join public.bookings b on b.id = t.booking_id
join public.shifts s on s.id = b.shift_id
join public.care_sites cs on cs.id = s.site_id
where t.status = 'approved'
group by b.worker_id, s.site_id, s.provider_id, cs.name;

comment on view public.worker_site_continuity_v1 is
  'Canonical worker-to-site continuity derived from approved timesheets. Security invoker preserves base-table RLS.';

create or replace view public.worker_provider_continuity_v1
with (security_invoker = true)
as
select
  b.worker_id,
  s.provider_id,
  po.name as provider_name,
  count(distinct b.id)::integer as approved_shift_count,
  count(distinct s.site_id)::integer as distinct_site_count,
  min(s.starts_at) as first_worked_at,
  max(s.starts_at) as last_worked_at,
  (count(distinct b.id) >= 2) as is_repeat
from public.timesheets t
join public.bookings b on b.id = t.booking_id
join public.shifts s on s.id = b.shift_id
join public.provider_organizations po on po.id = s.provider_id
where t.status = 'approved'
group by b.worker_id, s.provider_id, po.name;

comment on view public.worker_provider_continuity_v1 is
  'Canonical worker-to-provider continuity derived from approved timesheets. Security invoker preserves base-table RLS.';

revoke all on public.worker_site_continuity_v1 from anon;
revoke all on public.worker_provider_continuity_v1 from anon;

grant select on public.worker_site_continuity_v1 to authenticated;
grant select on public.worker_provider_continuity_v1 to authenticated;
