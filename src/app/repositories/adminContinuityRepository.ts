import type { ApiResult } from '../api/types';
import { getCurrentAdminRoleFromSupabase } from '../auth/supabaseAdminAuth';
import { getSupabaseClient } from '../lib/supabaseClient';

export type AdminContinuitySummary = {
  approvedWorkEvents: number;
  workersWithHistory: number;
  repeatSiteWorkers: number;
  familiarWorkerSiteTies: number;
  repeatProviderWorkerTies: number;
  returningWorkSharePct: number;
  sampled: boolean;
};

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } };
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function friendlyDbMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback;
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return 'Continuity metrics are blocked by database permissions (RLS). Admin read policies must allow approved timesheet, booking, and shift history.';
  }
  return raw;
}

type ApprovedTimesheetRow = {
  id: string;
  bookings:
    | {
        worker_id: string | null;
        shifts:
          | {
              site_id: string | null;
              provider_id: string | null;
            }
          | Array<{
              site_id: string | null;
              provider_id: string | null;
            }>
          | null;
      }
    | Array<{
        worker_id: string | null;
        shifts:
          | {
              site_id: string | null;
              provider_id: string | null;
            }
          | Array<{
              site_id: string | null;
              provider_id: string | null;
            }>
          | null;
      }>
    | null;
};

function unwrap<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

const CONTINUITY_SAMPLE_LIMIT = 5000;

/**
 * Read-only continuity telemetry derived from approved work history.
 *
 * Covre does not create synthetic "community" scores here. A durable tie exists only when
 * approved work proves that the same worker returned to the same site or provider.
 */
export async function getAdminContinuitySummaryFromSupabase(): Promise<
  ApiResult<AdminContinuitySummary>
> {
  try {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return fail('not_authenticated', 'Sign in at /auth/admin before loading continuity metrics.');
    }

    const roleResult = await getCurrentAdminRoleFromSupabase();
    if (!roleResult.ok) return roleResult;
    if (!roleResult.data.isAdmin) {
      return fail('forbidden', roleResult.data.message ?? 'This account does not have admin access.');
    }

    const { data, error } = await supabase
      .from('timesheets')
      .select('id, bookings!inner(worker_id, shifts!inner(site_id, provider_id))')
      .eq('status', 'approved')
      .limit(CONTINUITY_SAMPLE_LIMIT);

    if (error) {
      return fail(
        'continuity_history',
        friendlyDbMessage(error, 'Unable to load approved work history for continuity metrics.'),
      );
    }

    const rows = (data ?? []) as unknown as ApprovedTimesheetRow[];
    const workerIds = new Set<string>();
    const workerSiteCounts = new Map<string, number>();
    const workerProviderCounts = new Map<string, number>();
    const workersWithRepeatSite = new Set<string>();

    for (const row of rows) {
      const booking = unwrap(row.bookings);
      if (!booking?.worker_id) continue;
      const shift = unwrap(booking.shifts);
      if (!shift) continue;

      workerIds.add(booking.worker_id);
      if (shift.site_id) {
        increment(workerSiteCounts, `${booking.worker_id}::${shift.site_id}`);
      }
      if (shift.provider_id) {
        increment(workerProviderCounts, `${booking.worker_id}::${shift.provider_id}`);
      }
    }

    let familiarWorkerSiteTies = 0;
    let repeatSiteWorkEvents = 0;
    for (const [key, count] of workerSiteCounts) {
      if (count < 2) continue;
      familiarWorkerSiteTies += 1;
      repeatSiteWorkEvents += count - 1;
      const workerId = key.split('::', 1)[0];
      if (workerId) workersWithRepeatSite.add(workerId);
    }

    const repeatProviderWorkerTies = [...workerProviderCounts.values()].filter(count => count >= 2).length;
    const approvedWorkEvents = rows.length;
    const returningWorkSharePct =
      approvedWorkEvents > 0 ? Math.round((repeatSiteWorkEvents / approvedWorkEvents) * 100) : 0;

    return ok({
      approvedWorkEvents,
      workersWithHistory: workerIds.size,
      repeatSiteWorkers: workersWithRepeatSite.size,
      familiarWorkerSiteTies,
      repeatProviderWorkerTies,
      returningWorkSharePct,
      sampled: rows.length >= CONTINUITY_SAMPLE_LIMIT,
    });
  } catch (error) {
    return fail('unexpected', error instanceof Error ? error.message : 'Request failed.');
  }
}
