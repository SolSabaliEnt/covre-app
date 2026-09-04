-- Covre continuity slice: booking is the terminal reconciliation event for one shift.
--
-- The existing book_worker_for_shift RPC remains the only booking transaction boundary. This
-- deferred trigger runs at transaction end so it does not interfere with that RPC's internal
-- request/shift updates. Once an accepted/confirmed booking exists, Covre closes competing pending
-- intent while preserving explicit worker invitation acceptance as audit history.

alter table public.provider_shift_invitations
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_reason text;

comment on column public.provider_shift_invitations.resolved_at is
  'When this invitation stopped being an open opportunity because it was booked, declined, withdrawn, or the shift was covered.';

comment on column public.provider_shift_invitations.resolution_reason is
  'System resolution context. Slice 19 writes booked, shift_covered, or shift_covered_elsewhere without overwriting explicit worker acceptance.';

create or replace function public.reconcile_shift_coverage_after_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status not in ('accepted', 'confirmed') then
    return null;
  end if;

  -- Ensure the winning request is terminally accepted. The booking RPC may already have done this;
  -- the update is intentionally idempotent.
  update public.shift_requests
  set status = 'accepted'
  where shift_id = new.shift_id
    and worker_id = new.worker_id
    and status = 'requested';

  -- Once coverage is secured, unresolved competing applications can no longer become bookings.
  update public.shift_requests
  set status = 'declined'
  where shift_id = new.shift_id
    and worker_id <> new.worker_id
    and status = 'requested';

  -- Reconcile invitation intent without fabricating worker consent:
  -- * an already accepted invitation keeps status=accepted;
  -- * pending/viewed invitations are withdrawn because the shift is now covered;
  -- * accepted invitations for other workers are preserved, but marked covered elsewhere.
  update public.provider_shift_invitations
  set
    status = case
      when status in ('pending', 'viewed') then 'withdrawn'
      else status
    end,
    resolved_at = coalesce(resolved_at, now()),
    resolution_reason = case
      when worker_id = new.worker_id and status = 'accepted' then 'booked'
      when worker_id <> new.worker_id and status = 'accepted' then 'shift_covered_elsewhere'
      else 'shift_covered'
    end,
    updated_at = now()
  where shift_id = new.shift_id
    and status in ('pending', 'viewed', 'accepted')
    and (resolved_at is null or resolution_reason is null);

  return null;
end;
$$;

revoke all on function public.reconcile_shift_coverage_after_booking() from public;
revoke all on function public.reconcile_shift_coverage_after_booking() from anon;
revoke all on function public.reconcile_shift_coverage_after_booking() from authenticated;

drop trigger if exists reconcile_shift_coverage_after_booking on public.bookings;

create constraint trigger reconcile_shift_coverage_after_booking
after insert or update of status on public.bookings
deferrable initially deferred
for each row
execute function public.reconcile_shift_coverage_after_booking();
