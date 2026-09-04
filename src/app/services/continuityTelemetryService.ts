export type ContinuityEventName =
  | 'worker_familiar_opportunity_impression'
  | 'worker_familiar_opportunity_open'
  | 'worker_familiar_shift_detail_view'
  | 'worker_familiar_shift_application'
  | 'worker_return_preference_saved'
  | 'provider_repeat_worker_open'
  | 'provider_return_intent'
  | 'provider_rebook_action';

export type ContinuityEvent = {
  id: string;
  name: ContinuityEventName;
  occurredAt: string;
  actor: 'worker' | 'provider';
  shiftId?: string;
  siteId?: string;
  workerId?: string;
  source?: string;
  completedShiftsHere?: number;
};

export type ContinuityTelemetrySummary = {
  totalEvents: number;
  familiarOpportunityImpressions: number;
  familiarOpportunityOpens: number;
  familiarShiftDetailViews: number;
  familiarShiftApplications: number;
  returnPreferencesSaved: number;
  providerRepeatWorkerOpens: number;
  providerReturnIntents: number;
  providerRebookActions: number;
  familiarOpportunityOpenRatePct: number;
  familiarApplicationRatePct: number;
  lastEventAt?: string;
  storage: 'browser_local_preview';
};

const STORAGE_KEY = 'covre.continuity-telemetry.v1';
const MAX_EVENTS = 500;
const memoryFallback: ContinuityEvent[] = [];

function safeRead(): ContinuityEvent[] {
  if (typeof window === 'undefined') return [...memoryFallback];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...memoryFallback];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...memoryFallback];
    return parsed.filter(
      (event): event is ContinuityEvent =>
        Boolean(event) &&
        typeof event.id === 'string' &&
        typeof event.name === 'string' &&
        typeof event.occurredAt === 'string' &&
        (event.actor === 'worker' || event.actor === 'provider'),
    );
  } catch {
    return [...memoryFallback];
  }
}

function safeWrite(events: ContinuityEvent[]): void {
  const capped = events.slice(-MAX_EVENTS);
  memoryFallback.splice(0, memoryFallback.length, ...capped);

  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // Browser storage can be unavailable; the in-memory fallback keeps instrumentation non-blocking.
  }
}

function eventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `continuity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Product telemetry seam for the continuity experiment. The first pass intentionally stores only
 * non-sensitive identifiers and small numeric context in this browser. It is not yet a platform
 * analytics warehouse and should never be treated as cross-user production reporting.
 */
export function trackContinuityEvent(
  name: ContinuityEventName,
  event: Omit<ContinuityEvent, 'id' | 'name' | 'occurredAt'>,
): void {
  const next: ContinuityEvent = {
    id: eventId(),
    name,
    occurredAt: new Date().toISOString(),
    ...event,
  };
  safeWrite([...safeRead(), next]);
}

export function getContinuityEvents(): ContinuityEvent[] {
  return safeRead();
}

function count(events: ContinuityEvent[], name: ContinuityEventName): number {
  return events.filter(event => event.name === name).length;
}

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function getContinuityTelemetrySummary(): ContinuityTelemetrySummary {
  const events = safeRead();
  const familiarOpportunityImpressions = count(events, 'worker_familiar_opportunity_impression');
  const familiarOpportunityOpens = count(events, 'worker_familiar_opportunity_open');
  const familiarShiftDetailViews = count(events, 'worker_familiar_shift_detail_view');
  const familiarShiftApplications = count(events, 'worker_familiar_shift_application');

  return {
    totalEvents: events.length,
    familiarOpportunityImpressions,
    familiarOpportunityOpens,
    familiarShiftDetailViews,
    familiarShiftApplications,
    returnPreferencesSaved: count(events, 'worker_return_preference_saved'),
    providerRepeatWorkerOpens: count(events, 'provider_repeat_worker_open'),
    providerReturnIntents: count(events, 'provider_return_intent'),
    providerRebookActions: count(events, 'provider_rebook_action'),
    familiarOpportunityOpenRatePct: percent(familiarOpportunityOpens, familiarOpportunityImpressions),
    familiarApplicationRatePct: percent(familiarShiftApplications, familiarShiftDetailViews),
    lastEventAt: events.at(-1)?.occurredAt,
    storage: 'browser_local_preview',
  };
}
