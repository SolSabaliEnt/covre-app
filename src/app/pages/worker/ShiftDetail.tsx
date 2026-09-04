import type { CareSite, Shift } from '../../data/types';
import { StatusBadge } from '../../components/StatusBadge';
import { Link, useNavigate, useParams } from 'react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapPin,
  Shield,
  AlertTriangle,
  Car,
  Users,
  Pill,
  ChevronLeft,
  MessageCircle,
  CalendarPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  addShiftToCalendar,
  askShiftQuestion,
  claimShift,
  getWorkerBookingForShift,
  getWorkerShiftPage,
  listWorkerBookings,
  listWorkerShiftRequests,
  trackContinuityEvent,
} from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useWorkerAction } from '../../hooks/useWorkerAction';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import { displayWorkerPay, workerPayRateLabel } from '../../lib/workerRateCents';
import { WORKER_ENTRY_PATH } from '../../lib/entryRoutes';
import { buildWorkerContinuity, getSiteContinuity } from '../../lib/workerContinuity';

function LoadingBlock() {
  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-10 text-[#10283D]">
      <div className="mx-auto max-w-md rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
        <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
      </div>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-10 text-[#10283D]">
      <div className="mx-auto max-w-md rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
        <p className="text-center text-sm text-[#607583]">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B243A]"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function NotFoundCard({ supabaseMode }: { supabaseMode?: boolean }) {
  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-10 text-center text-[#10283D]">
      <div className="mx-auto max-w-md rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-[#13334F]">Shift not found</h1>
        <p className="mt-2 text-sm text-[#607583]">
          {supabaseMode
            ? 'This shift is not open, has no worker pay rate set, or is no longer available.'
            : "This shift isn't in the preview dataset."}
        </p>
        <Link
          to="/worker/shifts"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2F8E7A]"
        >
          Back to shifts
        </Link>
      </div>
    </div>
  );
}

function ShiftDetailView({
  shift,
  site,
  shiftId,
  supabaseMode,
}: {
  shift: Shift;
  site: CareSite | undefined;
  shiftId: string;
  supabaseMode: boolean;
}) {
  const navigate = useNavigate();
  const { run, isPending } = useWorkerAction();
  const familiarDetailTracked = useRef(false);
  const { data: requests } = useAsyncResource(
    () =>
      supabaseMode
        ? listWorkerShiftRequests()
        : Promise.resolve({ ok: true as const, data: [] }),
    [supabaseMode],
  );
  const { data: booking } = useAsyncResource(
    () =>
      supabaseMode
        ? getWorkerBookingForShift(shiftId)
        : Promise.resolve({ ok: true as const, data: null }),
    [supabaseMode, shiftId],
  );
  const { data: bookings } = useAsyncResource(() => listWorkerBookings(), []);

  const continuity = useMemo(() => buildWorkerContinuity(bookings), [bookings]);
  const siteHistory = getSiteContinuity(continuity, shift.siteId);

  useEffect(() => {
    if (!siteHistory || familiarDetailTracked.current) return;
    familiarDetailTracked.current = true;
    trackContinuityEvent('worker_familiar_shift_detail_view', {
      actor: 'worker',
      shiftId,
      siteId: shift.siteId,
      source: 'shift_detail',
      completedShiftsHere: siteHistory.completedShifts,
    });
  }, [shift.siteId, shiftId, siteHistory]);

  const alreadyApplied = useMemo(
    () =>
      Boolean(
        requests?.some(
          r =>
            r.shiftId === shiftId &&
            (r.status === 'requested' || r.status === 'accepted'),
        ),
      ),
    [requests, shiftId],
  );

  const [claimed, setClaimed] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showClaimSuccess, setShowClaimSuccess] = useState(false);
  const [showApplicationSent, setShowApplicationSent] = useState(false);
  const [calendarAdded, setCalendarAdded] = useState(false);
  const [questionSent, setQuestionSent] = useState(false);

  useEffect(() => {
    if (alreadyApplied) setApplied(true);
  }, [alreadyApplied]);

  const addressLine = site?.address ?? shift.streetAddress;
  const isBooked = Boolean(supabaseMode && booking);
  const isApplied = supabaseMode ? applied || isBooked : claimed;

  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-white px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-[#10283D]">
      <div className="-mx-4 -mt-6 bg-[#13334F] px-6 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] text-white">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#244965] transition-colors hover:bg-[#314858] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <h1 className="mb-2 text-2xl font-semibold">{shift.roleTitle}</h1>
        <p className="text-[#E8EEF2]">
          {shift.facilitySettingLabel} • {shift.dateLabel}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {shift.workerShiftReadiness ? (
            <StatusBadge variant={shift.workerShiftReadiness.isReady ? 'covered' : 'pending'}>
              {shift.workerShiftReadiness.isReady ? 'Ready' : 'Needs credentials'}
            </StatusBadge>
          ) : (
            <StatusBadge variant="covered">
              {shift.workerFeedCardStatus === 'preferred' ? 'Preferred' : 'Ready Match'}
            </StatusBadge>
          )}
          {siteHistory && <StatusBadge variant="preferred">Worked here {siteHistory.completedShifts}×</StatusBadge>}
          {supabaseMode && isBooked && <StatusBadge variant="covered">Booked</StatusBadge>}
          {supabaseMode && !isBooked && isApplied && <StatusBadge variant="pending">Applied</StatusBadge>}
        </div>
      </div>

      <div>
        <div className="border-b border-[#DDE7E8] p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-sm text-[#607583]">{workerPayRateLabel(shift, supabaseMode)}</div>
              <div className="text-3xl font-semibold text-[#13334F]">{displayWorkerPay(shift)}</div>
              <div className="mt-1 text-sm font-medium text-[#53B59F]">
                Est. {shift.estimatedTotalDisplay} total
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm text-[#607583]">Shift Time</div>
              <div className="text-lg font-semibold text-[#13334F]">{shift.timeRange}</div>
              <div className="mt-1 text-sm text-[#607583]">8 hours</div>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          {siteHistory ? (
            <div className="rounded-2xl border border-[#DDE7E8] bg-[#F7FAFA] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#607583]">Your history here</p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold text-[#13334F]">{siteHistory.completedShifts}</p>
                  <p className="text-xs text-[#607583]">completed {siteHistory.completedShifts === 1 ? 'shift' : 'shifts'}</p>
                </div>
                <div className="text-right">
                  {siteHistory.lastWorkedLabel && (
                    <p className="text-sm font-medium text-[#13334F]">Last here {siteHistory.lastWorkedLabel}</p>
                  )}
                  <p className="mt-1 text-xs text-[#607583]">You already know this place.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#DDE7E8] bg-[#F7FAFA] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#607583]">First time here</p>
              <p className="mt-2 text-sm text-[#13334F]">Covre keeps the site details you need close before you arrive.</p>
            </div>
          )}

          {supabaseMode && booking && (
            <div className="rounded-xl border border-[#53B59F] bg-[#E6F6F2] px-4 py-3 text-sm text-[#13334F]">
              <p className="font-medium">You are booked for this shift.</p>
              <p className="mt-1 text-xs text-[#607583]">
                Active shift clock and timesheets are not connected yet.
              </p>
            </div>
          )}

          {supabaseMode && !booking && (
            <div className="rounded-xl border border-[#DDE7E8] bg-[#F7FAFA] px-4 py-3 text-sm text-[#607583]">
              <p>
                Send an application to express interest. This does not create a booking — provider
                review and assignment come later.
              </p>
              {shift.workerShiftReadiness && (
                <p className="mt-2 font-medium text-[#13334F]">
                  {shift.workerShiftReadiness.statusLabel}
                </p>
              )}
              {!shift.workerShiftReadiness?.isReady &&
                shift.workerShiftReadiness?.missingCredentialNames.length ? (
                  <p className="mt-1 text-xs text-[#9B6419]">
                    Add missing credentials from your{' '}
                    <Link to="/worker/credentials" className="font-semibold text-[#53B59F] hover:underline">
                      Credential Passport
                    </Link>
                    .
                  </p>
                ) : null}
            </div>
          )}

          <div>
            <h3 className="mb-3 font-semibold text-[#13334F]">Shift Details</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#607583]" />
                <div>
                  <div className="font-medium text-[#13334F]">{shift.distanceMiles} away</div>
                  <div className="text-sm text-[#607583]">{shift.siteName}</div>
                  <div className="text-sm text-[#607583]">{addressLine}</div>
                </div>
              </div>

              {shift.soloShiftNote && (
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 h-5 w-5 shrink-0 text-[#607583]" />
                  <div>
                    <div className="font-medium text-[#13334F]">Solo shift</div>
                    <div className="text-sm text-[#607583]">{shift.soloShiftNote}</div>
                  </div>
                </div>
              )}

              {shift.medicationNote && (
                <div className="flex items-start gap-3">
                  <Pill className="mt-0.5 h-5 w-5 shrink-0 text-[#607583]" />
                  <div>
                    <div className="font-medium text-[#13334F]">Medication pass required</div>
                    <div className="text-sm text-[#607583]">{shift.medicationNote}</div>
                  </div>
                </div>
              )}

              {shift.parkingNote && (
                <div className="flex items-start gap-3">
                  <Car className="mt-0.5 h-5 w-5 shrink-0 text-[#607583]" />
                  <div>
                    <div className="font-medium text-[#13334F]">Parking</div>
                    <div className="text-sm text-[#607583]">{shift.parkingNote}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-semibold text-[#13334F]">Required Credentials</h3>
            <div className="flex flex-wrap gap-2">
              {shift.requiredCredentialsDisplayed.map(c => (
                <div
                  key={c}
                  className="flex items-center gap-2 rounded-lg border border-[#53B59F] bg-[#E6F6F2] px-3 py-2"
                >
                  <Shield className="h-4 w-4 text-[#257665]" />
                  <span className="text-sm font-medium text-[#257665]">{c}</span>
                </div>
              ))}
            </div>
          </div>

          {shift.duties.length > 0 && (
            <div>
              <h3 className="mb-3 font-semibold text-[#13334F]">Duties</h3>
              <ul className="space-y-2 text-sm text-[#607583]">
                {shift.duties.map(line => (
                  <li key={line} className="flex items-start gap-2">
                    <span className="mt-1 text-[#53B59F]">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {shift.cancellationNote && (
            <div className="rounded-xl border border-[#F4A83D] bg-[#FFF4E0] p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9B6419]" />
                <div>
                  <div className="mb-1 font-medium text-[#9B6419]">Cancellation Policy</div>
                  <div className="text-sm text-[#9B6419]">{shift.cancellationNote}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="-mx-4 mt-4 space-y-3 border-t border-[#DDE7E8] bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6">
        {showApplicationSent && supabaseMode && (
          <div className="mb-3 rounded-xl border border-[#53B59F] bg-[#E6F6F2] p-4">
            <p className="text-center text-sm font-semibold text-[#13334F]">Application sent</p>
            <p className="mt-2 text-center text-xs text-[#607583]">
              This does not create a booking. Provider review and assignment are not connected yet.
            </p>
          </div>
        )}

        {showClaimSuccess && !supabaseMode && (
          <div className="mb-3 rounded-xl border border-[#53B59F] bg-[#E6F6F2] p-4">
            <p className="text-center text-sm font-semibold text-[#13334F]">Your shift is covered.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                to="/worker/bookings"
                className="flex min-h-11 items-center justify-center rounded-xl bg-[#13334F] px-4 py-3 text-center text-sm font-semibold text-white no-underline transition-colors hover:bg-[#0B243A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] sm:flex-1"
              >
                View Bookings
              </Link>
              <Link
                to="/worker/active-shift"
                className="flex min-h-11 items-center justify-center rounded-xl border border-[#13334F] bg-white px-4 py-3 text-center text-sm font-semibold text-[#13334F] no-underline transition-colors hover:bg-[#F7FAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] sm:flex-1"
              >
                Active Shift
              </Link>
            </div>
          </div>
        )}

        {supabaseMode && !isBooked && shift.workerShiftReadiness && !shift.workerShiftReadiness.isReady && (
          <p className="mb-3 text-xs leading-relaxed text-[#9B6419]">
            You can apply, but missing credentials may affect eligibility.
          </p>
        )}

        {!isBooked && (
          <button
            type="button"
            disabled={isApplied || isPending(`claim-${shiftId}`)}
            onClick={async e => {
              e.stopPropagation();
              const r = await run(`claim-${shiftId}`, () => claimShift(shiftId));
              if (r.ok) {
                toast.success(r.data.message);
                if (siteHistory) {
                  trackContinuityEvent('worker_familiar_shift_application', {
                    actor: 'worker',
                    shiftId,
                    siteId: shift.siteId,
                    source: supabaseMode ? 'application' : 'claim',
                    completedShiftsHere: siteHistory.completedShifts,
                  });
                }
                if (supabaseMode) {
                  setApplied(true);
                  if (r.data.message === 'Application sent') setShowApplicationSent(true);
                } else {
                  setClaimed(true);
                  setShowClaimSuccess(true);
                }
              } else toast.error(r.error.message);
            }}
            className="w-full rounded-xl bg-[#53B59F] px-6 py-4 font-medium text-white transition-colors hover:bg-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#13334F] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {supabaseMode
              ? isApplied
                ? alreadyApplied && !showApplicationSent
                  ? 'Already applied'
                  : 'Applied'
                : 'Send application'
              : claimed
                ? 'Claimed'
                : 'Claim Shift'}
          </button>
        )}

        {isBooked && supabaseMode && (
          <Link
            to="/worker/bookings"
            className="mb-3 flex min-h-11 w-full items-center justify-center rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#0B243A]"
          >
            View in Bookings
          </Link>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={questionSent || isPending(`ask-${shiftId}`)}
            onClick={async e => {
              e.stopPropagation();
              const r = await run(`ask-${shiftId}`, () =>
                askShiftQuestion(shiftId, 'Question from shift detail'),
              );
              if (r.ok) {
                toast.success(r.data.message);
                setQuestionSent(true);
              } else toast.error(r.error.message);
            }}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#E8EEF2] px-6 py-4 font-medium text-[#13334F] transition-colors hover:bg-[#DDE7E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
            {questionSent ? 'Question Sent' : 'Ask a Question'}
          </button>
          <button
            type="button"
            disabled={calendarAdded || isPending(`cal-${shiftId}`)}
            onClick={async e => {
              e.stopPropagation();
              const r = await run(`cal-${shiftId}`, () => addShiftToCalendar(shiftId));
              if (r.ok) {
                toast.success(r.data.message);
                setCalendarAdded(true);
              } else toast.error(r.error.message);
            }}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#DDE7E8] bg-white px-6 py-4 font-medium text-[#13334F] transition-colors hover:bg-[#F7FAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CalendarPlus className="h-5 w-5 shrink-0" aria-hidden />
            {calendarAdded ? 'Added' : 'Add to Calendar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShiftDetail() {
  const supabaseMode = isSupabaseBackendEnabled();
  const { id } = useParams();
  const { data, error, loading, reload } = useAsyncResource(
    () =>
      !id
        ? Promise.resolve({ ok: true as const, data: null })
        : getWorkerShiftPage(id),
    [id],
  );

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error.message} onRetry={reload} />;
  if (!data || !id) return <NotFoundCard supabaseMode={supabaseMode} />;

  const { shift, site } = data;
  return <ShiftDetailView shift={shift} site={site} shiftId={id} supabaseMode={supabaseMode} />;
}