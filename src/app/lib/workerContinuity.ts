import type { WorkerBookingsPayload } from '../services';

export type WorkerSiteContinuity = {
  siteId: string;
  siteName: string;
  completedShifts: number;
  lastWorkedLabel?: string;
  firstWorkedLabel?: string;
};

export type WorkerContinuitySummary = {
  totalCompletedShifts: number;
  familiarSiteCount: number;
  repeatSiteCount: number;
  mostWorkedSite?: WorkerSiteContinuity;
  sites: Record<string, WorkerSiteContinuity>;
};

function shouldCountInContinuity(statusDisplay: string): boolean {
  const status = statusDisplay.trim().toLowerCase();
  return !(
    status.includes('cancelled') ||
    status === 'no show' ||
    status === 'disputed'
  );
}

/**
 * Continuity is derived from the worker's past booking history, not badges or synthetic
 * achievements. `completed` is ordered newest-first by the booking adapter. Past confirmed
 * bookings are included because the adapter may place an ended booking in this bucket before
 * its booking status is explicitly changed to `completed`; cancellations, no-shows, and disputes
 * are excluded.
 */
export function buildWorkerContinuity(
  bookings?: WorkerBookingsPayload | null,
): WorkerContinuitySummary {
  const sites: Record<string, WorkerSiteContinuity> = {};
  let totalCompletedShifts = 0;

  for (const card of bookings?.completed ?? []) {
    if (!shouldCountInContinuity(card.statusDisplay)) continue;

    const { shift } = card;
    totalCompletedShifts += 1;

    const current = sites[shift.siteId];
    if (!current) {
      sites[shift.siteId] = {
        siteId: shift.siteId,
        siteName: shift.siteName,
        completedShifts: 1,
        lastWorkedLabel: shift.dateLabel,
        firstWorkedLabel: shift.dateLabel,
      };
      continue;
    }

    current.completedShifts += 1;
    current.firstWorkedLabel = shift.dateLabel;
  }

  const siteRows = Object.values(sites);
  const mostWorkedSite = siteRows.reduce<WorkerSiteContinuity | undefined>((best, row) => {
    if (!best || row.completedShifts > best.completedShifts) return row;
    return best;
  }, undefined);

  return {
    totalCompletedShifts,
    familiarSiteCount: siteRows.length,
    repeatSiteCount: siteRows.filter(row => row.completedShifts > 1).length,
    mostWorkedSite,
    sites,
  };
}

export function getSiteContinuity(
  summary: WorkerContinuitySummary,
  siteId: string,
): WorkerSiteContinuity | undefined {
  return summary.sites[siteId];
}
