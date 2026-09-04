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

export type WorkerContinuityRecognition = {
  eyebrow: string;
  headline: string;
  detail: string;
  primaryValue: number;
  primaryLabel: string;
  secondaryValue?: number;
  secondaryLabel?: string;
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

/**
 * Quiet recognition of accumulated work. This deliberately avoids points, streaks, levels, and
 * invented praise. Copy changes only when the underlying work history supports it.
 */
export function buildWorkerContinuityRecognition(
  summary: WorkerContinuitySummary,
): WorkerContinuityRecognition | undefined {
  if (summary.totalCompletedShifts === 0) return undefined;

  const strongest = summary.mostWorkedSite;

  if (strongest && strongest.completedShifts >= 5) {
    return {
      eyebrow: 'Your work is adding up',
      headline: `${strongest.siteName} has become one of your regular places.`,
      detail: `You have completed ${strongest.completedShifts} shifts there. Covre keeps that familiarity visible instead of resetting you to zero each time.`,
      primaryValue: summary.totalCompletedShifts,
      primaryLabel: 'completed shifts',
      secondaryValue: summary.repeatSiteCount,
      secondaryLabel: 'places returned to',
    };
  }

  if (summary.repeatSiteCount > 0) {
    return {
      eyebrow: 'Your work is adding up',
      headline: 'You are building places you know.',
      detail: `You have returned to ${summary.repeatSiteCount} ${summary.repeatSiteCount === 1 ? 'care site' : 'care sites'}. That repeat history stays attached to your Covre experience.`,
      primaryValue: summary.totalCompletedShifts,
      primaryLabel: 'completed shifts',
      secondaryValue: summary.repeatSiteCount,
      secondaryLabel: 'places returned to',
    };
  }

  return {
    eyebrow: 'Your Covre history',
    headline: 'Your work history has started here.',
    detail: `You have ${summary.totalCompletedShifts} completed ${summary.totalCompletedShifts === 1 ? 'shift' : 'shifts'} on Covre. As you return to places, that familiarity will stay visible.`,
    primaryValue: summary.totalCompletedShifts,
    primaryLabel: 'completed shifts',
    secondaryValue: summary.familiarSiteCount,
    secondaryLabel: summary.familiarSiteCount === 1 ? 'place known' : 'places known',
  };
}

export function getSiteContinuity(
  summary: WorkerContinuitySummary,
  siteId: string,
): WorkerSiteContinuity | undefined {
  return summary.sites[siteId];
}
