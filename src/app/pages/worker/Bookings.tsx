import { useState } from 'react';
import { Link } from 'react-router';
import { CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';
import { addShiftToCalendar, listWorkerBookings } from '../../services';
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
}: {
  shift: Shift;
  statusDisplay: string;
  isUpcoming: boolean;
  calendarAdded: boolean;
  onAddToCalendar: () => void;
  calendarPending: boolean;
  showActiveShift: boolean;
  supabaseMode: boolean;
}) {
  const payLabel = acceptedPayRateLabel(
    supabaseMode,
    shift.rateTypeSnapshot ?? shift.rateType,
  );
  const payDisplay = displayAcceptedWorkerPay(shift);
  const showShiftTotal =
    hasWorkerRateSnapshot(shift) && shift.estimatedTotalDisplay !== '—';

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
            <div className="text-xs font-semibold uppercase tracking-wide text-[#607583]">
              {payLabel}
            </div>
            <div className="font-medium text-[#53B59F]">{payDisplay}</div>
            {showShiftTotal ? (
              <span className="mt-1 block font-normal text-[#607583]">
                Shift total {shift.estimatedTotalDisplay}
              </span>
            ) : null}
          </div>
        </div>
        <StatusBadge variant="covered">{statusDisplay}</StatusBadge>
      </div>
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
  const { run, isPending } = useWorkerAction();
  const [calendarAddedByShift, setCalendarAddedByShift] = useState<Record<string, boolean>>({});

  const isEmpty =
    data && data.upcoming.length === 0 && data.completed.length === 0;

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

        {!loading && !error && isEmpty && (
          <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-[#607583]">
              No bookings yet. Apply for open shifts to get started.
            </p>
            <Link
              to="/worker/shifts"
              className="mt-4 inline-flex text-sm font-semibold text-[#53B59F] hover:underline"
            >
              Browse open shifts →
            </Link>
          </div>
        )}

        {!loading && !error && data && !isEmpty && (
          <>
            <section>
              <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-[#607583]">
                Upcoming
              </h2>
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
              <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-[#607583]">
                Completed
              </h2>
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
