# Covre

Frontend for **Covre** — mobile-first care staffing (workers, providers, and admin tooling).

**Public entry routes**

- Care workers / applicants: `/apply`
- Facilities / providers: `/facillities` (alias `/facilities` → `/facillities`)
- Admin: `/auth/admin`
- Legacy combined auth: `/auth`

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Continuity rollout

Before deploying the continuity migrations to Supabase, use [`docs/COVRE_CONTINUITY_ROLLOUT.md`](docs/COVRE_CONTINUITY_ROLLOUT.md). The bundle has explicit preflight/postflight checks and must only be applied to the actual Covre project after the marketplace baseline is present.
