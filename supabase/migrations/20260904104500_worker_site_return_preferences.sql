-- Covre continuity slice: private worker return preference by care site.
-- This signal belongs to the worker. Providers do not receive read access in this migration.

create table public.worker_site_return_preferences (
  worker_id uuid not null references public.worker_profiles(id) on delete cascade,
  site_id uuid not null references public.care_sites(id) on delete cascade,
  willing_to_return boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (worker_id, site_id)
);

comment on table public.worker_site_return_preferences is
  'Private worker-owned continuity preferences indicating care sites the worker would work at again.';

comment on column public.worker_site_return_preferences.willing_to_return is
  'Private worker preference. Do not expose to providers as a public rating or mutual-match signal.';

alter table public.worker_site_return_preferences enable row level security;

create policy "workers read own return preferences"
on public.worker_site_return_preferences
for select
to authenticated
using (
  exists (
    select 1
    from public.worker_profiles wp
    where wp.id = worker_site_return_preferences.worker_id
      and wp.user_id = auth.uid()
  )
);

create policy "workers create own return preferences"
on public.worker_site_return_preferences
for insert
to authenticated
with check (
  exists (
    select 1
    from public.worker_profiles wp
    where wp.id = worker_site_return_preferences.worker_id
      and wp.user_id = auth.uid()
  )
);

create policy "workers update own return preferences"
on public.worker_site_return_preferences
for update
to authenticated
using (
  exists (
    select 1
    from public.worker_profiles wp
    where wp.id = worker_site_return_preferences.worker_id
      and wp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.worker_profiles wp
    where wp.id = worker_site_return_preferences.worker_id
      and wp.user_id = auth.uid()
  )
);

create policy "workers delete own return preferences"
on public.worker_site_return_preferences
for delete
to authenticated
using (
  exists (
    select 1
    from public.worker_profiles wp
    where wp.id = worker_site_return_preferences.worker_id
      and wp.user_id = auth.uid()
  )
);

revoke all on table public.worker_site_return_preferences from anon;
grant select, insert, update, delete on table public.worker_site_return_preferences to authenticated;
