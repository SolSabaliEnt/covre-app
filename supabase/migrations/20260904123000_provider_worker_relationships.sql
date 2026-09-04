-- Covre continuity slice: provider-owned relationship state.
--
-- This table is deliberately separate from worker_site_return_preferences. A provider can privately
-- keep a worker on its bench or mark the worker do-not-send; neither state implies mutual preference
-- and neither exposes the worker's private willingness-to-return signal.

create table public.provider_worker_relationships (
  provider_id uuid not null references public.provider_organizations(id) on delete cascade,
  worker_id uuid not null references public.worker_profiles(id) on delete cascade,
  state text not null check (state in ('bench', 'do_not_send')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider_id, worker_id)
);

comment on table public.provider_worker_relationships is
  'Private provider-owned worker relationship state. Does not imply worker preference or mutual matching.';

comment on column public.provider_worker_relationships.state is
  'Provider-private state: bench or do_not_send. Worker return preference remains a separate private signal.';

alter table public.provider_worker_relationships enable row level security;

create policy "provider members read worker relationships"
on public.provider_worker_relationships
for select
to authenticated
using (
  exists (
    select 1
    from public.provider_members pm
    where pm.provider_id = provider_worker_relationships.provider_id
      and pm.user_id = auth.uid()
  )
);

create policy "provider schedulers create worker relationships"
on public.provider_worker_relationships
for insert
to authenticated
with check (
  exists (
    select 1
    from public.provider_members pm
    where pm.provider_id = provider_worker_relationships.provider_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'admin', 'scheduler')
  )
);

create policy "provider schedulers update worker relationships"
on public.provider_worker_relationships
for update
to authenticated
using (
  exists (
    select 1
    from public.provider_members pm
    where pm.provider_id = provider_worker_relationships.provider_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'admin', 'scheduler')
  )
)
with check (
  exists (
    select 1
    from public.provider_members pm
    where pm.provider_id = provider_worker_relationships.provider_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'admin', 'scheduler')
  )
);

create policy "provider schedulers delete worker relationships"
on public.provider_worker_relationships
for delete
to authenticated
using (
  exists (
    select 1
    from public.provider_members pm
    where pm.provider_id = provider_worker_relationships.provider_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'admin', 'scheduler')
  )
);

revoke all on table public.provider_worker_relationships from anon;
grant select, insert, update, delete on table public.provider_worker_relationships to authenticated;
