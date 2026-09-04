import type { ApiResult } from '../api/types';
import { mockRequest } from '../api/mockApi';
import { getBackendMode } from '../lib/backendMode';
import type { WorkerActionResult } from './types';

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Private worker-side continuity signal. This is intentionally not exposed to providers as a
 * mutual-match state until a real persistence model and permissions are deployed.
 */
export async function saveWorkerSiteReturnPreference(
  siteId: string,
): Promise<ApiResult<WorkerActionResult>> {
  const trimmed = siteId.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: { code: 'validation', message: 'A care site is required.' },
    };
  }

  if (getBackendMode() === 'supabase') {
    return {
      ok: false,
      error: {
        code: 'return_preference_not_persisted',
        message: 'Return preferences are not saved to Supabase yet.',
      },
    };
  }

  return mockRequest(() => ({
    id: trimmed,
    status: 'site_return_preference_saved' as const,
    message: 'Saved privately. Covre can use this to remember places you would return to.',
    updatedAt: nowIso(),
  }));
}
