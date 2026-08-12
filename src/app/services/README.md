# Covre frontend services

## Purpose

`src/app/services/` is the **API boundary** for React pages and layouts.

- **Pages should prefer** importing from `../services` (or `../../services`) **instead of** importing `mockData` / raw selectors directly.
- **Current behavior:** service functions are thin wrappers that read synchronously from `src/app/data` (mock store + selectors).
- **Future backend:** replace service **internals** with `fetch`/`axios` calls and DTO mapping. Pages that already use services should need little or no change.

## Modules

| Module | Audience |
|--------|----------|
| `workerService.ts` | Worker app (shifts, reputation, safety submit, etc.) |
| `providerService.ts` | Provider app (dashboard, sites, compliance, support) |
| `adminService.ts` | Admin console |
| `types.ts` | Small request/payload types used by services |

## Mock data

Low-level typed data remains in `src/app/data/`. Services compose that data for screens; they do not duplicate business rules in pages.
