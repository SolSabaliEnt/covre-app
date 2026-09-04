import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Building2, Calendar, DollarSign, Shield, User } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import {
  acceptProviderShiftApplicant,
  getProviderShift,
  listProviderShiftApplicantReview,
} from '../../services';
import type { ProviderShiftApplicantReview } from '../../services/providerApplicantReviewTypes';
import type { Shift } from '../../data/types';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useProviderAction } from '../../hooks/useProviderAction';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import { toast } from 'sonner';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#DDE7E8] bg-white p-4 shadow-sm sm:p-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#607583]">{title}</h2>
      {children}
    </section>
  );
}

function boardBadge(shift: Shift) {
  if (shift.providerBoardStatus === 'covered') {
    return { variant: 'covered' as const, label: 'Covered' };
  }
  if (shift.providerBoardStatus === 'urgent') {
    return { variant: 'urgent' as const, label: 'Urgent' };
  }
  return { variant: 'pending' as const, label: 'Pending' };
}

function reviewBadge(applicant: ProviderShiftApplicantReview) {
  switch (applicant.reviewState) {
    case 'invited_accepted':
      return { variant: 'covered' as const, label: 'Invited · worker accepted' };
    case 'invited':
      return { variant: 'preferred' as const, label: 'Invited · awaiting worker' };
    case 'booked':
      return { variant: 'covered' as const, label: 'Booked · coverage secured' };
    case 'covered_elsewhere':
      return { variant: 'new' as const, label: 'Closed · coverage secured' };
    case 'withdrawn':
      return { variant: 'new' as const, label: 'Withdrawn' };
    case 'declined':
      return { variant: 'new' as const, label: applicant.invitation ? 'Invitation declined' : 'Declined' };
    case 'applied':
    default:
      return { variant: 'pending' as const, label: 'Applied' };
  }
}

function formatSubmittedAt(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function invitationResolutionLine(applicant: ProviderShiftApplicantReview): string | null {
  const invitation = applicant.invitation;
  if (!invitation) return null;
  if (invitation.resolutionReason === 'booked') return ' · this invitation led to the booked coverage';
  if (invitation.resolutionReason === 'shift_covered_elsewhere') {
    return ' · worker accepted, but coverage was secured with someone else';
  }
  if (invitation.resolutionReason === 'shift_covered') return ' · closed automatically when coverage was secured';
  if (invitation.status === 'accepted') return ' · worker explicitly accepted this invitation';
  if (invitation.status === 'pending' || invitation.status === 'viewed') return ' · waiting for worker response';
  return ` · ${invitation.status}`;
}

function ApplicationsSection({
  shiftId,
  onBookingCreated,
}: {
  shiftId: string;
  onBookingCreated?: () => void;
}) {
  const supabaseMode = isSupabaseBackendEnabled();
  const { run, isPending } = useProviderAction();
  const [locallyBookedRequestIds, setLocallyBookedRequestIds] = useState<Record<string, boolean>>({});
  const { data, error, loading, reload } = useAsyncResource(
    () => listProviderShiftApplicantReview(shiftId),
    [shiftId, supabaseMode],
  );

  if (loading) {
    return (
      <Section title="Applications & invitations">
        <p className="text-sm text-[#607583]">Loading worker responses…</p>
      </Section>
    );
  }

  if (error) {
    return (
      <Section title="Applications & invitations">
        <p className="text-sm text-[#607583]">{error.message}</p>
      </Section>
    );
  }

  const applicants = data?.applicants ?? [];
  const hasBooked = applicants.some(
    applicant => applicant.reviewState === 'booked' || Boolean(applicant.requestId && locallyBookedRequestIds[applicant.requestId]),
  );
  const acceptedInvites = applicants.filter(applicant => applicant.reviewState === 'invited_accepted').length;

  return (
    <Section title="Applications & invitations">
      <p className="mb-4 text-sm leading-6 text-[#607583]">
        {hasBooked
          ? 'Coverage is secured. Covre closes competing pending applications and invitations while preserving the worker-response history.'
          : acceptedInvites > 0
            ? `${acceptedInvites} invited ${acceptedInvites === 1 ? 'worker has' : 'workers have'} accepted. Confirming below uses Covre’s existing booking transaction.`
            : 'Applications and provider invitations are shown together. An invitation is not a booking until the worker accepts and you confirm coverage.'}
      </p>

      {applicants.length === 0 ? (
        <p className="text-sm text-[#607583]">No applications or invitations yet.</p>
      ) : (
        <ul className="space-y-3">
          {applicants.map(applicant => {
            const locallyBooked = Boolean(applicant.requestId && locallyBookedRequestIds[applicant.requestId]);
            const effectiveApplicant = locallyBooked
              ? { ...applicant, reviewState: 'booked' as const }
              : applicant;
            const badge = reviewBadge(effectiveApplicant);
            const canConfirm =
              Boolean(applicant.requestId) &&
              !hasBooked &&
              data?.canConfirmBookings !== false &&
              (applicant.reviewState === 'applied' || applicant.reviewState === 'invited_accepted');
            const pendingKey = applicant.requestId ? `accept-${applicant.requestId}` : '';

            return (
              <li
                key={applicant.requestId ?? applicant.invitation?.invitationId ?? applicant.workerId}
                className={`rounded-xl border p-4 ${
                  applicant.reviewState === 'invited_accepted'
                    ? 'border-[#BFDCD5] bg-[#E6F6F2]'
                    : applicant.reviewState === 'booked'
                      ? 'border-[#BFDCD5] bg-white'
                      : 'border-[#DDE7E8] bg-[#F7FAFA]'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-[#13334F]">{applicant.workerName}</p>
                    {applicant.workerRole ? (
                      <p className="mt-0.5 text-sm text-[#607583]">{applicant.workerRole}</p>
                    ) : null}
                    {applicant.workerLocation ? (
                      <p className="mt-0.5 text-xs text-[#607583]">{applicant.workerLocation}</p>
                    ) : null}
                  </div>
                  <StatusBadge variant={badge.variant}>{badge.label}</StatusBadge>
                </div>

                {applicant.invitation ? (
                  <div className="mt-3 rounded-lg border border-[#DDE7E8] bg-white/80 px-3 py-2 text-xs leading-5 text-[#607583]">
                    <p className="font-semibold text-[#13334F]">Provider invitation</p>
                    <p>
                      Sent {formatSubmittedAt(applicant.invitation.invitedAt) ?? 'earlier'}
                      {invitationResolutionLine(applicant)}
                    </p>
                    {applicant.invitation.resolvedAt ? (
                      <p>Resolved {formatSubmittedAt(applicant.invitation.resolvedAt) ?? 'when coverage was secured'}</p>
                    ) : null}
                  </div>
                ) : null}

                {formatSubmittedAt(applicant.submittedAt) ? (
                  <p className="mt-2 text-xs text-[#607583]">
                    {applicant.invitation ? 'Booking request created' : 'Applied'} {formatSubmittedAt(applicant.submittedAt)}
                  </p>
                ) : null}

                {canConfirm && applicant.requestId ? (
                  <button
                    type="button"
                    disabled={isPending(pendingKey)}
                    onClick={async () => {
                      const requestId = applicant.requestId;
                      if (!requestId) return;
                      const r = await run(pendingKey, () => acceptProviderShiftApplicant(requestId));
                      if (r.ok) {
                        toast.success(r.data.message);
                        if (supabaseMode) reload();
                        else setLocallyBookedRequestIds(prev => ({ ...prev, [requestId]: true }));
                        onBookingCreated?.();
                      } else {
                        toast.error(r.error.message);
                      }
                    }}
                    className="mt-3 w-full rounded-lg bg-[#53B59F] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2F8E7A] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending(pendingKey)
                      ? 'Confirming…'
                      : applicant.reviewState === 'invited_accepted'
                        ? 'Confirm worker & create booking'
                        : 'Accept application & create booking'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-3 w-full rounded-lg border border-[#DDE7E8] bg-white px-3 py-2 text-sm font-semibold text-[#607583] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {effectiveApplicant.reviewState === 'booked'
                      ? 'Coverage secured'
                      : effectiveApplicant.reviewState === 'covered_elsewhere'
                        ? 'Closed when shift was booked'
                        : effectiveApplicant.reviewState === 'invited'
                          ? 'Waiting for worker'
                          : effectiveApplicant.reviewState === 'declined'
                            ? 'No action'
                            : hasBooked
                              ? 'Shift booked'
                              : 'No booking action'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data?.message ? <p className="mt-4 text-xs leading-5 text-[#607583]">{data.message}</p> : null}
    </Section>
  );
}

function NotFoundCard() {
  return (
    <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto max-w-lg rounded-2xl border border-[#DDE7E8] bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-[#13334F]">Shift not found</h1>
        <p className="mt-2 text-sm text-[#607583]">
          This shift was not found for your organization or may have been removed.
        </p>
        <Link
          to="/provider/shifts"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to shifts
        </Link>
      </div>
    </div>
  );
}

export default function ProviderShiftDetail() {
  const { id } = useParams();
  const { data: shift, error, loading, reload } = useAsyncResource(
    () => (!id ? Promise.resolve({ ok: true as const, data: undefined }) : getProviderShift(id)),
    [id],
  );

  if (loading) {
    return (
      <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
          <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
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

  if (!shift) {
    return <NotFoundCard />;
  }

  const badge = boardBadge(shift);
  const hasCredentials = shift.requiredCredentialsDisplayed.length > 0;
  const hasDuties = shift.duties.length > 0;

  return (
    <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 pb-8">
      <div className="mx-auto w-full min-w-0 max-w-full space-y-6">
        <header className="min-w-0 space-y-2">
          <Link
            to="/provider/shifts"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back to shifts
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-semibold text-[#13334F]">{shift.roleTitle}</h1>
              <p className="mt-1 text-sm text-[#607583]">
                {shift.dateLabel} · {shift.timeRange}
              </p>
            </div>
            <StatusBadge variant={badge.variant}>{badge.label}</StatusBadge>
          </div>
        </header>

        <Section title="Site">
          <div className="flex items-start gap-3 text-[#13334F]">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-[#53B59F]" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium">{shift.siteName}</p>
              <p className="mt-1 text-sm text-[#607583]">{shift.facilitySettingLabel}</p>
              <p className="mt-1 break-words text-sm text-[#607583]">{shift.streetAddress}</p>
            </div>
          </div>
        </Section>

        <Section title="Schedule & bill rate">
          <ul className="space-y-3 text-sm text-[#13334F]">
            <li className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-[#53B59F]" aria-hidden />
              <span>
                {shift.dateLabel}, {shift.timeRange}
                <span className="block text-[#607583]">Status: {shift.lifecycleStatus}</span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <DollarSign className="mt-0.5 h-5 w-5 shrink-0 text-[#53B59F]" aria-hidden />
              <span>
                Bill rate: {shift.hourlyPayDisplay}
                <span className="block text-[#607583]">
                  Estimated bill {shift.estimatedTotalDisplay}
                </span>
              </span>
            </li>
          </ul>
          {shift.isUrgent ? (
            <p className="mt-3 text-sm font-medium text-[#A93636]">Marked urgent</p>
          ) : null}
        </Section>

        <Section title="Required credentials">
          {hasCredentials ? (
            <ul className="flex flex-wrap gap-2">
              {shift.requiredCredentialsDisplayed.map(name => (
                <li
                  key={name}
                  className="flex items-center gap-1 rounded-full bg-[#E6F6F2] px-3 py-1 text-xs font-medium text-[#257665]"
                >
                  <Shield className="h-3 w-3" aria-hidden />
                  {name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#607583]">No credential requirements listed for this shift.</p>
          )}
        </Section>

        {hasDuties ? (
          <Section title="Shift duties">
            <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-[#13334F]">
              {shift.duties.map(line => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Section>
        ) : null}

        {id ? <ApplicationsSection shiftId={id} onBookingCreated={reload} /> : null}

        <Section title="Assigned worker">
          {shift.lifecycleStatus === 'Booked' ? (
            <p className="text-sm text-[#607583]">
              Coverage is secured. Covre keeps invitation and application history as audit context while closing unresolved competing intent.
            </p>
          ) : shift.assignedWorkerId ? (
            <Link
              to={`/provider/workers/${shift.assignedWorkerId}`}
              className="inline-flex items-center gap-2 font-medium text-[#53B59F] hover:text-[#2F8E7A]"
            >
              <User className="h-4 w-4" aria-hidden />
              View worker profile
            </Link>
          ) : (
            <p className="text-sm text-[#607583]">
              No worker assigned yet. Review applications and accepted invitations above, or use Find worker for recommendations.
            </p>
          )}
        </Section>

        <div className="flex flex-col gap-3 sm:flex-row">
          {shift.lifecycleStatus !== 'Booked' && !shift.assignedWorkerId ? (
            <Link
              to={`/provider/worker-match/${shift.id}`}
              className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#2F8E7A]"
            >
              Find worker
            </Link>
          ) : null}
          <Link
            to="/provider/post-shift"
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm font-semibold text-[#13334F] no-underline transition-colors hover:bg-[#F7FAFA]"
          >
            Post another shift
          </Link>
        </div>
      </div>
    </div>
  );
}
