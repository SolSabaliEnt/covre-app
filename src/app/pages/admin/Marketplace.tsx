import { Link } from 'react-router';
import { StatusBadge } from '../../components/StatusBadge';
import { Activity, AlertTriangle, Users, TrendingUp } from 'lucide-react';
import { getAdminMarketplaceView } from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';

const METRIC_STYLES = [
  { Icon: AlertTriangle, box: 'bg-[#FDEAEA]', icon: 'text-[#D94A4A]' },
  { Icon: Users, box: 'bg-[#E6F6F2]', icon: 'text-[#53B59F]' },
  { Icon: Activity, box: 'bg-[#E8EEF2]', icon: 'text-[#13334F]' },
  { Icon: TrendingUp, box: 'bg-[#E6F6F2]', icon: 'text-[#53B59F]' },
] as const;

function LoadingBlock() {
  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
        <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
      </div>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
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

export default function AdminMarketplace() {
  const { data, error, loading, reload } = useAsyncResource(() => getAdminMarketplaceView(), []);

  if (loading) {
    return (
      <>
        <div className="border-b border-[#DDE7E8] bg-white p-6">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-3xl font-semibold text-[#13334F]">Marketplace Command Center</h1>
          </div>
        </div>
        <LoadingBlock />
      </>
    );
  }
  if (error) {
    return (
      <>
        <div className="border-b border-[#DDE7E8] bg-white p-6">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-3xl font-semibold text-[#13334F]">Marketplace Command Center</h1>
          </div>
        </div>
        <ErrorBlock message={error.message} onRetry={reload} />
      </>
    );
  }
  if (!data) {
    return <LoadingBlock />;
  }

  const { metrics: adminMetrics, urgentShifts, workers } = data;
  const workerAvailability = workers.slice(0, 3);

  return (
    <>
      <div className="bg-white border-b border-[#DDE7E8] p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-semibold text-[#13334F]">Marketplace Command Center</h1>
          <p className="text-[#607583] mt-1">Live view of platform activity</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {adminMetrics.map((m, i) => {
            const style = METRIC_STYLES[i] ?? METRIC_STYLES[2];
            const Icon = style.Icon;
            return (
              <div key={m.label} className="bg-white rounded-xl border border-[#DDE7E8] p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${style.box}`}>
                    <Icon className={`w-6 h-6 ${style.icon}`} />
                  </div>
                </div>
                <div className="text-3xl font-semibold text-[#13334F]">{m.value}</div>
                <div className="text-sm text-[#607583]">{m.label}</div>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-xl border border-[#DDE7E8] p-6">
          <h2 className="text-xl font-semibold text-[#13334F] mb-4">At-Risk Shifts (Next 24 Hours)</h2>
          <div className="space-y-3">
            {urgentShifts.map(shift => (
              <div
                key={shift.id}
                className="flex max-w-full flex-wrap items-center justify-between gap-4 overflow-hidden rounded-lg border border-[#D94A4A] bg-[#FDEAEA] p-4"
              >
                <Link
                  to={`/admin/shifts/${shift.id}`}
                  className="min-w-0 flex-1 rounded-md outline-none ring-[#53B59F] transition-colors focus-visible:ring-2"
                >
                  <div className="font-semibold text-[#13334F]">
                    {shift.providerName} — {shift.siteName}
                  </div>
                  <div className="text-sm text-[#607583]">
                    {shift.roleTitle} • {shift.dateLabel} {shift.timeRange}
                  </div>
                </Link>
                <div className="flex shrink-0 flex-wrap items-center gap-4">
                  <div className="text-right">
                    <div className="font-semibold text-[#13334F]">{shift.hourlyPayDisplay}</div>
                    <StatusBadge variant="urgent">Urgent</StatusBadge>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg bg-[#53B59F] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
                  >
                    Find Match
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE7E8] p-6">
          <h2 className="text-xl font-semibold text-[#13334F] mb-4">High-Availability Workers</h2>
          <div className="space-y-3">
            {workerAvailability.map(worker => (
              <div
                key={worker.id}
                className="flex items-center justify-between p-4 bg-[#F3FBF8] border border-[#E6F6F2] rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#53B59F] rounded-full flex items-center justify-center text-white font-semibold">
                    {worker.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')}
                  </div>
                  <div>
                    <div className="font-semibold text-[#13334F]">{worker.name}</div>
                    <div className="text-sm text-[#607583]">
                      {worker.primaryRole} • Score: {worker.covreScore}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-[#607583]">
                      Available {worker.availabilityNote ?? '—'}
                    </div>
                    <div className="font-medium text-[#13334F]">
                      {worker.openShiftsWilling ?? 0} shifts open
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-[#E8EEF2] text-[#13334F] rounded-lg hover:bg-[#DDE7E8] transition-colors font-medium">
                    Invite
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
