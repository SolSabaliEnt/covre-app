import { Link } from 'react-router';
import {
  Users,
  Building2,
  Calendar,
  ClipboardCheck,
  FileText,
  Shield,
  LifeBuoy,
  AlertTriangle,
} from 'lucide-react';
import { getAdminMarketplaceDashboard } from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import type { AdminMarketplaceSummary } from '../../services/types';

const mockMetrics = [
  { label: 'GMV', value: '$487,320', change: '+12.3% vs last month' },
  { label: 'Revenue', value: '$73,098', change: '+12.3% vs last month' },
  { label: 'Fill Rate', value: '94.2%', change: '+2.1% vs last month' },
  { label: 'Active Workers', value: '1,247', change: '+43 this week' },
  { label: 'Active Providers', value: '87', change: '+5 this week' },
  { label: 'Open Urgent Shifts', value: '23', change: 'Across 12 facilities' },
];

function summaryCards(summary: AdminMarketplaceSummary) {
  return [
    { label: 'Providers', value: String(summary.providerCount), icon: Building2 },
    { label: 'Workers', value: String(summary.workerCount), icon: Users },
    { label: 'Open shifts', value: String(summary.openShiftCount), icon: Calendar },
    { label: 'Booked shifts', value: String(summary.bookedShiftCount), icon: Calendar },
    { label: 'Bookings', value: String(summary.bookingCount), icon: ClipboardCheck },
    {
      label: 'Submitted timesheets',
      value: String(summary.submittedTimesheetCount),
      icon: ClipboardCheck,
    },
    {
      label: 'Approved timesheets',
      value: String(summary.approvedTimesheetCount),
      icon: ClipboardCheck,
    },
    { label: 'Draft invoices', value: String(summary.invoiceDraftCount), icon: FileText },
    {
      label: 'Compliance packets',
      value: String(summary.compliancePacketCount),
      icon: Shield,
    },
    { label: 'Support tickets', value: String(summary.supportTicketCount), icon: LifeBuoy },
    {
      label: 'Credentials to review',
      value: String(summary.credentialReviewCount),
      icon: AlertTriangle,
      warn: summary.credentialReviewCount > 0,
    },
  ];
}

function MockDashboardView() {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockMetrics.map(metric => (
          <div key={metric.label} className="bg-white rounded-xl border border-[#DDE7E8] p-6">
            <div className="text-3xl font-semibold text-[#13334F] mb-1">{metric.value}</div>
            <div className="text-sm text-[#607583]">{metric.label}</div>
            <div className="text-xs text-[#53B59F] mt-2">{metric.change}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[#DDE7E8] p-6">
          <h2 className="text-xl font-semibold text-[#13334F] mb-4">Action Required</h2>
          <p className="text-sm text-[#607583]">Simulated ops queue — other admin pages remain demo data.</p>
        </div>
        <div className="bg-white rounded-xl border border-[#DDE7E8] p-6">
          <h2 className="text-xl font-semibold text-[#13334F] mb-4">Platform Health</h2>
          <p className="text-sm text-[#607583]">Demo metrics only in mock mode.</p>
        </div>
      </div>
    </>
  );
}

function SupabaseDashboardView() {
  const { data, error, loading, reload } = useAsyncResource(
    () => getAdminMarketplaceDashboard(),
    [],
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-[#DDE7E8] bg-white p-8 text-center text-sm text-[#607583]">
        Loading marketplace overview…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[#DDE7E8] bg-white p-8">
        <p className="text-center text-sm text-[#607583]">{error.message}</p>
        <button
          type="button"
          onClick={reload}
          className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const cards = summaryCards(data.summary);
  const allZero = Object.values(data.summary).every(v => v === 0);

  return (
    <>
      <p className="rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm leading-relaxed text-[#607583]">
        Admin Supabase dashboard is read-only. Sensitive actions require audited RPC/Edge workflows.
        Other admin pages still use demo data until wired.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl border border-[#DDE7E8] p-5">
              <div className="mb-3 flex items-center gap-2">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    card.warn ? 'bg-[#FFF4E0]' : 'bg-[#E8EEF2]'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${card.warn ? 'text-[#9B6419]' : 'text-[#13334F]'}`} />
                </div>
              </div>
              <div className="text-2xl font-semibold text-[#13334F]">{card.value}</div>
              <div className="mt-1 text-sm text-[#607583]">{card.label}</div>
            </div>
          );
        })}
      </div>

      {allZero && (
        <p className="text-center text-sm text-[#607583]">
          No marketplace records yet, or admin read policies (0016) are not applied on this project.
        </p>
      )}

      <div className="bg-white rounded-xl border border-[#DDE7E8] p-6">
        <h2 className="text-xl font-semibold text-[#13334F] mb-4">Recent activity</h2>
        {data.activity.length === 0 ? (
          <p className="text-sm text-[#607583]">No recent shifts, bookings, timesheets, or tickets.</p>
        ) : (
          <ul className="divide-y divide-[#DDE7E8]">
            {data.activity.map(row => (
              <li key={`${row.type}-${row.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#9AAAB3]">
                    {row.type}
                  </p>
                  <p className="font-medium text-[#13334F]">{row.label}</p>
                  <p className="text-sm text-[#607583]">
                    {row.status}
                    {row.createdAt ? ` · ${row.createdAt}` : ''}
                  </p>
                </div>
                {row.href ? (
                  <Link
                    to={row.href}
                    className="shrink-0 text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A]"
                  >
                    View
                  </Link>
                ) : (
                  <span className="text-xs text-[#9AAAB3]">Read-only</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default function AdminDashboard() {
  const supabaseMode = isSupabaseBackendEnabled();

  return (
    <>
      <div className="bg-white border-b border-[#DDE7E8] p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-semibold text-[#13334F]">Admin Overview</h1>
          <p className="text-[#607583] mt-1">
            {supabaseMode ? 'Marketplace visibility (read-only)' : 'Platform operations and metrics'}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {supabaseMode ? <SupabaseDashboardView /> : <MockDashboardView />}
      </div>
    </>
  );
}
