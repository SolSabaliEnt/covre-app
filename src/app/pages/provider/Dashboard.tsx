import { StatusBadge } from '../../components/StatusBadge';
import { Link } from 'react-router';
import { TrendingUp, DollarSign, Clock, AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import { getProviderDashboard } from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';

function LoadingBlock() {
  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto w-full min-w-0 max-w-full rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
        <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
      </div>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
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
    </div>
  );
}

export default function ProviderDashboard() {
  const { data, error, loading, reload } = useAsyncResource(() => getProviderDashboard(), []);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error.message} onRetry={reload} />;
  if (!data) return <LoadingBlock />;

  const { prov, todaysCoverage, urgentShifts, workersOnShift, firstUrgentShiftId } = data;

  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto w-full min-w-0 max-w-full space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold text-[#13334F]">Dashboard</h1>
            <p className="mt-1 text-sm text-[#607583]">Welcome back, {prov.name}</p>
          </div>
          <Link
            to="/provider/post-shift"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#53B59F] px-6 py-3 font-medium text-white transition-colors hover:bg-[#2F8E7A]"
          >
            <Plus className="h-5 w-5" />
            Post Shift
          </Link>
        </div>

        {/* Metrics — stacked on mobile */}
        <div className="grid grid-cols-1 gap-4">
          <MetricCard
            icon={<AlertCircle className="h-6 w-6" />}
            label="Open Shifts"
            value="8"
            change="-2 from yesterday"
            positive
          />
          <MetricCard
            icon={<CheckCircle2 className="h-6 w-6" />}
            label="Covered Shifts"
            value="42"
            change="This week"
          />
          <MetricCard
            icon={<TrendingUp className="h-6 w-6" />}
            label="Fill Rate"
            value="94.2%"
            change="+2.1% this month"
            positive
          />
          <MetricCard
            icon={<DollarSign className="h-6 w-6" />}
            label="This Week's Spend"
            value="$12,480"
            change="42 shifts"
          />
        </div>

        {/* Today's Coverage */}
        <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
          <h2 className="mb-4 text-lg font-semibold text-[#13334F]">Today's Coverage</h2>
          <div className="space-y-3">
            {todaysCoverage.map((shift, index) => (
              <div
                key={index}
                className="flex flex-col gap-3 rounded-lg bg-[#F7FAFA] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E6F6F2]">
                    <CheckCircle2 className="h-5 w-5 text-[#257665]" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[#13334F]">{shift.site}</div>
                    <div className="text-sm text-[#607583]">
                      {shift.shift} • {shift.time}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <div className="truncate font-medium text-[#13334F]">{shift.worker}</div>
                  <StatusBadge variant="covered">Covered</StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Urgent Open Shifts */}
        <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[#13334F]">Urgent Open Shifts</h2>
            <Link to="/provider/shifts" className="shrink-0 text-sm text-[#53B59F] hover:text-[#2F8E7A]">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {urgentShifts.map((shift, index) => (
              <div
                key={index}
                className="flex flex-col gap-2 rounded-lg border border-[#D94A4A] bg-[#FDEAEA] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[#13334F]">{shift.site}</div>
                  <div className="text-sm text-[#607583]">
                    {shift.shift} • {shift.time}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <div className="font-semibold text-[#13334F]">{shift.pay}</div>
                  <StatusBadge variant="urgent">Urgent</StatusBadge>
                </div>
              </div>
            ))}
          </div>
          <Link
            to={`/provider/worker-match/${firstUrgentShiftId}`}
            className="mt-4 block w-full rounded-lg bg-[#53B59F] px-4 py-3 text-center font-medium text-white transition-colors hover:bg-[#2F8E7A]"
          >
            Find Workers
          </Link>
        </div>

        {/* Workers Currently On Shift */}
        <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
          <h2 className="mb-4 text-lg font-semibold text-[#13334F]">Workers Currently On Shift</h2>
          <div className="space-y-3">
            {workersOnShift.map((worker, index) => (
              <div
                key={index}
                className="flex flex-col gap-3 rounded-lg border border-[#E6F6F2] bg-[#F3FBF8] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#53B59F] font-semibold text-white">
                    {worker.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[#13334F]">{worker.name}</div>
                    <div className="truncate text-sm text-[#607583]">
                      {worker.role} at {worker.site}
                    </div>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-sm text-[#607583]">Clocked in</div>
                  <div className="font-medium text-[#13334F]">{worker.clockedIn}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[#13334F]">Pending Approvals</h2>
            <Link to="/provider/timesheets" className="shrink-0 text-sm text-[#53B59F] hover:text-[#2F8E7A]">
              View all
            </Link>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-[#F4A83D] bg-[#FFF4E0] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Clock className="h-5 w-5 shrink-0 text-[#9B6419]" />
              <span className="font-medium text-[#13334F]">3 timesheets awaiting approval</span>
            </div>
            <Link
              to="/provider/timesheets"
              className="shrink-0 rounded-lg bg-[#F4A83D] px-4 py-2 text-center font-medium text-white transition-colors hover:bg-[#E09723]"
            >
              Review
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  change,
  positive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#E8EEF2] text-[#13334F]">
          {icon}
        </div>
      </div>
      <div className="mb-1 text-3xl font-semibold text-[#13334F]">{value}</div>
      <div className="text-sm text-[#607583]">{label}</div>
      {change && (
        <div className={`mt-2 text-xs ${positive ? 'text-[#53B59F]' : 'text-[#607583]'}`}>
          {change}
        </div>
      )}
    </div>
  );
}
