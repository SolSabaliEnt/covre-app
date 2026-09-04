import type { ApiResult } from '../api/types';
import { mockRequest } from '../api/mockApi';
import { getBackendMode } from '../lib/backendMode';
import type { WorkerActionResult } from './types';
import { trackContinuityEvent } from './continuityTelemetryService';

const MOCK_RETURN_PREFERENCE_STORAGE_KEY = 'covre.worker.site-return-preferences.v1';
const memoryFallback = new Set<string>();

function nowIso(): string {
  return new Date().toISOString();
}

function readMockPreferences(): string[] {
  if (typeof window === 'undefined') return [...memoryFallback];

  try {
    const raw = window.localStorage.getItem(MOCK_RETURN_PREFERENCE_STORAGE_KEY);
    if (!raw) return [...memoryFallback];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...memoryFallback];
    return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  } catch {
    return [...memoryFallback];
  }
}

function writeMockPreferences(siteIds: string[]): void {
  memoryFallback.clear();
  for (const siteId of siteIds) memoryFallback.add(siteId);

  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MOCK_RETURN_PREFERENCE_STORAGE_KEY, JSON.stringify(siteIds));
  } catch {
    // Memory fallback still preserves the preference for the current app session.
  }
}

/**
 * Private worker-side continuity signal. This is intentionally not exposed to providers as a
 * mutual-match state until a real persistence model and permissions are deployed.
 */
export async function listWorkerSiteReturnPreferences(): Promise<ApiResult<string[]>> {
  if (getBackendMode() === 'supabase') {
    // No Supabase persistence contract exists yet. Returning an empty list keeps the signal private
    // and prevents the UI from implying that a preference was saved when it was not.
    return { ok: true, data: [] };
  }

  return mockRequest(() => readMockPreferences());
}

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

  return mockRequest(() => {
    const next = new Set(readMockPreferences());
    next.add(trimmed);
    writeMockPreferences([...next]);
    trackContinuityEvent('worker_return_preference_saved', {
      actor: 'worker',
      siteId: trimmed,
      source: 'completed_booking',
    });

    return {
      id: trimmed,
      status: 'site_return_preference_saved' as const,
      message: 'Saved privately. Covre can use this to remember places you would return to.',
      updatedAt: nowIso(),
    };
  });
}
