import { useEffect, useState } from 'react';
import { ShiftCard } from '../../components/ShiftCard';
import { WorkerShiftMap } from '../../components/WorkerShiftMap';
import { Link } from 'react-router';
import { Bookmark, Shield, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { listWorkerShiftRequests, listWorkerShifts, saveShift } from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useWorkerAction } from '../../hooks/useWorkerAction';
import { cn } from '../../components/ui/utils';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import { displayWorkerPay } from '../../lib/workerRateCents';
import { WORKER_ENTRY_PATH } from '../../lib/entryRoutes';

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
  const { data: requests } = useAsyncResource(
    () =>
      supabaseMode
        ? listWorkerShiftRequests()
        : Promise.resolve({ ok: true as const, data: [] }),
    [supabaseMode],
  );
  const appliedShiftIds = new Set(
    (requests ?? [])
      .filter(r => r.status === 'requested' || r.status === 'accepted')
      .map(r => r.shiftId),
  );
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedShiftId, setSelectedShiftId] = useState<string | undefined>();
  const [savedByShift, setSavedByShift] = useState<Record<string, boolean>>({});
  const { run, isPending } = useWorkerAction();

  useEffect(() => {
    setSelectedShiftId(undefined);
  }, [shifts]);

  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 text-[#10283D]">
      {/* Header */}
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

        {/* List | Map */}
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

        {/* Filter Chips */}
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 sm:-mx-6 sm:px-6">
          {filters.map(filter => (
            <button
              key={filter}
              type="button"
              className="shrink-0 whitespace-nowrap rounded-full bg-[#E8EEF2] px-4 py-2 text-sm font-medium text-[#13334F] transition-colors hover:bg-[#53B59F] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

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

      {!loading && !error && shifts && shifts.length === 0 && (
        <div className="mx-4 mt-4">
          {viewMode === 'map' ? (
            <WorkerShiftMap
              shifts={[]}
              selectedShiftId={selectedShiftId}
              onSelectShift={id => setSelectedShiftId(id)}
            />
          ) : supabaseMode ? (
            <EmptyShiftState supabaseMode={supabaseMode} />
          ) : (
            <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-[#607583]">No shifts available.</p>
            </div>
          )}
        </div>
      )}

      {!loading && !error && shifts && shifts.length > 0 && (
        <div className="py-4">
          {viewMode === 'list' ? (
            <div className="space-y-4">
              {shifts.map(shift => (
                <div key={shift.id} className="min-w-0 max-w-full">
                  <ShiftCard
                    title={shift.roleTitle}
                    facility={shift.facilitySettingLabel}
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
                  />
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
              ))}
            </div>
          ) : (
            <WorkerShiftMap
              shifts={shifts}
              selectedShiftId={selectedShiftId}
              onSelectShift={id => setSelectedShiftId(id)}
            />
          )}
        </div>
      )}
    </div>
  );
}
