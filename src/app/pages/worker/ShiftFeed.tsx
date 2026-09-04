import { useEffect, useMemo, useState } from 'react';
import { ShiftCard } from '../../components/ShiftCard';
import { WorkerShiftMap } from '../../components/WorkerShiftMap';
import { Link } from 'react-router';
import { Bookmark, Repeat2, Shield, Settings, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  listWorkerBookings,
  listWorkerShiftRequests,
  listWorkerShifts,
  saveShift,
} from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useWorkerAction } from '../../hooks/useWorkerAction';
import { cn } from '../../components/ui/utils';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import { displayWorkerPay } from '../../lib/workerRateCents';
import { WORKER_ENTRY_PATH } from '../../lib/entryRoutes';
import { buildWorkerContinuity, getSiteContinuity } from '../../lib/workerContinuity';

const filters = [
  'Nearby',
  'Highest Pay',
  'Today',
  'Overnight',
  'Previously Worked',
  'Med Pass',
  'Memory Care',
  'Group Home',
  'Assisted Living',
];

type ViewMode = 'list' | 'map';

function LoadingBlock() {
  return (
    <div className="mx-4 rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-4 rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm text-[#607583]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B243A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
      >
        Retry
      </button>
    </div>
  );
}

function EmptyShiftState({ supabaseMode }: { supabaseMode?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 text-center shadow-sm">
      <p className="text-sm text-[#607583]">
        {supabaseMode
          ? 'No eligible shifts are available right now.'
          : 'No open shifts right now. Check back after facilities post coverage.'}
      </p>
      {supabaseMode ? (
        <p className="mt-2 text-xs text-[#9AAAB3]">
          Shifts appear here after worker pay rates and eligibility are ready.
        </p>
      ) : (
        <Link
          to="/worker/onboarding"
          className="mt-4 inline-flex text-sm font-semibold text-[#53B59F] hover:underline"
        >
          Review your profile →
        </Link>
      )}
    </div>
  );
}

export default function ShiftFeed() {
  const supabaseMode = isSupabaseBackendEnabled();
  const { data: shifts, error, loading, reload } = useAsyncResource(() => listWorkerShifts(), []);
  const { data: bookings } = useAsyncResource(() => listWorkerBookings(), []);
  const { data: requests } = useAsyncResource(
    () =>
      supabaseMode
        ? listWorkerShiftRequests()
        : Promise.resolve({ ok: true as const, data: [] }),
    [supabaseMode],
  );

  const continuity = useMemo(() => buildWorkerContinuity(bookings), [bookings]);
  const appliedShiftIds = new Set(
    (requests ?? [])
      .filter(r => r.status === 'requested' || r.status === 'accepted')
      .map(r => r.shiftId),
  );
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedShiftId, setSelectedShiftId] = useState<string | undefined>();
  const [savedByShift, setSavedByShift] = useState<Record<string, boolean>>({});
  const [previouslyWorkedOnly, setPreviouslyWorkedOnly] = useState(false);
  const { run, isPending } = useWorkerAction();

  useEffect(() => {
    setSelectedShiftId(undefined);
  }, [shifts]);

  const familiarOpportunity = useMemo(() => {
    const familiar = (shifts ?? [])
      .map(shift => ({ shift, history: getSiteContinuity(continuity, shift.siteId) }))
      .filter(
        (row): row is { shift: NonNullable<typeof shifts>[number]; history: NonNullable<typeof row.history> } =>
          Boolean(row.history) && (!row.shift.workerShiftReadiness || row.shift.workerShiftReadiness.isReady),
      );

    familiar.sort((a, b) => {
      const historyDifference = b.history.completedShifts - a.history.completedShifts;
      if (historyDifference !== 0) return historyDifference;
      return (a.shift.distanceNumericMiles ?? Number.POSITIVE_INFINITY) -
        (b.shift.distanceNumericMiles ?? Number.POSITIVE_INFINITY);
    });

    return familiar[0];
  }, [shifts, continuity]);

  const visibleShifts = useMemo(() => {
    const filtered = (shifts ?? []).filter(
      shift => !previouslyWorkedOnly || Boolean(getSiteContinuity(continuity, shift.siteId)),
    );

    // Continuity is a discovery signal, not a hard marketplace rule. Promote one strong familiar
    // opportunity to the top while preserving the service-provided order for everything else.
    if (!familiarOpportunity) return filtered;
    const promotedIndex = filtered.findIndex(shift => shift.id === familiarOpportunity.shift.id);
    if (promotedIndex <= 0) return filtered;

    const promoted = filtered[promotedIndex];
    return [promoted, ...filtered.slice(0, promotedIndex), ...filtered.slice(promotedIndex + 1)];
  }, [shifts, previouslyWorkedOnly, continuity, familiarOpportunity]);

  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 text-[#10283D]">
      <div className="border-b border-[#DDE7E8] bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold text-[#13334F]">
            {supabaseMode ? 'Open shifts' : 'Available Shifts'}
          </h1>
          <div className="flex shrink-0 gap-2">
            <Link
              to="/worker/credentials"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8EEF2] transition-colors hover:bg-[#DDE7E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
              aria-label="Credential passport"
            >
              <Shield className="h-5 w-5 text-[#13334F]" />
            </Link>
            <Link
              to="/worker/account"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8EEF2] transition-colors hover:bg-[#DDE7E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
              aria-label="Account settings"
            >
              <Settings className="h-5 w-5 text-[#13334F]" />
            </Link>
          </div>
        </div>

        {continuity.totalCompletedShifts > 0 && (
          <div className="mb-5 rounded-2xl border border-[#DDE7E8] bg-[#F7FAFA] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#607583]">Your Covre</p>
                <p className="mt-1 text-sm text-[#13334F]">
                  {continuity.mostWorkedSite
                    ? `${continuity.mostWorkedSite.siteName} is becoming a familiar place.`
                    : 'Your work history is building here.'}
                </p>
              </div>
              <Link to="/worker/bookings" className="shrink-0 text-xs font-semibold text-[#53B59F] hover:underline">
                History
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <p className="text-xl font-semibold text-[#13334F]">{continuity.totalCompletedShifts}</p>
                <p className="text-xs text-[#607583]">completed</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-[#13334F]">{continuity.familiarSiteCount}</p>
                <p className="text-xs text-[#607583]">places known</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-[#13334F]">{continuity.repeatSiteCount}</p>
                <p className="text-xs text-[#607583]">places returned to</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 flex min-w-0 justify-center px-0 sm:px-1">
          <div
            className="inline-flex w-full max-w-md rounded-full bg-[#E8EEF2] p-1"
            role="tablist"
            aria-label="Shift view mode"
          >
            {(
              [
                { id: 'list' as const, label: 'List' },
                { id: 'map' as const, label: 'Map' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={viewMode === id}
                className={cn(
                  'min-h-11 min-w-0 flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] sm:px-4',
                  viewMode === id ? 'bg-white text-[#13334F] shadow-sm' : 'text-[#607583] hover:text-[#13334F]',
                )}
                onClick={() => setViewMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 sm:-mx-6 sm:px-6">
          {filters.map(filter => {
            const active = filter === 'Previously Worked' && previouslyWorkedOnly;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => {
                  if (filter === 'Previously Worked') setPreviouslyWorkedOnly(value => !value);
                }}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]',
                  active
                    ? 'bg-[#53B59F] text-white'
                    : 'bg-[#E8EEF2] text-[#13334F] hover:bg-[#53B59F] hover:text-white',
                )}
              >
                {filter}
              </button>
            );
          })}
        </div>
      </div>

      {!loading && !error && familiarOpportunity && viewMode === 'list' && !previouslyWorkedOnly && (
        <div className="mx-4 mt-4 overflow-hidden rounded-2xl border border-[#BFDCD5] bg-[#E6F6F2] shadow-sm">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#257665]">
                <Sparkles className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#257665]">
                  Familiar opportunity
                </p>
                <p className="mt-1 text-base font-semibold text-[#13334F]">
                  {familiarOpportunity.shift.siteName} already knows your work.
                </p>
                <p className="mt-1 text-sm leading-5 text-[#607583]">
                  You have completed {familiarOpportunity.history.completedShifts} {familiarOpportunity.history.completedShifts === 1 ? 'shift' : 'shifts'} here. Familiarity is one reason Covre is surfacing this opportunity — alongside pay, readiness, and distance.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-[#BFDCD5] pt-4">
              <div className="min-w-0">
                <p className="font-semibold text-[#13334F]">{displayWorkerPay(familiarOpportunity.shift)}</p>
                <p className="text-xs text-[#607583]">
                  {familiarOpportunity.shift.dateLabel} · {familiarOpportunity.shift.distanceMiles}
                </p>
              </div>
              <Link
                to={`/worker/shift/${familiarOpportunity.shift.id}`}
                className="shrink-0 rounded-xl bg-[#13334F] px-4 py-2.5 text-sm font-semibold text-white no-underline hover:bg-[#0B243A]"
              >
                View shift
              </Link>
            </div>
          </div>
        </div>
      )}

      {supabaseMode && (
        <p className="mx-4 mt-4 text-xs text-[#9AAAB3]">
          Real open shifts from Covre. Apply from shift detail; save and calendar stay simulated.
        </p>
      )}

      {loading && <LoadingBlock />}
      {error && (
        <div className="py-4">
          <ErrorBlock message={error.message} onRetry={reload} />
          {supabaseMode && (
            <Link
              to={WORKER_ENTRY_PATH}
              className="mx-4 mt-3 block text-center text-sm font-semibold text-[#53B59F] hover:underline"
            >
              Sign in at /apply
            </Link>
          )}
        </div>
      )}

      {!loading && !error && shifts && visibleShifts.length === 0 && (
        <div className="mx-4 mt-4">
          {viewMode === 'map' ? (
            <WorkerShiftMap
              shifts={[]}
              selectedShiftId={selectedShiftId}
              onSelectShift={id => setSelectedShiftId(id)}
            />
          ) : previouslyWorkedOnly ? (
            <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 text-center shadow-sm">
              <p className="text-sm font-medium text-[#13334F]">No open shifts at familiar places right now.</p>
              <p className="mt-2 text-xs text-[#607583]">Your history stays here when those sites post again.</p>
              <button
                type="button"
                onClick={() => setPreviouslyWorkedOnly(false)}
                className="mt-4 text-sm font-semibold text-[#53B59F] hover:underline"
              >
                Show all shifts
              </button>
            </div>
          ) : supabaseMode ? (
            <EmptyShiftState supabaseMode={supabaseMode} />
          ) : (
            <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-[#607583]">No shifts available.</p>
            </div>
          )}
        </div>
      )}

      {!loading && !error && shifts && visibleShifts.length > 0 && (
        <div className="py-4">
          {viewMode === 'list' ? (
            <div className="space-y-4">
              {visibleShifts.map(shift => {
                const siteHistory = getSiteContinuity(continuity, shift.siteId);
                const isRegularPlace = (siteHistory?.completedShifts ?? 0) >= 5;
                return (
                  <div key={shift.id} className="min-w-0 max-w-full">
                    <ShiftCard
                      title={shift.roleTitle}
                      facility={shift.siteName || shift.facilitySettingLabel}
                      setting={shift.facilitySettingLabel}
                      dateTime={`${shift.dateLabel} • ${shift.timeRange}`}
                      pay={displayWorkerPay(shift)}
                      paySubtext={`Est. ${shift.estimatedTotalDisplay}`}
                      distance={shift.distanceMiles}
                      duration="8 hrs"
                      badges={shift.credentialTags}
                      status={
                        shift.workerShiftReadiness
                          ? {
                              variant: shift.workerShiftReadiness.isReady ? 'covered' : 'pending',
                              label: shift.workerShiftReadiness.isReady
                                ? 'Ready'
                                : 'Needs credentials',
                            }
                          : shift.workerFeedCardStatus === 'preferred'
                            ? { variant: 'preferred', label: 'Preferred' }
                            : { variant: 'covered', label: 'Ready Match' }
                      }
                      to={`/worker/shift/${shift.id}`}
                    >
                      {siteHistory && (
                        <div className="mt-3 border-t border-[#DDE7E8] pt-3 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F6F2] px-2.5 py-1 font-semibold text-[#257665]">
                              <Repeat2 className="h-3.5 w-3.5" aria-hidden />
                              {isRegularPlace ? 'One of your regular places' : 'Familiar place'}
                            </span>
                            <span className="font-semibold text-[#257665]">
                              Worked here {siteHistory.completedShifts}×
                            </span>
                          </div>
                          {siteHistory.lastWorkedLabel && (
                            <p className="mt-2 text-[#607583]">Last here: {siteHistory.lastWorkedLabel}</p>
                          )}
                        </div>
                      )}
                    </ShiftCard>
                    {shift.workerShiftReadiness && (
                      <p className="mt-1 px-0.5 text-xs text-[#607583]">
                        {shift.workerShiftReadiness.statusLabel}
                      </p>
                    )}
                    {supabaseMode && appliedShiftIds.has(shift.id) && (
                      <p className="mt-1 px-0.5 text-xs font-medium text-[#53B59F]">Applied</p>
                    )}
                    <div className="mt-2 flex justify-end px-0.5">
                      <button
                        type="button"
                        disabled={savedByShift[shift.id] || isPending(`save-${shift.id}`)}
                        onClick={async e => {
                          e.preventDefault();
                          e.stopPropagation();
                          const r = await run(`save-${shift.id}`, () => saveShift(shift.id));
                          if (r.ok) {
                            toast.success(r.data.message);
                            setSavedByShift(prev => ({ ...prev, [shift.id]: true }));
                          } else toast.error(r.error.message);
                        }}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#DDE7E8] bg-white px-3 py-2 text-xs font-semibold text-[#13334F] shadow-sm transition-colors hover:border-[#53B59F]/50 hover:bg-[#F7FAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Bookmark className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {savedByShift[shift.id] ? 'Saved' : 'Save'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <WorkerShiftMap
              shifts={visibleShifts}
              selectedShiftId={selectedShiftId}
              onSelectShift={id => setSelectedShiftId(id)}
            />
          )}
        </div>
      )}
    </div>
  );
}
