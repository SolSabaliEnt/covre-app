import { Link } from 'react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { StatusBadge } from '../../components/StatusBadge';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  approveTimesheet,
  disputeTimesheet,
  getProviderTimesheetReadiness,
} from '../../services';
import type {
  ProviderTimesheetReadinessRow,
  ProviderTimesheetReviewRow,
} from '../../services/types';
import { useProviderAction } from '../../hooks/useProviderAction';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';

type TimesheetRow = {
  id: string;
  workerId: string;
  worker: string;
  site: string;
  role: string;
  date: string;
  scheduled: string;
  clocked: string;
  scheduledHours: number;
  clockedHours: number;
  breaks: number;
  status: 'pending' | 'approved' | 'disputed';
};

const INITIAL_TIMESHEETS: TimesheetRow[] = [
  {
    id: 'timesheet-001',
    workerId: 'worker-003',
    worker: 'Sarah Johnson',
    site: 'Oak Memory Care',
    role: 'CNA',
    date: 'May 13, 2026',
    scheduled: '6:00 AM - 2:00 PM',
    clocked: '6:02 AM - 2:05 PM',
    scheduledHours: 8,
    clockedHours: 8.05,
    breaks: 0.5,
    status: 'pending',
  },
  {
    id: 'timesheet-002',
    workerId: 'worker-002',
    worker: 'Mike Chen',
    site: 'Sunrise Group Home',
    role: 'DSP',
    date: 'May 13, 2026',
    scheduled: '3:00 PM - 11:00 PM',
    clocked: '3:05 PM - 11:02 PM',
    scheduledHours: 8,
    clockedHours: 7.95,
    breaks: 0.5,
    status: 'pending',
  },
  {
    id: 'timesheet-003',
    workerId: 'worker-004',
    worker: 'Jessica Martinez',
    site: 'Cedar Assisted Living',
    role: 'Med Aide',
    date: 'May 12, 2026',
    scheduled: '2:00 PM - 10:00 PM',
    clocked: '1:58 PM - 10:03 PM',
    scheduledHours: 8,
    clockedHours: 8.08,
    breaks: 0.5,
    status: 'approved',
  },
];

function badgeVariant(status: TimesheetRow['status']) {
  if (status === 'pending') return 'pending' as const;
  if (status === 'approved') return 'covered' as const;
  return 'urgent' as const;
}

function badgeLabel(status: TimesheetRow['status']) {
  if (status === 'pending') return 'Pending Approval';
  if (status === 'approved') return 'Approved';
  return 'Disputed';
}

function LoadingBlock() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-full rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-full rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm text-[#607583]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B243A]"
      >
        Retry
      </button>
    </div>
  );
}

function EmptyBlock({ supabase }: { supabase?: boolean }) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-full rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm font-medium text-[#13334F]">
        {supabase ? 'No booked shifts yet' : 'No shifts yet'}
      </p>
      <p className="mt-2 text-center text-sm text-[#607583]">
        {supabase
          ? 'No booked shifts are ready for timesheets yet. Accept an applicant to create a booking, then clock events and worker submission will appear here.'
          : 'Post a shift to see timesheet readiness here. Approvals require worker bookings, clock events, and submitted timesheets.'}
      </p>
    </div>
  );
}

function MockTimesheetsView() {
  const [rows, setRows] = useState<TimesheetRow[]>(INITIAL_TIMESHEETS);
  const { run, isPending } = useProviderAction();

  const pendingCount = rows.filter(r => r.status === 'pending').length;

  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto w-full min-w-0 max-w-full space-y-6">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-[#13334F]">Timesheet Approval</h1>
          <p className="mt-1 text-sm text-[#607583]">Review and approve completed shifts</p>
        </div>

        {pendingCount > 0 ? (
          <div className="flex flex-col gap-2 rounded-xl border border-[#F4A83D] bg-[#FFF4E0] p-4 sm:flex-row sm:items-center sm:gap-3">
            <Clock className="h-5 w-5 shrink-0 text-[#9B6419]" />
            <div>
              <div className="font-semibold text-[#9B6419]">
                {pendingCount} timesheet{pendingCount === 1 ? '' : 's'} awaiting approval
              </div>
              <div className="text-sm text-[#9B6419]">Please review and approve to process payments</div>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          {rows.map(timesheet => (
            <div key={timesheet.id} className="rounded-xl border border-[#DDE7E8] bg-white p-4 sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="break-words text-lg font-semibold text-[#13334F] sm:text-xl">
                      <Link
                        to={`/provider/workers/${timesheet.workerId}`}
                        className="text-[#13334F] no-underline hover:text-[#53B59F] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
                      >
                        {timesheet.worker}
                      </Link>
                    </h3>
                    <StatusBadge variant={badgeVariant(timesheet.status)}>{badgeLabel(timesheet.status)}</StatusBadge>
                  </div>
                  <div className="text-[#607583]">
                    {timesheet.role} • {timesheet.site}
                  </div>
                  <div className="text-sm text-[#607583]">{timesheet.date}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {timesheet.status === 'approved' && <CheckCircle2 className="h-6 w-6 text-[#53B59F]" />}
                  {timesheet.status === 'pending' && <AlertCircle className="h-6 w-6 text-[#F4A83D]" />}
                  {timesheet.status === 'disputed' && <AlertCircle className="h-6 w-6 text-[#A93636]" />}
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-4 rounded-lg bg-[#F7FAFA] p-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <div className="mb-1 text-sm text-[#607583]">Scheduled Hours</div>
                  <div className="font-semibold text-[#13334F]">{timesheet.scheduled}</div>
                  <div className="mt-1 text-sm text-[#607583]">{timesheet.scheduledHours} hours</div>
                </div>
                <div className="min-w-0">
                  <div className="mb-1 text-sm text-[#607583]">Clocked Hours</div>
                  <div className="font-semibold text-[#13334F]">{timesheet.clocked}</div>
                  <div className="mt-1 text-sm text-[#607583]">
                    {timesheet.clockedHours} hours (incl. {timesheet.breaks}h break)
                  </div>
                </div>
              </div>

              {timesheet.status === 'pending' && (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    disabled={isPending(`approve-${timesheet.id}`)}
                    onClick={async e => {
                      e.stopPropagation();
                      const r = await run(`approve-${timesheet.id}`, () => approveTimesheet(timesheet.id));
                      if (r.ok) {
                        toast.success(r.data.message);
                        setRows(prev =>
                          prev.map(row => (row.id === timesheet.id ? { ...row, status: 'approved' } : row)),
                        );
                      } else toast.error(r.error.message);
                    }}
                    className="w-full rounded-lg bg-[#53B59F] px-6 py-3 font-medium text-white transition-colors hover:bg-[#2F8E7A] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
                  >
                    Approve Timesheet
                  </button>
                  <button
                    type="button"
                    disabled={isPending(`dispute-${timesheet.id}`)}
                    onClick={async e => {
                      e.stopPropagation();
                      const r = await run(`dispute-${timesheet.id}`, () =>
                        disputeTimesheet(timesheet.id, 'Hours mismatch'),
                      );
                      if (r.ok) {
                        toast.success(r.data.message);
                        setRows(prev =>
                          prev.map(row => (row.id === timesheet.id ? { ...row, status: 'disputed' } : row)),
                        );
                      } else toast.error(r.error.message);
                    }}
                    className="w-full rounded-lg border border-[#DDE7E8] bg-white px-6 py-3 font-medium text-[#13334F] transition-colors hover:bg-[#F7FAFA] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    Dispute
                  </button>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      toast.message('Edit hours opens here (demo)');
                    }}
                    className="w-full rounded-lg bg-[#E8EEF2] px-6 py-3 font-medium text-[#13334F] transition-colors hover:bg-[#DDE7E8] sm:w-auto"
                  >
                    Edit Hours
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SupabaseTimesheetsView() {
  const { data: summary, error, loading, reload } = useAsyncResource(
    () => getProviderTimesheetReadiness(),
    [],
  );

  return (
    <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 pb-8">
      <div className="mx-auto w-full min-w-0 max-w-full space-y-6">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-[#13334F]">Timesheet Approval</h1>
          <p className="mt-1 text-sm text-[#607583]">
            Review worker-submitted timesheets — approve or dispute when migration 0013 is applied.
          </p>
          <p className="mt-3 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm leading-relaxed text-[#607583]">
            Workers record clock events and submit timesheets after clock-out. Approved timesheets
            feed billing and compliance readiness. Payroll export and invoice generation are not
            connected yet.
          </p>
        </div>

        {loading && <LoadingBlock />}
        {error && <ErrorBlock message={error.message} onRetry={reload} />}

        {!loading && !error && summary && (
          <>
            {summary.pendingCount > 0 ? (
              <div className="flex flex-col gap-2 rounded-xl border border-[#F4A83D] bg-[#FFF4E0] p-4 sm:flex-row sm:items-center sm:gap-3">
                <Clock className="h-5 w-5 shrink-0 text-[#9B6419]" aria-hidden />
                <div>
                  <div className="font-semibold text-[#9B6419]">
                    {summary.pendingCount} booking{summary.pendingCount === 1 ? '' : 's'} awaiting
                    timesheet workflow
                  </div>
                  <div className="text-sm text-[#9B6419]">
                    Bookings still need clock events or worker submission
                  </div>
                </div>
              </div>
            ) : null}

            {summary.submittedRows.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-xl border border-[#53B59F] bg-[#E6F6F2] p-4 sm:flex-row sm:items-center sm:gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2F8E7A]" aria-hidden />
                <div>
                  <div className="font-semibold text-[#13334F]">
                    {summary.submittedRows.length} submitted timesheet
                    {summary.submittedRows.length === 1 ? '' : 's'}
                  </div>
                  <div className="text-sm text-[#607583]">
                    Awaiting facility review
                  </div>
                </div>
              </div>
            ) : null}

            {summary.submittedRows.length === 0 &&
              summary.approvedRows.length === 0 &&
              summary.disputedRows.length === 0 &&
              summary.rows.length === 0 && <EmptyBlock supabase />}

            {summary.submittedRows.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-[#13334F]">Submitted</h2>
                {summary.submittedRows.map(row => (
                  <SubmittedTimesheetCard key={row.timesheetId} row={row} onUpdated={reload} />
                ))}
              </div>
            )}

            {summary.approvedRows.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-[#13334F]">Approved</h2>
                {summary.approvedRows.map(row => (
                  <ReviewedTimesheetCard key={row.timesheetId} row={row} variant="approved" />
                ))}
              </div>
            )}

            {summary.disputedRows.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-[#13334F]">Disputed</h2>
                {summary.disputedRows.map(row => (
                  <ReviewedTimesheetCard key={row.timesheetId} row={row} variant="disputed" />
                ))}
              </div>
            )}

            {summary.rows.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-[#13334F]">Awaiting submission</h2>
                {summary.rows.map(row => (
                  <ReadinessTimesheetCard key={row.id} row={row} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SubmittedTimesheetCard({
  row,
  onUpdated,
}: {
  row: ProviderTimesheetReviewRow;
  onUpdated: () => void;
}) {
  const { run, isPending } = useProviderAction();

  return (
    <article className="rounded-xl border border-[#53B59F] bg-white p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="break-words text-lg font-semibold text-[#13334F] sm:text-xl">
              <Link
                to={`/provider/workers/${row.workerId}`}
                className="text-[#13334F] no-underline hover:text-[#53B59F] hover:underline"
              >
                {row.workerName}
              </Link>
            </h3>
            <StatusBadge variant="pending">Submitted</StatusBadge>
          </div>
          <div className="text-[#607583]">
            {row.shiftTitle} · {row.siteName}
          </div>
          <div className="text-sm text-[#607583]">{row.shiftDate}</div>
        </div>
        <CheckCircle2 className="h-6 w-6 shrink-0 text-[#53B59F]" aria-hidden />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 rounded-lg bg-[#F7FAFA] p-4 sm:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-1 text-sm text-[#607583]">Hours worked</div>
          <div className="font-semibold text-[#13334F]">{row.hours} hours</div>
        </div>
        <div className="min-w-0">
          <div className="mb-1 text-sm text-[#607583]">Submitted</div>
          <div className="font-semibold text-[#13334F]">
            {row.submittedAt
              ? new Date(row.submittedAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : '—'}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={isPending(`approve-${row.timesheetId}`)}
          onClick={async () => {
            const r = await run(`approve-${row.timesheetId}`, () => approveTimesheet(row.timesheetId));
            if (r.ok) {
              toast.success(r.data.message);
              onUpdated();
            } else toast.error(r.error.message);
          }}
          className="w-full rounded-lg bg-[#53B59F] px-6 py-3 font-medium text-white transition-colors hover:bg-[#2F8E7A] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={isPending(`dispute-${row.timesheetId}`)}
          onClick={async () => {
            const r = await run(`dispute-${row.timesheetId}`, () =>
              disputeTimesheet(row.timesheetId, 'Hours or time mismatch'),
            );
            if (r.ok) {
              toast.success(r.data.message);
              onUpdated();
            } else toast.error(r.error.message);
          }}
          className="w-full rounded-lg border border-[#DDE7E8] bg-white px-6 py-3 font-medium text-[#13334F] transition-colors hover:bg-[#F7FAFA] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          Dispute
        </button>
      </div>
    </article>
  );
}

function ReviewedTimesheetCard({
  row,
  variant,
}: {
  row: ProviderTimesheetReviewRow;
  variant: 'approved' | 'disputed';
}) {
  const isApproved = variant === 'approved';
  return (
    <article
      className={`rounded-xl border bg-white p-4 sm:p-6 ${
        isApproved ? 'border-[#53B59F]' : 'border-[#F4A83D]'
      }`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="break-words text-lg font-semibold text-[#13334F] sm:text-xl">
              <Link
                to={`/provider/workers/${row.workerId}`}
                className="text-[#13334F] no-underline hover:text-[#53B59F] hover:underline"
              >
                {row.workerName}
              </Link>
            </h3>
            <StatusBadge variant={isApproved ? 'covered' : 'pending'}>
              {isApproved ? 'Approved' : 'Disputed'}
            </StatusBadge>
          </div>
          <div className="text-[#607583]">
            {row.shiftTitle} · {row.siteName}
          </div>
          <div className="text-sm text-[#607583]">{row.shiftDate}</div>
        </div>
        {isApproved ? (
          <CheckCircle2 className="h-6 w-6 shrink-0 text-[#53B59F]" aria-hidden />
        ) : (
          <AlertCircle className="h-6 w-6 shrink-0 text-[#F4A83D]" aria-hidden />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg bg-[#F7FAFA] p-4 sm:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-1 text-sm text-[#607583]">Hours worked</div>
          <div className="font-semibold text-[#13334F]">{row.hours} hours</div>
        </div>
        <div className="min-w-0">
          <div className="mb-1 text-sm text-[#607583]">
            {isApproved ? 'Approved' : 'Submitted'}
          </div>
          <div className="font-semibold text-[#13334F]">
            {isApproved && row.approvedAt
              ? new Date(row.approvedAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : row.submittedAt
                ? new Date(row.submittedAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : '—'}
          </div>
        </div>
      </div>
    </article>
  );
}

function ReadinessTimesheetCard({ row }: { row: ProviderTimesheetReadinessRow }) {
  return (
    <article className="rounded-xl border border-[#DDE7E8] bg-white p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="break-words text-lg font-semibold text-[#13334F] sm:text-xl">
              {row.workerId ? (
                <Link
                  to={`/provider/workers/${row.workerId}`}
                  className="text-[#13334F] no-underline hover:text-[#53B59F] hover:underline"
                >
                  {row.workerName?.trim() || 'Booked worker'}
                </Link>
              ) : (
                row.workerName?.trim() || row.shiftTitle
              )}
            </h3>
            <StatusBadge variant="pending">{row.statusLabel}</StatusBadge>
          </div>
          <div className="text-[#607583]">
            {row.shiftTitle} · {row.siteName}
          </div>
          <div className="text-sm text-[#607583]">{row.shiftDate}</div>
          <p className="mt-1 text-xs text-[#9AAAB3]">
            Booking readiness · no clock events or submitted timesheet yet
          </p>
        </div>
        <AlertCircle className="h-6 w-6 shrink-0 text-[#F4A83D]" aria-hidden />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 rounded-lg bg-[#F7FAFA] p-4 sm:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-1 text-sm text-[#607583]">Scheduled</div>
          <div className="font-semibold text-[#13334F]">{row.shiftDate}</div>
          <div className="mt-1 text-sm text-[#607583]">From booking · hours not clocked</div>
        </div>
        <div className="min-w-0">
          <div className="mb-1 text-sm text-[#607583]">Clocked</div>
          <div className="font-semibold text-[#13334F]">No clock events</div>
          <div className="mt-1 text-sm text-[#607583]">Awaiting worker clock-in/out</div>
        </div>
      </div>

      {row.missingItems && row.missingItems.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#607583]">
            Required before approval
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-[#10283D]">
            {row.missingItems.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled
          title="Timesheet approval will be connected after bookings and clock events are wired"
          onClick={() => {
            toast.message(
              'Timesheet approval will be connected after bookings and clock events are wired.',
            );
          }}
          className="w-full cursor-not-allowed rounded-lg bg-[#53B59F] px-6 py-3 font-medium text-white opacity-60 sm:flex-1"
        >
          Approve (prep)
        </button>
        <button
          type="button"
          disabled
          title="Timesheet dispute workflow will be connected after bookings and clock events are wired"
          onClick={() => {
            toast.message(
              'Timesheet dispute workflow will be connected after bookings and clock events are wired.',
            );
          }}
          className="w-full cursor-not-allowed rounded-lg border border-[#DDE7E8] bg-white px-6 py-3 font-medium text-[#13334F] opacity-60 sm:w-auto"
        >
          Dispute (prep)
        </button>
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-lg bg-[#E8EEF2] px-6 py-3 font-medium text-[#9AAAB3] sm:w-auto"
          title="Edit hours requires submitted timesheets"
        >
          Edit hours (coming soon)
        </button>
      </div>
    </article>
  );
}

export default function Timesheets() {
  if (isSupabaseBackendEnabled()) {
    return <SupabaseTimesheetsView />;
  }
  return <MockTimesheetsView />;
}
