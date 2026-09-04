# Covre continuity rollout runbook

This runbook covers the continuity bundle added on `feature/admin-continuity-control-center`.

The bundle must be deployed only to the actual **Covre** Supabase project. Do not apply it to another product database. The currently connected ChatGPT Supabase project has previously appeared as **Cleanr APP**, so it is not an approved deployment target for this bundle.

## Goal

Deploy the continuity stack in one deterministic sequence without weakening existing worker/provider RLS or creating a second booking path.

The bundle keeps these domains separate:

- approved work history = factual continuity
- worker return preference = private worker-owned state
- provider bench/do-not-send = private provider-owned state
- invitation = provider intent for one specific shift
- worker acceptance = explicit worker consent
- booking = canonical marketplace transaction
- browser telemetry = preview behavior instrumentation only

## Required baseline before rollout

The continuity bundle is not a replacement for the Covre marketplace baseline. Before applying it, the target database must already contain the production tables and booking transaction it depends on.

Required baseline capabilities include:

- `public.worker_profiles`
- `public.provider_organizations`
- `public.provider_members`
- `public.care_sites`
- `public.shifts`
- `public.bookings`
- `public.shift_requests`
- `public.timesheets`
- `public.user_roles`
- the canonical `public.book_worker_for_shift(...)` booking RPC
- worker/pay-rate columns used by that booking flow

`20260904100000_continuity_rollout_preflight.sql` verifies these prerequisites and intentionally aborts if the target is not a compatible Covre database.

## Deployment order

Apply migrations in timestamp order. Do not cherry-pick individual continuity migrations out of sequence.

1. `20260904100000_continuity_rollout_preflight.sql`
2. `20260904104500_worker_site_return_preferences.sql`
3. `20260904113000_continuity_read_models.sql`
4. `20260904123000_provider_worker_relationships.sql`
5. `20260904131500_provider_shift_invitations.sql`
6. `20260904140000_worker_shift_invitation_responses.sql`
7. `20260904144500_reconcile_coverage_terminal_state.sql`
8. `20260904150000_admin_continuity_readiness.sql`
9. `20260904151500_continuity_rollout_postflight.sql`

### Dependency graph

```text
Covre marketplace baseline
        ↓
rollout preflight
        ↓
worker private return preference
        ↓
approved-work continuity read models
        ↓
provider private relationship state
        ↓
provider shift invitations
        ↓
worker invitation response RPC
        ↓
booking terminal-state reconciliation
        ↓
admin readiness diagnostic
        ↓
rollout postflight
```

The invitation migration depends on `provider_worker_relationships` because `do_not_send` must block new invitations. The worker response transaction depends on `shift_requests` and the existing booking lifecycle. Terminal reconciliation depends on `bookings`, `shift_requests`, and `provider_shift_invitations`.

## Pre-deployment checks

Before running any SQL against production:

1. Confirm the Supabase project name/ref is the actual Covre project.
2. Confirm a current database backup or restore point exists.
3. Confirm the target already has the Covre marketplace baseline and `book_worker_for_shift` RPC.
4. Confirm application deployment can remain on the current code until all migrations complete; continuity UI should not be enabled against a partially deployed database.
5. Do not alter worker/provider RLS to make admin preview work. Admin preview remains read-only and ownership RLS stays intact.

## Apply the bundle

Preferred path: use the normal Supabase migration workflow from a checkout of the exact release commit/branch. Do not paste migrations selectively into the SQL editor unless the normal migration mechanism is unavailable and the operator records exactly what was applied.

The preflight migration should be the first continuity migration executed. If it fails, stop. Its error lists missing baseline capabilities.

If any migration fails after preflight, stop the rollout and investigate the failed migration. Do not skip forward to the postflight migration.

## Postflight verification

`20260904151500_continuity_rollout_postflight.sql` verifies:

- all expected continuity tables/views/RPCs exist
- invitation resolution columns exist
- booking reconciliation trigger exists
- RLS remains enabled on private mutable continuity tables
- canonical continuity views use `security_invoker=true`
- `anon` has no direct `SELECT` access to private continuity tables

If postflight raises an exception, treat the rollout as incomplete even if prior migrations appeared to succeed.

After migrations complete, sign in as a Covre admin and open:

```text
/admin/ops
```

The **Continuity Readiness** panel should report all capabilities as available.

## Functional smoke test

Use real interactive worker/provider routes, not Admin Full App preview, because preview intentionally blocks mutation actions.

Run this sequence with test accounts/data:

```text
Provider: save worker to Bench
Provider: invite that worker to a specific future open shift
Worker: see invitation under Bookings
Worker: accept invitation
Provider: see “Invited · worker accepted” on the shift
Provider: confirm worker and create booking
Provider: verify coverage secured
Worker: verify booking appears
Provider: verify competing pending requests/invitations are closed
After approved timesheet: verify worker/site + worker/provider continuity increments
```

Also verify the negative cases:

- provider cannot invite a `do_not_send` worker
- worker cannot respond to another worker's invitation
- accepting an invite to a closed/started shift fails
- duplicate invite to the same worker/shift fails
- a private worker return preference is not visible to the provider
- an admin preview session does not bypass worker/provider ownership RLS

## Rollback philosophy

Do not use ad-hoc destructive rollback SQL on production continuity data.

If application code must be rolled back while the database changes remain additive, prefer rolling back the application first. The continuity tables/views are designed as additive infrastructure and can remain dormant.

If a database rollback is truly required, write a reviewed forward migration that explicitly handles existing relationship, invitation, and preference rows. Do not `DROP ... CASCADE` in production as an emergency shortcut.

## Release gate

Do not enable Supabase continuity behavior for production users until all of the following are true:

- preflight passed
- every continuity migration applied in order
- postflight passed
- `/admin/ops` reports full Continuity Readiness
- provider → worker invitation smoke test passed
- existing booking flow still passes
- approved timesheet continuity reads return factual counts
- worker private preference remains provider-invisible

## Known separation of concerns

The Admin Continuity Readiness panel checks database capability presence. It does **not** prove product analytics persistence is deployed. Current continuity behavior telemetry remains browser-local preview telemetry and must not be interpreted as production-wide analytics.
