-- Covre continuity slice: real provider-to-worker shift invitations.
--
-- An invitation is an opportunity to review a specific open shift. It is not a booking, does not
-- imply worker acceptance, and remains separate from the worker's private return preference.

create table public.provider_shift_invitations (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_organizations(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  worker_id uuid not null references public.worker_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'viewed', 'accepted', 'declined', 'withdrawn')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_id, worker_id)
);

comment on table public.provider_shift_invitations is
  'Provider invitation for a specific worker to review a specific shift. Invitation is not a booking or worker acceptance.';

alter table public.provider_shift_invitations enable row level security;

create policy "provider members read shift invitations"
on public.provider_shift_invitations
for select
to authenticated
using (
  exists (
    select 1
    from public.provider_members pm
    where pm.provider_id = provider_shift_invitations.provider_id
      and pm.user_id = auth.uid()
  )
);

create policy "provider schedulers create shift invitations"
on public.provider_shift_invitations
for insert
to authenticated
with check (
  status = 'pending'
  and exists (
    select 1
    from public.provider_members pm
    where pm.provider_id = provider_shift_invitations.provider_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'admin', 'scheduler')
  )
  and exists (
    select 1
    from public.shifts s
    where s.id = provider_shift_invitations.shift_id
      and s.provider_id = provider_shift_invitations.provider_id
      and s.status = 'open'
      and s.starts_at > now()
  )
  and not exists (
    select 1
    from public.provider_worker_relationships pwr
    where pwr.provider_id = provider_shift_invitations.provider_id
      and pwr.worker_id = provider_shift_invitations.worker_id
      and pwr.state = 'do_not_send'
  )
);

create policy "workers read own shift invitations"
on public.provider_shift_invitations
for select
to authenticated
using (
  exists (
    select 1
    from public.worker_profiles wp
    where wp.id = provider_shift_invitations.worker_id
      and wp.user_id = auth.uid()
  )
);

revoke all on table public.provider_shift_invitations from anon;
grant select, insert on table public.provider_shift_invitations to authenticated;
