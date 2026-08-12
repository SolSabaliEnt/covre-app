import { StatusBadge } from '../../components/StatusBadge';
import { MapPin, Phone, AlertTriangle, Play, Coffee, Clock, CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  clockInShift,
  clockOutShift,
  endBreak,
  getActiveShift,
  startBreak,
  submitTimesheet,
} from '../../services';
import type { WorkerActiveShiftPhase, WorkerActiveShiftStatus } from '../../services/types';
import { formatTimeLabel } from '../../repositories/workerActiveShiftRepository';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useWorkerAction } from '../../hooks/useWorkerAction';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import {
  acceptedPayRateLabel,
  displayAcceptedWorkerPay,
} from '../../lib/workerRateCents';

type ActivePhase = 'not_started' | 'clocked_in' | 'on_break' | 'clocked_out' | 'submitted';

function mapPhaseToUi(phase: WorkerActiveShiftPhase): ActivePhase {
  switch (phase) {
    case 'scheduled':
      return 'not_started';
    case 'clocked_in':
      return 'clocked_in';
    case 'on_break':
      return 'on_break';
    case 'clocked_out':
      return 'clocked_out';
    case 'submitted':
      return 'submitted';
    default:
      return 'not_started';
  }
}

function elapsedSince(clockInAt?: string): string {
  if (!clockInAt) return '—';
  const ms = Date.now() - Date.parse(clockInAt);
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function afterSuccess(isSupabase: boolean, reload: () => void, setPhase: (p: ActivePhase) => void, next: ActivePhase) {
  if (isSupabase) reload();
  else setPhase(next);
}

function stagedBadgeLabel(status: WorkerActiveShiftStatus): string {
  switch (status) {
    case 'ready':
      return 'Ready (staged)';
    case 'in_progress_staged':
      return 'In progress (staged)';
    case 'completed_staged':
      return 'Ended (staged)';
    case 'scheduled':
      return 'Scheduled';
    default:
      return 'Staged';
  }
}

function SupabaseUnavailableView({
  message,
}: {
  message: string;
}) {
  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-10">
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm text-center">
        <CalendarClock className="mx-auto h-10 w-10 text-[#53B59F]" aria-hidden />
        <p className="text-sm font-medium text-[#13334F]">No active booking</p>
        <p className="text-sm text-[#607583]">{message}</p>
        <div className="flex flex-col gap-2 pt-2">
          <Link
            to="/worker/bookings"
            className="rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-semibold text-white hover:bg-[#2F8E7A]"
          >
            View bookings
          </Link>
          <Link
            to="/worker/shifts"
            className="rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm font-semibold text-[#13334F] hover:bg-[#F7FAFA]"
          >
            Browse shifts
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ActiveShift() {
  const isSupabase = isSupabaseBackendEnabled();
  const [phase, setPhase] = useState<ActivePhase>('not_started');
  const { run, isPending } = useWorkerAction();
  const { data, error, loading, reload } = useAsyncResource(() => getActiveShift(), []);

  const summary = data?.summary;
  const shift = data?.shift;
  const shiftId = data?.previewShiftId ?? summary?.shiftId ?? '';
  const actionsEnabled = summary?.actionsEnabled ?? !isSupabase;

  if (loading) {
    return (
      <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-10">
        <div className="mx-auto max-w-md rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
          <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-10">
        <div className="mx-auto max-w-md rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
          <p className="text-center text-sm text-[#607583]">{error.message}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0B243A]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isSupabase && summary?.status === 'unavailable') {
    return <SupabaseUnavailableView message={summary.message} />;
  }

  if (!shift || !shiftId) {
    return (
      <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-10 text-center">
        <p className="text-[#607583]">Shift preview not available.</p>
        <Link
          to="/worker/shifts"
          className="mt-4 inline-block font-medium text-[#53B59F] hover:text-[#2F8E7A]"
        >
          Back to shifts
        </Link>
      </div>
    );
  }

  const uiPhase: ActivePhase =
    isSupabase && summary?.phase ? mapPhaseToUi(summary.phase) : phase;

  const onBreak = uiPhase === 'on_break';
  const showClockIn =
    actionsEnabled &&
    uiPhase === 'not_started' &&
    (!isSupabase || summary?.canClockIn !== false);
  const showClockedInBlock =
    actionsEnabled && (uiPhase === 'clocked_in' || uiPhase === 'on_break');
  const showFooterClockOut =
    actionsEnabled &&
    uiPhase !== 'not_started' &&
    uiPhase !== 'clocked_out' &&
    uiPhase !== 'submitted' &&
    (isSupabase ? summary?.canClockOut : true);
  const showTimesheetFooter =
    actionsEnabled &&
    (uiPhase === 'clocked_out' || uiPhase === 'submitted') &&
    (!isSupabase || summary?.canSubmitTimesheet !== false || uiPhase === 'submitted');
  const showStagedPrep = isSupabase && !actionsEnabled;
  const breakStartLabel = summary?.events
    ?.filter(e => e.eventType === 'break_start')
    .slice(-1)[0]?.occurredAt;

  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-white px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-[#10283D]">
      <div className="-mx-4 -mt-6 bg-[#13334F] p-6 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] text-white">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">{shift.roleTitle}</h1>
          <StatusBadge variant={uiPhase === 'submitted' ? 'covered' : showStagedPrep ? 'pending' : 'covered'}>
            {uiPhase === 'submitted'
              ? 'Submitted'
              : showStagedPrep
                ? stagedBadgeLabel(summary?.status ?? 'scheduled')
                : 'Active'}
          </StatusBadge>
        </div>
        <p className="text-[#E8EEF2]">{shift.siteName}</p>
        {shift.dateLabel && shift.timeRange ? (
          <p className="mt-1 text-sm text-[#C5D4DC]">
            {shift.dateLabel} · {shift.timeRange}
          </p>
        ) : null}
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        <div className="rounded-xl border border-[#DDE7E8] bg-[#F7FAFA] p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#607583]">
            {acceptedPayRateLabel(
              isSupabase,
              summary?.rateTypeSnapshot ?? shift.rateTypeSnapshot ?? shift.rateType,
            )}
          </div>
          <div className="mt-1 text-lg font-semibold text-[#13334F]">
            {isSupabase
              ? summary?.workerPayDisplay ?? displayAcceptedWorkerPay(shift)
              : shift.hourlyPayDisplay}
          </div>
          {isSupabase ? (
            <p className="mt-2 text-xs text-[#9AAAB3]">
              Rate frozen at booking. Payouts are not generated until timesheet approval.
            </p>
          ) : null}
        </div>

        {showStagedPrep && summary ? (
          <>
            <div className="rounded-xl border border-[#DDE7E8] bg-[#F7FAFA] p-5">
              <p className="text-sm font-medium text-[#13334F]">Active shift (prep)</p>
              <p className="mt-2 text-sm leading-relaxed text-[#607583]">{summary.message}</p>
              <p className="mt-3 text-xs text-[#9AAAB3]">
                Your booking is loaded from Supabase. Clock-in, breaks, and timesheets are not
                connected yet.
              </p>
            </div>

            <div className="rounded-xl border-2 border-dashed border-[#DDE7E8] bg-white p-6 text-center opacity-80">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E8EEF2]">
                <Play className="h-8 w-8 text-[#9AAAB3]" />
              </div>
              <h3 className="mb-2 font-semibold text-[#13334F]">Clock-in coming soon</h3>
              <p className="text-sm text-[#607583]">
                Clock controls will appear here after active shift events and RLS are wired.
              </p>
              <button
                type="button"
                disabled
                className="mt-4 w-full cursor-not-allowed rounded-xl bg-[#E8EEF2] px-6 py-4 font-medium text-[#9AAAB3]"
              >
                Clock In (not connected)
              </button>
            </div>
          </>
        ) : null}

        {isSupabase && summary?.actionsEnabled && (
          <div className="rounded-xl border border-[#DDE7E8] bg-[#F7FAFA] p-5">
            <p className="text-sm leading-relaxed text-[#607583]">{summary.message}</p>
          </div>
        )}

        {showClockIn && (
          <div className="rounded-xl border-2 border-[#53B59F] bg-[#E6F6F2] p-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#53B59F]">
              <Play className="h-8 w-8 text-white" />
            </div>
            <h3 className="mb-2 font-semibold text-[#13334F]">Ready to start?</h3>
            <p className="mb-4 text-sm text-[#607583]">Make sure you&apos;ve arrived at the facility</p>
            <button
              type="button"
              disabled={isPending(`clock-in-${shiftId}`) || (isSupabase && !summary?.canClockIn)}
              onClick={async () => {
                const r = await run(`clock-in-${shiftId}`, () => clockInShift(shiftId));
                if (r.ok) {
                  toast.success(r.data.message);
                  afterSuccess(isSupabase, reload, setPhase, 'clocked_in');
                } else toast.error(r.error.message);
              }}
              className="w-full rounded-xl bg-[#53B59F] px-6 py-4 font-medium text-white transition-colors hover:bg-[#2F8E7A] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending(`clock-in-${shiftId}`) ? 'Clocking in…' : 'Clock In'}
            </button>
          </div>
        )}

        {showClockedInBlock && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#E6F6F2] p-6 text-center">
              <div className="mb-2 flex items-center justify-center gap-2 text-sm text-[#607583]">
                <Clock className="h-4 w-4 shrink-0" aria-hidden />
                Shift Time
              </div>
              <div className="mb-1 text-5xl font-semibold text-[#13334F]">
                {isSupabase ? elapsedSince(summary?.clockInAt) : '3:24'}
              </div>
              <div className="text-sm text-[#607583]">{shift.timeRange}</div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
                <div className="rounded-lg bg-white p-3">
                  <div className="text-xs text-[#607583]">Clocked In</div>
                  <div className="font-semibold text-[#13334F]">
                    {isSupabase ? formatTimeLabel(summary?.clockInAt) ?? '—' : '5:02 PM'}
                  </div>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <div className="text-xs text-[#607583]">Expected End</div>
                  <div className="font-semibold text-[#13334F]">
                    {isSupabase ? formatTimeLabel(summary?.endsAt) ?? '—' : '11:00 PM'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={
                  onBreak
                    ? isPending(`break-end-${shiftId}`) || (isSupabase && !summary?.canEndBreak)
                    : isPending(`break-start-${shiftId}`) || (isSupabase && !summary?.canStartBreak)
                }
                onClick={async () => {
                  if (onBreak) {
                    const r = await run(`break-end-${shiftId}`, () => endBreak(shiftId));
                    if (r.ok) {
                      toast.success(r.data.message);
                      afterSuccess(isSupabase, reload, setPhase, 'clocked_in');
                    } else toast.error(r.error.message);
                  } else {
                    const r = await run(`break-start-${shiftId}`, () => startBreak(shiftId));
                    if (r.ok) {
                      toast.success(r.data.message);
                      afterSuccess(isSupabase, reload, setPhase, 'on_break');
                    } else toast.error(r.error.message);
                  }
                }}
                className={`flex-1 rounded-xl px-4 py-3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  onBreak
                    ? 'bg-[#53B59F] text-white hover:bg-[#2F8E7A]'
                    : 'bg-[#E8EEF2] text-[#13334F] hover:bg-[#DDE7E8]'
                }`}
              >
                <Coffee className="mx-auto mb-1 h-5 w-5" />
                {onBreak
                  ? isPending(`break-end-${shiftId}`)
                    ? 'Ending…'
                    : 'End Break'
                  : isPending(`break-start-${shiftId}`)
                    ? 'Starting…'
                    : 'Start Break'}
              </button>
            </div>

            {onBreak && (
              <div className="rounded-xl border border-[#F4A83D] bg-[#FFF4E0] p-5">
                <div className="mb-1 flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-[#9B6419]" />
                  <span className="font-medium text-[#9B6419]">On Break</span>
                </div>
                <div className="text-sm text-[#9B6419]">
                  Break started at{' '}
                  {isSupabase ? formatTimeLabel(breakStartLabel) ?? '—' : '8:15 PM'}
                </div>
              </div>
            )}
          </div>
        )}

        {actionsEnabled && uiPhase === 'clocked_out' && (
          <div className="rounded-xl border border-[#DDE7E8] bg-[#F7FAFA] p-5 text-center">
            <p className="text-sm font-medium text-[#13334F]">You&apos;re clocked out</p>
            <p className="mt-1 text-sm text-[#607583]">Submit your timesheet to wrap this shift.</p>
          </div>
        )}

        {actionsEnabled && uiPhase === 'submitted' && (
          <div className="rounded-xl border border-[#53B59F] bg-[#E6F6F2] p-5 text-center">
            <p className="text-sm font-semibold text-[#13334F]">Timesheet submitted</p>
            <p className="mt-1 text-sm text-[#607583]">
              Timesheet approval remains with the facility.
            </p>
          </div>
        )}

        <div>
          <h3 className="mb-3 font-semibold text-[#13334F]">Facility Information</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#607583]" />
              <div>
                <div className="font-medium text-[#13334F]">{shift.siteName}</div>
                <div className="text-sm text-[#607583]">{shift.streetAddress}, Portland</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-5 w-5 shrink-0 text-[#607583]" />
              <div>
                <div className="font-medium text-[#13334F]">
                  Supervisor: {shift.supervisorName ?? 'Site lead'}
                </div>
                <a
                  href={shift.sitePhone ? `tel:${shift.sitePhone.replace(/\D/g, '')}` : 'tel:5035551234'}
                  className="text-sm text-[#53B59F]"
                >
                  (503) 555-1234
                </a>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-3 font-semibold text-[#13334F]">Quick Actions</h3>
          <div className="space-y-2">
            <button
              type="button"
              className="w-full rounded-xl bg-[#E8EEF2] px-4 py-3 text-left font-medium text-[#13334F] transition-colors hover:bg-[#DDE7E8]"
            >
              View Facility Orientation
            </button>
            <Link
              to="/worker/safety"
              className="flex w-full items-center gap-2 rounded-xl bg-[#FDEAEA] px-4 py-3 text-left font-medium text-[#A93636] transition-colors hover:bg-[#FDD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
              Report an Issue
            </Link>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl bg-[#D94A4A] px-4 py-3 text-left font-medium text-white transition-colors hover:bg-[#C03]"
            >
              <Phone className="h-5 w-5" />
              Emergency Support
            </button>
          </div>
        </div>
      </div>

      {showFooterClockOut && (
        <div className="-mx-4 border-t border-[#DDE7E8] bg-white p-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={isPending(`clock-out-${shiftId}`) || (isSupabase && !summary?.canClockOut)}
            onClick={async () => {
              const r = await run(`clock-out-${shiftId}`, () => clockOutShift(shiftId));
              if (r.ok) {
                toast.success(r.data.message);
                afterSuccess(isSupabase, reload, setPhase, 'clocked_out');
              } else toast.error(r.error.message);
            }}
            className="w-full rounded-xl bg-[#13334F] px-6 py-4 font-medium text-white transition-colors hover:bg-[#0B243A] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending(`clock-out-${shiftId}`) ? 'Clocking out…' : 'Clock Out'}
          </button>
        </div>
      )}

      {showTimesheetFooter && (
        <div className="-mx-4 border-t border-[#DDE7E8] bg-white p-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={
              uiPhase === 'submitted' ||
              isPending(`timesheet-${shiftId}`) ||
              (isSupabase && !summary?.canSubmitTimesheet)
            }
            onClick={async () => {
              const r = await run(`timesheet-${shiftId}`, () => submitTimesheet(shiftId));
              if (r.ok) {
                toast.success(r.data.message);
                afterSuccess(isSupabase, reload, setPhase, 'submitted');
              } else toast.error(r.error.message);
            }}
            className="w-full rounded-xl bg-[#53B59F] px-6 py-4 font-medium text-white transition-colors hover:bg-[#2F8E7A] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uiPhase === 'submitted'
              ? 'Submitted'
              : isPending(`timesheet-${shiftId}`)
                ? 'Submitting…'
                : 'Submit Timesheet'}
          </button>
        </div>
      )}
    </div>
  );
}
