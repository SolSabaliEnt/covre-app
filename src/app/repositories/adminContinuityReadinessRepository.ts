import type { ApiResult } from '../api/types';
import { getSupabaseClient } from '../lib/supabaseClient';

export type AdminContinuityReadinessItem = {
  key: string;
  label: string;
  kind: 'table' | 'view' | 'rpc' | 'trigger' | string;
  migration: string;
  ready: boolean;
};

export type AdminContinuityReadiness = {
  checkedAt: string;
  readyCount: number;
  totalCount: number;
  items: AdminContinuityReadinessItem[];
  diagnosticAvailable: boolean;
};

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } };
}

function friendlyMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback;
  const token = raw.trim().toLowerCase();

  if (/admin_continuity_readiness|function .* does not exist/i.test(raw)) {
    return 'Continuity readiness diagnostic is not deployed yet. Apply 20260904150000_admin_continuity_readiness.sql.';
  }
  if (token === 'admin_access_required' || /admin_access_required/i.test(raw)) {
    return 'Admin access is required to inspect continuity infrastructure.';
  }
  if (token === 'not_authenticated' || /not_authenticated/i.test(raw)) {
    return 'Sign in as an admin before inspecting continuity infrastructure.';
  }
  return raw;
}

export async function getAdminContinuityReadinessFromSupabase(): Promise<
  ApiResult<AdminContinuityReadiness>
> {
  try {
    const { data, error } = await getSupabaseClient().rpc('admin_continuity_readiness');

    if (error) {
      return fail(
        'continuity_readiness_load',
        friendlyMessage(error, 'Unable to inspect continuity infrastructure.'),
      );
    }

    const raw = (data ?? {}) as Record<string, unknown>;
    const rawItems = Array.isArray(raw.items) ? raw.items : [];

    return ok({
      checkedAt: typeof raw.checkedAt === 'string' ? raw.checkedAt : new Date().toISOString(),
      readyCount: typeof raw.readyCount === 'number' ? raw.readyCount : 0,
      totalCount: typeof raw.totalCount === 'number' ? raw.totalCount : rawItems.length,
      items: rawItems.map(item => {
        const row = (item ?? {}) as Record<string, unknown>;
        return {
          key: typeof row.key === 'string' ? row.key : 'unknown',
          label: typeof row.label === 'string' ? row.label : 'Continuity capability',
          kind: typeof row.kind === 'string' ? row.kind : 'capability',
          migration: typeof row.migration === 'string' ? row.migration : '—',
          ready: row.ready === true,
        };
      }),
      diagnosticAvailable: true,
    });
  } catch (error) {
    return fail(
      'continuity_readiness_unexpected',
      error instanceof Error ? error.message : 'Unable to inspect continuity infrastructure.',
    );
  }
}
