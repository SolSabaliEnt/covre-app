import { StatusBadge } from '../../components/StatusBadge';
import { ShiftCard } from '../../components/ShiftCard';
import { Link } from 'react-router';
import { Filter, Search } from 'lucide-react';
import { listProviderShifts } from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';

function statusToBadge(shift: { providerBoardStatus: string }) {
  if (shift.providerBoardStatus === 'covered') {
    return { variant: 'covered' as const, label: 'Covered' };
  }
  if (shift.providerBoardStatus === 'urgent') {
    return { variant: 'urgent' as const, label: 'Urgent' };
  }
  return { variant: 'pending' as const, label: 'Pending' };
}

function LoadingBlock() {
  return (
    <div className="mx-auto w-full max-w-full min-w-0 rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-full min-w-0 rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm text-[#607583]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0B243A]"
      >
        Retry
      </button>
    </div>
  );
}

export default function ShiftManagement() {
  const { data: shifts, error, loading, reload } = useAsyncResource(() => listProviderShifts(), []);

  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto w-full max-w-full min-w-0 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold text-[#13334F]">Shift Management</h1>
            <p className="mt-1 text-sm text-[#607583]">Manage and track all shifts</p>
          </div>
          <Link
            to="/provider/post-shift"
            className="w-full shrink-0 rounded-lg bg-[#53B59F] px-5 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-[#2F8E7A] sm:w-auto sm:text-base"
          >
            Post New Shift
          </Link>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#607583]" aria-hidden />
            <input
              type="search"
              placeholder="Search shifts..."
              className="w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-white py-3 pl-10 pr-4 text-[#13334F] focus:border-[#53B59F] focus:outline-none focus:ring-2 focus:ring-[#53B59F]/25"
            />
          </div>
          <button
            type="button"
            className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#DDE7E8] bg-white px-5 py-3 hover:bg-[#F7FAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
          >
            <Filter className="h-5 w-5" aria-hidden />
            Filters
          </button>
        </div>

        {loading && <LoadingBlock />}
        {error && <ErrorBlock message={error.message} onRetry={reload} />}

        {!loading && !error && shifts && shifts.length === 0 && (
          <div className="mx-auto w-full min-w-0 max-w-full rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
            <p className="text-center text-sm leading-relaxed text-[#607583]">
              No shifts yet. Post your first shift to start filling coverage.
            </p>
            <Link
              to="/provider/post-shift"
              className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#2F8E7A]"
            >
              Post New Shift
            </Link>
          </div>
        )}

        {!loading && !error && shifts && shifts.length > 0 && (
          <>
            <div className="space-y-4 md:hidden">
              {shifts.map(shift => (
                <ShiftCard
                  key={shift.id}
                  title={shift.roleTitle}
                  facility={shift.siteName}
                  dateTime={`${shift.dateLabel}, ${shift.timeRange}`}
                  worker={shift.assignedWorkerName ?? undefined}
                  workerProfileTo={
                    shift.assignedWorkerId
                      ? `/provider/workers/${shift.assignedWorkerId}`
                      : undefined
                  }
                  status={statusToBadge(shift)}
                >
                  <div className="mt-3 flex flex-wrap gap-4 border-t border-[#DDE7E8] pt-3">
                    <Link
                      to={`/provider/shifts/${shift.id}`}
                      className="text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
                    >
                      View shift
                    </Link>
                    {!shift.assignedWorkerId ? (
                      <Link
                        to={`/provider/worker-match/${shift.id}`}
                        className="text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
                      >
                        Find Worker
                      </Link>
                    ) : (
                      <Link
                        to={`/provider/workers/${shift.assignedWorkerId}`}
                        className="text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
                      >
                        View worker
                      </Link>
                    )}
                  </div>
                </ShiftCard>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-[#DDE7E8] bg-white md:block">
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
                  <tr>
                    <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Site</th>
                    <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Role</th>
                    <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Time</th>
                    <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Worker</th>
                    <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Status</th>
                    <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map(shift => (
                    <tr key={shift.id} className="border-b border-[#DDE7E8] hover:bg-[#F7FAFA]">
                      <td className="p-4 font-medium text-[#13334F]">{shift.siteName}</td>
                      <td className="p-4 text-[#607583]">{shift.roleTitle}</td>
                      <td className="p-4 text-sm text-[#607583]">
                        {shift.dateLabel}, {shift.timeRange}
                      </td>
                      <td className="p-4">
                        {shift.assignedWorkerId ? (
                          <Link
                            to={`/provider/workers/${shift.assignedWorkerId}`}
                            className="font-medium text-[#13334F] underline-offset-2 hover:text-[#53B59F] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
                          >
                            {shift.assignedWorkerName}
                          </Link>
                        ) : (
                          <span className="italic text-[#9AAAB3]">Not assigned</span>
                        )}
                      </td>
                      <td className="p-4">
                        <StatusBadge variant={shift.providerBoardStatus}>
                          {shift.providerBoardStatus === 'covered' && 'Covered'}
                          {shift.providerBoardStatus === 'urgent' && 'Urgent'}
                          {shift.providerBoardStatus === 'pending' && 'Pending'}
                        </StatusBadge>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-3">
                          <Link
                            to={`/provider/shifts/${shift.id}`}
                            className="text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A]"
                          >
                            View shift
                          </Link>
                          {!shift.assignedWorkerId ? (
                            <Link
                              to={`/provider/worker-match/${shift.id}`}
                              className="text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A]"
                            >
                              Find Worker
                            </Link>
                          ) : (
                            <Link
                              to={`/provider/workers/${shift.assignedWorkerId}`}
                              className="text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
                            >
                              View worker
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
