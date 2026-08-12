/** Public entry routes — worker/applicant vs facility/provider. */
export const WORKER_ENTRY_PATH = '/apply';
export const PROVIDER_ENTRY_PATH = '/facillities';
/** Standard spelling alias → requested path. */
export const FACILITIES_ALIAS_PATH = '/facilities';
export const AUTH_COMPAT_PATH = '/auth';
export const ADMIN_ENTRY_PATH = '/auth/admin';

export type EntryRoleHint = 'worker' | 'provider';

export function entryRoleFromPath(pathname: string): EntryRoleHint | null {
  if (pathname === WORKER_ENTRY_PATH) return 'worker';
  if (pathname === PROVIDER_ENTRY_PATH) return 'provider';
  return null;
}

export function isDedicatedEntryPath(pathname: string): boolean {
  return pathname === WORKER_ENTRY_PATH || pathname === PROVIDER_ENTRY_PATH;
}
