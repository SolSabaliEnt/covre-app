import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarPlus, Heart, Repeat2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  addShiftToCalendar,
  listWorkerBookings,
  listWorkerSiteReturnPreferences,
  saveWorkerSiteReturnPreference,
} from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useWorkerAction } from '../../hooks/useWorkerAction';
import { StatusBadge } from '../../components/StatusBadge';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import {
  acceptedPayRateLabel,
  displayAcceptedWorkerPay,
  hasWorkerRateSnapshot,
} from '../../lib/workerRateCents';
import type { Shift } from '../../data/types';
import {
  buildWorkerContinuity,
  buildWorkerContinuityRecognition,
  getSiteContinuity,
} from '../../lib/workerContinuity';

function LoadingBlock() {
  return (
    <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
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

function BookingCard({
  shift,
  statusDisplay,
  isUpcoming,
  calendarAdded,
  onAddToCalendar,
  calendarPending,
  showActiveShift,
  supabaseMode,
  workedHereCount,
  returnPreferenceSaved,
  returnPreferencePending,
  onSaveReturnPreference,
}: {
  shift: Shift;
  statusDisplay: string;
  isUpcoming: boolean;
  calendarAdded: boolean;
  onAddToCalendar: () => void;
  calendarPending: boolean;
  showActiveShift: boolean;
  supabaseMode: boolean;
  workedHereCount?: number;
  returnPreferenceSaved?: boolean;
  returnPreferencePending?: boolean;
  onSaveReturnPreference?: () => void;
}) {
  const payLabel = acceptedPayRateLabel(
    supabaseMode,
    shift.rateTypeSnapshot ?? shift.rateType,
  );
  const payDisplay = displayAcceptedWorkerPay(shift);
  const showShiftTotal = hasWorkerRateSnapshot(shift) && shift.estimatedTotalDisplay !== '—';

  return (
    <div className="rounded-xl border border-[#DDE7E8] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-[#13334F]">{shift.roleTitle}</div>
          <div className="text-sm text-[#607583]">{shift.siteName}</div>
          <div className="mt-1 text-sm text-[#607583]">
            {shift.dateLabel} · {shift.timeRange}
          </div>
          <div className="mt-2 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#607583]">{payLabel}</div>
            <div className="font-medium text-[#53B59F]">{payDisplay}</div>
            {showShiftTotal ? (
              <span className="mt-1 block font-normal text-[#607583]">Shift total {shift.estimatedTotalDisplay}</span>
            ) : null}
          </div>
        </div>
        <StatusBadge variant="covered">{statusDisplay}</StatusBadge>
      </div>

      {workedHereCount && workedHereCount > 1 ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#BFDCD5] bg-[#E6F6F2] px-3 py-2.5 text-sm text-[#257665]">
          <Repeat2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {workedHereCount >= 5 ? 'One of your regular places' : 'A familiar place'} · worked here {workedHereCount}×
          </span>
        </div>
      ) : null}

      {!isUpcoming ? (
        <div className="mt-4 rounded-xl border border-[#DDE7E8] bg-[#F7FAFA] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#607583]">Your preference</p>
          <p className="mt-1 text-sm text-[#13334F]">Would you be open to working at {shift.siteName} again?</p>
          <p className="mt-1 text-xs leading-5 text-[#607583]">
            This stays private. Covre can use it to remember places you would return to; it is not shown as a public rating or mutual-match status.
          </p>
          <button
            type="button"
            disabled={returnPreferenceSaved || returnPreferencePending}
            onClick={onSaveReturnPreference}
            className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#BFDCD5] bg-white px-3 py-2 text-sm font-semibold text-[#257665] transition-colors hover:bg-[#E6F6F2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Heart className="h-4 w-4" aria-hidden />
            {returnPreferenceSaved ? 'Saved: I’d work here again' : 'I’d work here again'}
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          to={`/worker/shift/${shift.id}`}
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B243A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] no-underline sm:min-w-[8rem]"
        >
          View shift
        </Link>
        <button
          type="button"
          disabled={calendarAdded || calendarPending}
          onClick={onAddToCalendar}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm font-semibold text-[#13334F] transition-colors hover:bg-[#F7FAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[8rem]"
        >
          <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden />
          {calendarAdded ? 'Added' : 'Add to Calendar'}
        </button>
        {isUpcoming && showActiveShift && (
          <Link
            to="/worker/active-shift"
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#13334F] no-underline sm:min-w-[8rem]"
          >
            Active Shift
          </Link>
        )}
      </div>
    </div>
  );
}

export default function WorkerBookings() {
  const supabaseMode = isSupabaseBackendEnabled();
  const { data, error, loading, reload } = useAsyncResource(() => listWorkerBookings(), []);
  const { data: savedReturnPreferenceSites } = useAsyncResource(() => listWorkerSiteReturnPreferences(), []);
  const { run, isPending } = useWorkerAction();
  const [calendarAddedByShift, setCalendarAddedByShift] = useState<Record<string, boolean>>({});
  const [returnPreferenceBySite, setReturnPreferenceBySite] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!savedReturnPreferenceSites) return;
    setReturnPreferenceBySite(
      Object.fromEntries(savedReturnPreferenceSites.map(siteId => [siteId, true])),
    );
  }, [savedReturnPreferenceSites]);

  const isEmpty = data && data.upcoming.length === 0 && data.completed.length === 0;
  const continuity = useMemo(() => buildWorkerContinuity(data), [data]);
  const recognition = useMemo(() => buildWorkerContinuityRecognition(continuity), [continuity]);

  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 text-[#10283D]">
      <header className="border-b border-[#DDE7E8] bg-white p-5 sm:p-6">
        <h1 className="text-2xl font-semibold text-[#13334F]">Bookings</h1>
        <p className="mt-2 text-sm text-[#607583]">
          {supabaseMode
            ? 'Confirmed shifts with accepted pay rates frozen at booking time. Earnings are not generated until timesheet approval.'
            : 'Track confirmed shifts, upcoming work, and completed coverage.'}
        </p>
      </header>

      <div className="space-y-8 py-4">
        {loading && <LoadingBlock />}
        {error && <ErrorBlock message={error.message} onRetry={reload} />}

        {!loading && !error && recognition && (
          <section className="rounded-2xl border border-[#BFDCD5] bg-[#E6F6F2] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#257665]">{recognition.eyebrow}</p>
            <h2 className="mt-1 text-xl font-semibold text-[#13334F]">{recognition.headline}</h2>
            <p className="mt-2 text-sm leading-6 text-[#607583]">{recognition.detail}</p>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#BFDCD5] pt-4">
              <div>
                <p className="text-2xl font-semibold text-[#13334F]">{recognition.primaryValue}</p>
                <p className="text-xs text-[#607583]">{recognition.primaryLabel}</p>
              </div>
              {typeof recognition.secondaryValue === 'number' ? (
                <div>
                  <p className="text-2xl font-semibold text-[#13334F]">{recognition.secondaryValue}</p>
                  <p className="text-xs text-[#607583]">{recognition.secondaryLabel}</p>
                </div>
              ) : null}
            </div>
          </section>
        )}

        {!loading && !error && isEmpty && (
          <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-[#607583]">No bookings yet. Apply for open shifts to get started.</p>
            <Link to="/worker/shifts" className="mt-4 inline-flex text-sm font-semibold text-[#53B59F] hover:underline">
              Browse open shifts →
            </Link>
          </div>
        )}

        {!loading && !error && data && !isEmpty && (
          <>
            <section>
              <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-[#607583]">Upcoming</h2>
              {data.upcoming.length === 0 ? (
                <p className="px-1 text-sm text-[#607583]">No upcoming bookings yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.upcoming.map(({ shift, statusDisplay }) => (
                    <BookingCard
                      key={`${shift.id}-upcoming`}
                      shift={shift}
                      statusDisplay={statusDisplay}
                      isUpcoming
                      supabaseMode={supabaseMode}
                      showActiveShift={!supabaseMode}
                      workedHereCount={getSiteContinuity(continuity, shift.siteId)?.completedShifts}
                      calendarAdded={!!calendarAddedByShift[shift.id]}
                      calendarPending={isPending(`cal-${shift.id}`)}
                      onAddToCalendar={async () => {
                        const r = await run(`cal-${shift.id}`, () => addShiftToCalendar(shift.id));
                        if (r.ok) {
                          toast.success(r.data.message);
                          setCalendarAddedByShift(prev => ({ ...prev, [shift.id]: true }));
                        } else toast.error(r.error.message);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-[#607583]">Completed</h2>
              {data.completed.length === 0 ? (
                <p className="px-1 text-sm text-[#607583]">No completed shifts listed.</p>
              ) : (
                <div className="space-y-3">
                  {data.completed.map(({ shift, statusDisplay }) => (
                    <BookingCard
                      key={`${shift.id}-completed`}
                      shift={shift}
                      statusDisplay={statusDisplay}
                      isUpcoming={false}
                      supabaseMode={supabaseMode}
                      showActiveShift={false}
                      workedHereCount={getSiteContinuity(continuity, shift.siteId)?.completedShifts}
                      returnPreferenceSaved={Boolean(returnPreferenceBySite[shift.siteId])}
                      returnPreferencePending={isPending(`return-${shift.siteId}`)}
                      onSaveReturnPreference={async () => {
                        const r = await run(`return-${shift.siteId}`, () => saveWorkerSiteReturnPreference(shift.siteId));
                        if (r.ok) {
                          toast.success(r.data.message);
                          setReturnPreferenceBySite(prev => ({ ...prev, [shift.siteId]: true }));
                        } else toast.error(r.error.message);
                      }}
                      calendarAdded={!!calendarAddedByShift[shift.id]}
                      calendarPending={isPending(`cal-${shift.id}`)}
                      onAddToCalendar={async () => {
                        const r = await run(`cal-${shift.id}`, () => addShiftToCalendar(shift.id));
                        if (r.ok) {
                          toast.success(r.data.message);
                          setCalendarAddedByShift(prev => ({ ...prev, [shift.id]: true }));
                        } else toast.error(r.error.message);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
