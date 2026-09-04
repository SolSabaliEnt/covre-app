import type { ApiResult } from '../api/types';
import { getBackendMode } from '../lib/backendMode';
import {
  buildWorkerContinuity,
  type WorkerContinuitySummary,
  type WorkerSiteContinuity,
} from '../lib/workerContinuity';
import {
  listCurrentWorkerProviderContinuityFromSupabase,
  listCurrentWorkerSiteContinuityFromSupabase,
  listProviderWorkerContinuityFromSupabase,
  type WorkerProviderContinuityReadModel,
} from '../repositories/continuityRepository';
import { getCurrentProviderOrganizationFromSupabase } from '../repositories/providerOrganizationRepository';
import { listWorkerBookings } from './workerService';

export type WorkerProviderContinuity = {
  providerId: string;
  providerName: string;
  approvedShiftCount: number;
  distinctSiteCount: number;
  firstWorkedLabel?: string;
  lastWorkedLabel?: string;
  isRepeat: boolean;
};

export type ProviderWorkerContinuity = {
  workerId: string;
  approvedShiftCount: number;
  distinctSiteCount: number;
  firstWorkedLabel?: string;
  lastWorkedLabel?: string;
  isRepeat: boolean;
};

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function formatWorkedLabel(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * One worker continuity summary for all worker UI surfaces.
 * Supabase mode is derived only from approved timesheets via worker_site_continuity_v1.
 * Mock mode preserves the preview behavior by deriving from the existing booking fixture.
 */
export async function getWorkerContinuitySummary(): Promise<ApiResult<WorkerContinuitySummary>> {
  if (getBackendMode() !== 'supabase') {
    const bookings = await listWorkerBookings();
    if (!bookings.ok) return bookings;
    return ok(buildWorkerContinuity(bookings.data));
  }

  const siteRows = await listCurrentWorkerSiteContinuityFromSupabase();
  if (!siteRows.ok) return siteRows;

  const sites: Record<string, WorkerSiteContinuity> = {};
  let totalCompletedShifts = 0;

  for (const row of siteRows.data) {
    const site: WorkerSiteContinuity = {
      siteId: row.siteId,
      siteName: row.siteName,
      completedShifts: row.approvedShiftCount,
      firstWorkedLabel: formatWorkedLabel(row.firstWorkedAt),
      lastWorkedLabel: formatWorkedLabel(row.lastWorkedAt),
    };
    sites[row.siteId] = site;
    totalCompletedShifts += row.approvedShiftCount;
  }

  const values = Object.values(sites);
  const mostWorkedSite = values.reduce<WorkerSiteContinuity | undefined>((best, row) => {
    if (!best || row.completedShifts > best.completedShifts) return row;
    return best;
  }, undefined);

  return ok({
    totalCompletedShifts,
    familiarSiteCount: values.length,
    repeatSiteCount: siteRows.data.filter(row => row.isRepeat).length,
    mostWorkedSite,
    sites,
  });
}

export async function listWorkerProviderContinuity(): Promise<
  ApiResult<WorkerProviderContinuity[]>
> {
  if (getBackendMode() !== 'supabase') {
    const bookings = await listWorkerBookings();
    if (!bookings.ok) return bookings;

    const byProvider = new Map<
      string,
      { providerName: string; shiftCount: number; siteIds: Set<string> }
    >();

    for (const card of bookings.data.completed) {
      const shift = card.shift;
      const current = byProvider.get(shift.providerOrgId);
      if (current) {
        current.shiftCount += 1;
        current.siteIds.add(shift.siteId);
      } else {
        byProvider.set(shift.providerOrgId, {
          providerName: shift.providerName,
          shiftCount: 1,
          siteIds: new Set([shift.siteId]),
        });
      }
    }

    return ok(
      [...byProvider.entries()].map(([providerId, row]) => ({
        providerId,
        providerName: row.providerName,
        approvedShiftCount: row.shiftCount,
        distinctSiteCount: row.siteIds.size,
        isRepeat: row.shiftCount >= 2,
      })),
    );
  }

  const rows = await listCurrentWorkerProviderContinuityFromSupabase();
  if (!rows.ok) return rows;
  return ok(rows.data.map(mapWorkerProviderRow));
}

function mapWorkerProviderRow(row: WorkerProviderContinuityReadModel): WorkerProviderContinuity {
  return {
    providerId: row.providerId,
    providerName: row.providerName,
    approvedShiftCount: row.approvedShiftCount,
    distinctSiteCount: row.distinctSiteCount,
    firstWorkedLabel: formatWorkedLabel(row.firstWorkedAt),
    lastWorkedLabel: formatWorkedLabel(row.lastWorkedAt),
    isRepeat: row.isRepeat,
  };
}

export async function listCurrentProviderWorkerContinuity(): Promise<
  ApiResult<ProviderWorkerContinuity[]>
> {
  if (getBackendMode() !== 'supabase') return ok([]);

  const organization = await getCurrentProviderOrganizationFromSupabase();
  if (!organization.ok) return organization;
  if (!organization.data) return ok([]);

  const rows = await listProviderWorkerContinuityFromSupabase(organization.data.providerId);
  if (!rows.ok) return rows;

  return ok(
    rows.data.map(row => ({
      workerId: row.workerId,
      approvedShiftCount: row.approvedShiftCount,
      distinctSiteCount: row.distinctSiteCount,
      firstWorkedLabel: formatWorkedLabel(row.firstWorkedAt),
      lastWorkedLabel: formatWorkedLabel(row.lastWorkedAt),
      isRepeat: row.isRepeat,
    })),
  );
}
