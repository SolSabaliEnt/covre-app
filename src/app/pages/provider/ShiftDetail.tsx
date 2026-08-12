import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Building2, Calendar, DollarSign, Shield, User } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import {
  acceptProviderShiftApplicant,
  getProviderShift,
  listProviderShiftApplicants,
} from '../../services';
import type { ProviderShiftApplicant } from '../../services/types';
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

function formatApplicantStatus(status: ProviderShiftApplicant['status']): string {
  switch (status) {
    case 'requested':
      return 'Requested';
    case 'withdrawn':
      return 'Withdrawn';
    case 'accepted':
      return 'Accepted';
    case 'rejected':
      return 'Declined';
    default:
      return status;
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

function ApplicationsSection({
  shiftId,
  onBookingCreated,
}: {
  shiftId: string;
  onBookingCreated?: () => void;
}) {
  const supabaseMode = isSupabaseBackendEnabled();
  const { run, isPending } = useProviderAction();
  const { data, error, loading, reload } = useAsyncResource(
    () =>
      supabaseMode
        ? listProviderShiftApplicants(shiftId)
        : Promise.resolve({
            ok: true as const,
            data: { shiftId, applicants: [], isReadOnly: true },
          }),
    [shiftId, supabaseMode],
  );

  if (!supabaseMode) {
    return null;
  }

  if (loading) {
    return (
      <Section title="Applications">
        <p className="text-sm text-[#607583]">Loading applications…</p>
      </Section>
    );
  }

  if (error) {
    return (
      <Section title="Applications">
        <p className="text-sm text-[#607583]">{error.message}</p>
      </Section>
    );
  }

  const applicants = data?.applicants ?? [];
  const hasAccepted = applicants.some(a => a.status === 'accepted');

  return (
    <Section title="Applications">
      <p className="mb-4 text-sm text-[#607583]">
        {hasAccepted
          ? 'Booking created. The worker sees this shift under Bookings.'
          : 'Review applications below. Accepting creates a booking and marks the shift booked.'}
      </p>
      {applicants.length === 0 ? (
        <p className="text-sm text-[#607583]">No applications yet.</p>
      ) : (
        <ul className="space-y-3">
          {applicants.map(applicant => (
            <li
              key={applicant.requestId}
              className="rounded-xl border border-[#DDE7E8] bg-[#F7FAFA] p-4"
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
                <StatusBadge variant={applicant.status === 'requested' ? 'pending' : 'covered'}>
                  {formatApplicantStatus(applicant.status)}
                </StatusBadge>
              </div>
              {formatSubmittedAt(applicant.submittedAt) ? (
                <p className="mt-2 text-xs text-[#607583]">
                  Submitted {formatSubmittedAt(applicant.submittedAt)}
                </p>
              ) : null}
              {applicant.status === 'requested' ? (
                <button
                  type="button"
                  disabled={hasAccepted || isPending(`accept-${applicant.requestId}`)}
                  onClick={async () => {
                    const r = await run(`accept-${applicant.requestId}`, () =>
                      acceptProviderShiftApplicant(applicant.requestId),
                    );
                    if (r.ok) {
                      toast.success(r.data.message);
                      reload();
                      onBookingCreated?.();
                    } else {
                      toast.error(r.error.message);
                    }
                  }}
                  className="mt-3 w-full rounded-lg bg-[#53B59F] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2F8E7A] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending(`accept-${applicant.requestId}`)
                    ? 'Accepting…'
                    : hasAccepted
                      ? 'Shift booked'
                      : 'Accept & create booking'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="mt-3 w-full rounded-lg border border-[#DDE7E8] bg-white px-3 py-2 text-sm font-semibold text-[#607583] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {applicant.status === 'accepted' ? 'Booked' : 'No action'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
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
              Coverage is assigned via the Applications section above. Worker profile links from
              bookings are not wired yet.
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
              No worker assigned yet. Review applications above, or use Find worker for simulated
              recommendations.
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
