import { useMemo, useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { Link } from 'react-router';
import { AlertTriangle, Shield } from 'lucide-react';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import { listAdminIncidents, listAdminIncidentQueue } from '../../services';
import type { AdminIncidentRow, AdminIncidentSeverity, AdminIncidentStatus } from '../../services/types';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import type { Incident } from '../../data/types';

type SupabaseFilter = 'all' | 'open' | 'critical' | 'escalated' | 'safety';

function formatWhen(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function severityBadge(severity: AdminIncidentSeverity) {
  if (severity === 'critical' || severity === 'high') {
    return <StatusBadge variant="urgent">{severity}</StatusBadge>;
  }
  if (severity === 'medium') {
    return <StatusBadge variant="pending">medium</StatusBadge>;
  }
  return <StatusBadge variant="new">low</StatusBadge>;
}

function statusLabel(status: AdminIncidentStatus): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'under_review':
      return 'Under review';
    case 'awaiting_statement':
      return 'Awaiting statement';
    case 'resolved':
      return 'Resolved';
    case 'escalated':
      return 'Escalated';
    default:
      return status;
  }
}

function statusBadge(status: AdminIncidentStatus) {
  switch (status) {
    case 'resolved':
      return <StatusBadge variant="covered">{statusLabel(status)}</StatusBadge>;
    case 'under_review':
    case 'awaiting_statement':
      return <StatusBadge variant="pending">{statusLabel(status)}</StatusBadge>;
    case 'escalated':
      return <StatusBadge variant="urgent">{statusLabel(status)}</StatusBadge>;
    default:
      return <StatusBadge variant="new">{statusLabel(status)}</StatusBadge>;
  }
}

function SourceIcon({ row }: { row: AdminIncidentRow }) {
  if (row.source === 'safety_report') {
    return <Shield className="h-4 w-4 text-[#D94A4A]" aria-hidden />;
  }
  return <AlertTriangle className="h-4 w-4 text-[#F4A83D]" aria-hidden />;
}

function DisabledActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled
        className="cursor-not-allowed rounded-lg bg-[#E8EEF0] px-2.5 py-1 text-xs font-medium text-[#9AAAB3]"
        title="Audited triage RPCs coming in a future release"
      >
        Review soon
      </button>
      <button
        type="button"
        disabled
        className="cursor-not-allowed rounded-lg border border-[#DDE7E8] bg-white px-2.5 py-1 text-xs font-medium text-[#9AAAB3]"
        title="Audited triage RPCs coming in a future release"
      >
        Escalate soon
      </button>
      <button
        type="button"
        disabled
        className="cursor-not-allowed rounded-lg border border-[#DDE7E8] bg-white px-2.5 py-1 text-xs font-medium text-[#9AAAB3]"
        title="Audited triage RPCs coming in a future release"
      >
        Resolve soon
      </button>
    </div>
  );
}

const SUPABASE_FILTERS: { id: SupabaseFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'critical', label: 'Critical / high' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'safety', label: 'Safety reports' },
];

function filterSupabaseRows(rows: AdminIncidentRow[], filter: SupabaseFilter): AdminIncidentRow[] {
  if (filter === 'all') return rows;
  if (filter === 'open') return rows.filter(r => r.status === 'open');
  if (filter === 'critical') {
    return rows.filter(r => r.severity === 'critical' || r.severity === 'high');
  }
  if (filter === 'escalated') return rows.filter(r => r.status === 'escalated');
  return rows.filter(r => r.source === 'safety_report');
}

function MockIncidentsView() {
  const { data: incidents, error, loading, reload } = useAsyncResource(() => listAdminIncidents(), []);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
          <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
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

  if (!incidents) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 rounded-xl border border-[#D94A4A] bg-[#FDEAEA] p-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-[#A93636]" />
          <div>
            <div className="font-semibold text-[#A93636]">3 incidents require attention</div>
            <div className="text-sm text-[#A93636]">1 high severity, 2 pending resolution</div>
          </div>
        </div>
      </div>

      <MockIncidentTable incidents={incidents} />
    </div>
  );
}

function MockIncidentTable({ incidents }: { incidents: Incident[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#DDE7E8] bg-white">
      <table className="w-full">
        <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
          <tr>
            <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Type</th>
            <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Severity</th>
            <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Worker</th>
            <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Provider</th>
            <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Shift</th>
            <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Status</th>
            <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map(incident => (
            <tr key={incident.id} className="border-b border-[#DDE7E8] hover:bg-[#F7FAFA]">
              <td className="p-4">
                <div className="flex items-center gap-2">
                  {incident.type === 'Safety Report' && (
                    <Shield className="h-4 w-4 text-[#D94A4A]" />
                  )}
                  {incident.type !== 'Safety Report' && (
                    <AlertTriangle className="h-4 w-4 text-[#F4A83D]" />
                  )}
                  <span className="font-medium text-[#13334F]">{incident.type}</span>
                </div>
              </td>
              <td className="p-4">
                <StatusBadge variant={incident.severity === 'High' ? 'urgent' : 'pending'}>
                  {incident.severity}
                </StatusBadge>
              </td>
              <td className="p-4 text-[#607583]">{incident.workerName}</td>
              <td className="p-4 text-[#607583]">{incident.providerName}</td>
              <td className="p-4 text-sm text-[#607583]">{incident.shiftSummary}</td>
              <td className="p-4">
                <StatusBadge
                  variant={
                    incident.status === 'resolved'
                      ? 'covered'
                      : incident.status === 'under-review'
                        ? 'pending'
                        : 'urgent'
                  }
                >
                  {incident.status === 'under-review'
                    ? 'Under Review'
                    : incident.status === 'pending'
                      ? 'Pending'
                      : 'Resolved'}
                </StatusBadge>
              </td>
              <td className="p-4">
                <Link
                  to={`/admin/incidents/${incident.id}`}
                  className={`text-sm font-medium focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] ${
                    incident.status === 'resolved'
                      ? 'text-[#9AAAB3] hover:text-[#607583]'
                      : 'text-[#53B59F] hover:text-[#2F8E7A]'
                  }`}
                >
                  {incident.status === 'resolved' ? 'View record' : 'Review Details'}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SupabaseIncidentsView() {
  const [filter, setFilter] = useState<SupabaseFilter>('open');
  const { data, error, loading, reload } = useAsyncResource(() => listAdminIncidentQueue(), []);

  const filtered = useMemo(() => {
    if (!data?.rows) return [];
    return filterSupabaseRows(data.rows, filter);
  }, [data?.rows, filter]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <p className="text-sm text-[#607583]">Loading incident queue…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="rounded-xl border border-[#F4A83D] bg-[#FFF4E0] p-4">
          <p className="text-sm text-[#13334F]">{error.message}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-3 rounded-lg bg-[#13334F] px-3 py-2 text-sm font-medium text-white hover:bg-[#0B243A]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 rounded-xl border border-[#53B59F] bg-[#E6F6F2] p-4">
        <p className="text-sm leading-relaxed text-[#257665]">
          Incident triage is read-only in this pass. Status updates will be added through audited
          RPCs.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#607583]">Open</p>
          <p className="mt-1 text-2xl font-semibold text-[#13334F]">{data.openCount}</p>
        </div>
        <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#607583]">
            Critical / high
          </p>
          <p className="mt-1 text-2xl font-semibold text-[#A93636]">{data.criticalCount}</p>
        </div>
        <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#607583]">Escalated</p>
          <p className="mt-1 text-2xl font-semibold text-[#13334F]">{data.escalatedCount}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {SUPABASE_FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.id
                ? 'bg-[#13334F] text-white'
                : 'border border-[#DDE7E8] bg-white text-[#607583] hover:bg-[#F7FAFA]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#DDE7E8] bg-white">
        <table className="w-full">
          <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
            <tr>
              <th className="p-3 text-left text-sm font-semibold text-[#13334F]">Source</th>
              <th className="p-3 text-left text-sm font-semibold text-[#13334F]">Title</th>
              <th className="p-3 text-left text-sm font-semibold text-[#13334F]">Severity</th>
              <th className="p-3 text-left text-sm font-semibold text-[#13334F]">Status</th>
              <th className="p-3 text-left text-sm font-semibold text-[#13334F]">Worker</th>
              <th className="p-3 text-left text-sm font-semibold text-[#13334F]">Provider</th>
              <th className="p-3 text-left text-sm font-semibold text-[#13334F]">Shift</th>
              <th className="p-3 text-left text-sm font-semibold text-[#13334F]">Updated</th>
              <th className="p-3 text-left text-sm font-semibold text-[#13334F]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr key={`${row.source}-${row.id}`} className="border-b border-[#DDE7E8]">
                <td className="p-3">
                  <div className="flex items-center gap-2 text-sm text-[#607583]">
                    <SourceIcon row={row} />
                    {row.source === 'safety_report' ? 'Safety' : 'Incident'}
                  </div>
                </td>
                <td className="max-w-[200px] p-3">
                  <p className="font-medium text-[#13334F]">{row.title}</p>
                  {row.summary ? (
                    <p className="mt-0.5 truncate text-xs text-[#607583]">{row.summary}</p>
                  ) : null}
                </td>
                <td className="p-3">{severityBadge(row.severity)}</td>
                <td className="p-3">{statusBadge(row.status)}</td>
                <td className="p-3 text-sm text-[#607583]">{row.workerLabel ?? '—'}</td>
                <td className="p-3 text-sm text-[#607583]">{row.providerLabel ?? '—'}</td>
                <td className="max-w-[180px] p-3 text-sm text-[#607583]">
                  {row.shiftLabel ?? (row.shiftId ? row.shiftId.slice(0, 8) : '—')}
                </td>
                <td className="p-3 text-sm text-[#607583]">{formatWhen(row.updatedAt)}</td>
                <td className="p-3">
                  <DisabledActions />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-[#607583]">
            No incidents or safety reports match this filter.
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminIncidents() {
  const supabaseMode = isSupabaseBackendEnabled();

  return (
    <>
      <div className="border-b border-[#DDE7E8] bg-white p-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-semibold text-[#13334F]">Incident Management</h1>
          <p className="mt-1 text-[#607583]">
            {supabaseMode
              ? 'Review platform incidents and worker safety reports'
              : 'Track and resolve platform incidents'}
          </p>
        </div>
      </div>

      {supabaseMode ? <SupabaseIncidentsView /> : <MockIncidentsView />}
    </>
  );
}
