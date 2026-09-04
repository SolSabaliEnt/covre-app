-- Covre continuity slice: worker response to provider shift invitations.
--
-- A worker acceptance does not write a booking directly from the browser. Instead, this guarded
-- transaction validates ownership + shift availability, records the worker's decision, and creates
-- (or reactivates) the canonical shift_request that feeds Covre's existing booking transaction.
-- This keeps provider intent, worker consent, and booking confirmation as distinct audit events.

create or replace function public.respond_to_provider_shift_invitation(
  target_invitation_id uuid,
  target_decision text
)
returns table (
  invitation_id uuid,
  shift_id uuid,
  worker_id uuid,
  invitation_status text,
  request_id uuid,
  booking_ready boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_row public.provider_shift_invitations%rowtype;
  shift_row public.shifts%rowtype;
  resolved_worker_id uuid;
  existing_request public.shift_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if target_decision not in ('accepted', 'declined') then
    raise exception 'invalid_decision';
  end if;

  select wp.id
  into resolved_worker_id
  from public.worker_profiles wp
  where wp.user_id = auth.uid();

  if resolved_worker_id is null then
    raise exception 'worker_profile_required';
  end if;

  select psi.*
  into invitation_row
  from public.provider_shift_invitations psi
  where psi.id = target_invitation_id
    and psi.worker_id = resolved_worker_id
  for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  if invitation_row.status not in ('pending', 'viewed') then
    -- Treat repeated submissions as idempotent only when the same decision was already recorded.
    if invitation_row.status = target_decision then
      select sr.*
      into existing_request
      from public.shift_requests sr
      where sr.shift_id = invitation_row.shift_id
        and sr.worker_id = invitation_row.worker_id
      limit 1;

      return query
      select
        invitation_row.id,
        invitation_row.shift_id,
        invitation_row.worker_id,
        invitation_row.status,
        existing_request.id,
        invitation_row.status = 'accepted' and existing_request.id is not null;
      return;
    end if;

    raise exception 'invitation_already_resolved';
  end if;

  if target_decision = 'declined' then
    update public.provider_shift_invitations
    set status = 'declined', updated_at = now()
    where id = invitation_row.id;

    return query
    select
      invitation_row.id,
      invitation_row.shift_id,
      invitation_row.worker_id,
      'declined'::text,
      null::uuid,
      false;
    return;
  end if;

  select s.*
  into shift_row
  from public.shifts s
  where s.id = invitation_row.shift_id
    and s.provider_id = invitation_row.provider_id
  for update;

  if not found then
    raise exception 'shift_not_found';
  end if;

  if shift_row.status <> 'open' or shift_row.starts_at <= now() then
    raise exception 'shift_not_available';
  end if;

  -- Booking infrastructure snapshots these rates. Do not accept an invitation that cannot advance
  -- into the canonical booking transaction.
  if shift_row.bill_rate_cents is null then
    raise exception 'bill_rate_required';
  end if;

  if shift_row.worker_rate_cents is null then
    raise exception 'worker_rate_required';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.shift_id = shift_row.id
      and b.status in ('requested', 'accepted', 'confirmed')
  ) then
    raise exception 'booking_conflict';
  end if;

  select sr.*
  into existing_request
  from public.shift_requests sr
  where sr.shift_id = invitation_row.shift_id
    and sr.worker_id = invitation_row.worker_id
  limit 1
  for update;

  if existing_request.id is null then
    insert into public.shift_requests (shift_id, worker_id, status)
    values (invitation_row.shift_id, invitation_row.worker_id, 'requested')
    returning * into existing_request;
  elsif existing_request.status in ('withdrawn', 'declined') then
    update public.shift_requests
    set status = 'requested'
    where id = existing_request.id
    returning * into existing_request;
  elsif existing_request.status not in ('requested', 'accepted') then
    raise exception 'request_not_eligible';
  end if;

  update public.provider_shift_invitations
  set status = 'accepted', updated_at = now()
  where id = invitation_row.id;

  return query
  select
    invitation_row.id,
    invitation_row.shift_id,
    invitation_row.worker_id,
    'accepted'::text,
    existing_request.id,
    true;
end;
$$;

revoke all on function public.respond_to_provider_shift_invitation(uuid, text) from public;
revoke all on function public.respond_to_provider_shift_invitation(uuid, text) from anon;
grant execute on function public.respond_to_provider_shift_invitation(uuid, text) to authenticated;

comment on function public.respond_to_provider_shift_invitation(uuid, text) is
  'Worker-owned invitation decision. Accepted invitations create/reactivate a canonical requested shift_request; booking remains on the existing booking transaction boundary.';
