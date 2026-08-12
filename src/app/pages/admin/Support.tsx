import { useMemo, useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { Clock, Inbox, Timer, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import {
  listAdminSupportTickets,
  listSupportTickets,
  updateAdminSupportTicketStatus,
} from '../../services';
import type {
  AdminSupportTicketPayload,
  AdminSupportTicketRow,
  AdminSupportTicketStatus,
} from '../../services/types';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import type { SupportTicket } from '../../data/types';

type MockFilter = 'all' | 'urgent' | 'worker' | 'provider' | 'pay' | 'safety' | 'compliance';
type SupabaseFilter = 'all' | 'open' | 'assigned' | 'resolved' | 'closed' | 'urgent';

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

function MockPri({ p }: { p: 'urgent' | 'normal' }) {
  return p === 'urgent' ? (
    <StatusBadge variant="urgent">Urgent</StatusBadge>
  ) : (
    <StatusBadge variant="new">Normal</StatusBadge>
  );
}

function MockSt({ s }: { s: 'open' | 'pending' | 'resolved' }) {
  if (s === 'open') {
    return <StatusBadge variant="pending">Open</StatusBadge>;
  }
  if (s === 'pending') {
    return <StatusBadge variant="pending">Awaiting</StatusBadge>;
  }
  return <StatusBadge variant="covered">Resolved</StatusBadge>;
}

function AdminTicketStatusBadge({ status }: { status: AdminSupportTicketStatus }) {
  switch (status) {
    case 'open':
      return <StatusBadge variant="pending">Open</StatusBadge>;
    case 'assigned':
      return <StatusBadge variant="new">In progress</StatusBadge>;
    case 'resolved':
      return <StatusBadge variant="verified">Resolved</StatusBadge>;
    case 'closed':
      return <StatusBadge variant="covered">Closed</StatusBadge>;
    default:
      return <StatusBadge variant="pending">{status}</StatusBadge>;
  }
}

function AdminTicketPriorityBadge({ priority }: { priority: AdminSupportTicketRow['priority'] }) {
  if (priority === 'urgent' || priority === 'high') {
    return <StatusBadge variant="urgent">{priority === 'urgent' ? 'Urgent' : 'High'}</StatusBadge>;
  }
  return <StatusBadge variant="new">{priority}</StatusBadge>;
}

const MOCK_FILTERS: { id: MockFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'worker', label: 'Worker' },
  { id: 'provider', label: 'Provider' },
  { id: 'pay', label: 'Pay' },
  { id: 'safety', label: 'Safety' },
  { id: 'compliance', label: 'Compliance' },
];

const SUPABASE_FILTERS: { id: SupabaseFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'assigned', label: 'In progress' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
  { id: 'urgent', label: 'Urgent' },
];

function MockSupportView() {
  const [filter, setFilter] = useState<MockFilter>('all');
  const { data: supportTickets, error, loading, reload } = useAsyncResource(() => listSupportTickets(), []);

  const filtered = useMemo(() => {
    if (!supportTickets) return [];
    if (filter === 'all') {
      return supportTickets;
    }
    if (filter === 'urgent') {
      return supportTickets.filter(t => t.priority === 'urgent');
    }
    const tag = filter as 'worker' | 'provider' | 'pay' | 'safety' | 'compliance';
    return supportTickets.filter(t => t.tags.includes(tag));
  }, [filter, supportTickets]);

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

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#DDE7E8] bg-white p-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#E8EEF2]">
            <Inbox className="h-5 w-5 text-[#13334F]" />
          </div>
          <div className="text-2xl font-semibold text-[#13334F]">38</div>
          <div className="text-sm text-[#607583]">Open tickets</div>
        </div>
        <div className="rounded-xl border border-[#DDE7E8] bg-white p-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#FDEAEA]">
            <Clock className="h-5 w-5 text-[#D94A4A]" />
          </div>
          <div className="text-2xl font-semibold text-[#13334F]">9</div>
          <div className="text-sm text-[#607583]">Urgent tickets</div>
        </div>
        <div className="rounded-xl border border-[#DDE7E8] bg-white p-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#E8EEF2]">
            <Timer className="h-5 w-5 text-[#13334F]" />
          </div>
          <div className="text-2xl font-semibold text-[#13334F]">47m</div>
          <div className="text-sm text-[#607583]">Avg response time</div>
        </div>
        <div className="rounded-xl border border-[#DDE7E8] bg-white p-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#E6F6F2]">
            <CheckCircle2 className="h-5 w-5 text-[#257665]" />
          </div>
          <div className="text-2xl font-semibold text-[#13334F]">52</div>
          <div className="text-sm text-[#607583]">Resolved today</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {MOCK_FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] ${
              filter === f.id
                ? 'border-[#53B59F] bg-[#E6F6F2] text-[#13334F]'
                : 'border-[#DDE7E8] bg-white text-[#607583] hover:border-[#53B59F]/40'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <MockTicketTable tickets={filtered} />
    </div>
  );
}

function MockTicketTable({ tickets }: { tickets: SupportTicket[] }) {
  return (
    <section className="rounded-xl border border-[#DDE7E8] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
            <tr>
              <th className="p-3 font-semibold text-[#13334F]">Ticket</th>
              <th className="p-3 font-semibold text-[#13334F]">Requester</th>
              <th className="p-3 font-semibold text-[#13334F]">Type</th>
              <th className="p-3 font-semibold text-[#13334F]">Priority</th>
              <th className="p-3 font-semibold text-[#13334F]">Related shift / site</th>
              <th className="p-3 font-semibold text-[#13334F]">Status</th>
              <th className="p-3 font-semibold text-[#13334F]">Last update</th>
              <th className="p-3 font-semibold text-[#13334F]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(t => (
              <tr key={t.id} className="border-b border-[#DDE7E8]">
                <td className="whitespace-nowrap p-3 font-mono text-xs text-[#13334F]">{t.id}</td>
                <td className="p-3 text-[#10283D]">{t.requesterLabel}</td>
                <td className="p-3 text-[#607583]">{t.type}</td>
                <td className="p-3">
                  <MockPri p={t.priority} />
                </td>
                <td className="max-w-[220px] p-3 text-[#607583]">{t.relatedLine}</td>
                <td className="p-3">
                  <MockSt s={t.status} />
                </td>
                <td className="p-3 text-[#607583]">{t.lastUpdate}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toast(`Assign: ${t.id}`)}
                      className="rounded-lg bg-[#13334F] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#0B243A]"
                    >
                      Assign
                    </button>
                    <button
                      type="button"
                      onClick={() => toast(`Reply draft opened: ${t.id}`)}
                      className="rounded-lg border border-[#DDE7E8] bg-white px-2.5 py-1 text-xs font-medium text-[#13334F] hover:bg-[#F7FAFA]"
                    >
                      Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.success(`Resolved: ${t.id}`)}
                      className="rounded-lg border border-[#53B59F] bg-[#E6F6F2] px-2.5 py-1 text-xs font-medium text-[#257665] hover:bg-[#D4EFE8]"
                    >
                      Resolve
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tickets.length === 0 && (
          <div className="p-8 text-center text-sm text-[#607583]">No tickets match this filter.</div>
        )}
      </div>
    </section>
  );
}

function SupabaseTicketActions({
  row,
  busyId,
  onStatus,
}: {
  row: AdminSupportTicketRow;
  busyId: string | null;
  onStatus: (ticketId: string, status: AdminSupportTicketStatus) => void;
}) {
  const isBusy = busyId === row.id;

  return (
    <div className="flex flex-wrap gap-2">
      {row.status === 'open' ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void onStatus(row.id, 'assigned')}
          className="rounded-lg bg-[#13334F] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#0B243A] disabled:opacity-50"
        >
          Mark in progress
        </button>
      ) : null}
      {row.status === 'open' || row.status === 'assigned' ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void onStatus(row.id, 'resolved')}
          className="rounded-lg border border-[#53B59F] bg-[#E6F6F2] px-2.5 py-1 text-xs font-medium text-[#257665] hover:bg-[#D4EFE8] disabled:opacity-50"
        >
          Resolve
        </button>
      ) : null}
      {row.status !== 'closed' ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void onStatus(row.id, 'closed')}
          className="rounded-lg border border-[#DDE7E8] bg-white px-2.5 py-1 text-xs font-medium text-[#13334F] hover:bg-[#F7FAFA] disabled:opacity-50"
        >
          Close
        </button>
      ) : null}
    </div>
  );
}


function SupabaseSupportView() {
  const [filter, setFilter] = useState<SupabaseFilter>('open');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const { data, error, loading, reload } = useAsyncResource(
    () => listAdminSupportTickets(),
    [],
  );

  const filtered = useMemo(() => {
    if (!data?.rows) return [];
    if (filter === 'all') return data.rows;
    if (filter === 'urgent') {
      return data.rows.filter(r => r.priority === 'urgent' || r.priority === 'high');
    }
    return data.rows.filter(r => r.status === filter);
  }, [data?.rows, filter]);

  const handleStatus = async (ticketId: string, nextStatus: AdminSupportTicketStatus) => {
    setBusyId(ticketId);
    const result = await updateAdminSupportTicketStatus(ticketId, nextStatus, note);
    setBusyId(null);
    if (result.ok) {
      toast.success(result.data.message);
      setNote('');
      reload();
    } else {
      toast.error(result.error.message);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <p className="text-sm text-[#607583]">Loading support tickets…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="rounded-xl border border-[#F4A83D] bg-[#FFF4E0] p-4">
          <p className="text-sm font-medium text-[#9B6419]">{error.message}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-2 text-sm font-semibold text-[#257665] hover:text-[#2F8E7A]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const summary = data as AdminSupportTicketPayload;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="rounded-xl border border-[#DDE7E8] bg-[#EEF4F5] p-4">
        <p className="text-sm font-medium text-[#13334F]">
          Support triage actions are audited. Status updates are manual — Covre does not send
          notifications or email from this screen.
        </p>
        <p className="mt-1 text-sm text-[#607583]">
          Live data from Supabase. Apply migration <span className="font-mono text-xs">0021</span>{' '}
          before triage actions will succeed.
        </p>
      </div>

      <SummaryStrip data={summary} />

      <div>
        <label className="mb-1 block text-xs font-medium text-[#607583]">
          Admin note for triage actions (optional, stored in audit log)
        </label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optional note for resolve/close"
          rows={2}
          className="mb-3 w-full max-w-xl rounded-lg border border-[#DDE7E8] px-3 py-2 text-sm text-[#13334F] focus:border-[#53B59F] focus:outline-none"
        />
        <div className="flex flex-wrap gap-2">
        {SUPABASE_FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.id
                ? 'border-[#53B59F] bg-[#E6F6F2] text-[#13334F]'
                : 'border-[#DDE7E8] bg-white text-[#607583] hover:border-[#53B59F]/40'
            }`}
          >
            {f.label}
          </button>
        ))}
        </div>
      </div>

      <section className="rounded-xl border border-[#DDE7E8] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
              <tr>
                <th className="p-3 font-semibold text-[#13334F]">Ticket</th>
                <th className="p-3 font-semibold text-[#13334F]">Requester</th>
                <th className="p-3 font-semibold text-[#13334F]">Type</th>
                <th className="p-3 font-semibold text-[#13334F]">Priority</th>
                <th className="p-3 font-semibold text-[#13334F]">Related</th>
                <th className="p-3 font-semibold text-[#13334F]">Status</th>
                <th className="p-3 font-semibold text-[#13334F]">Updated</th>
                <th className="p-3 font-semibold text-[#13334F]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id} className="border-b border-[#DDE7E8]">
                  <td className="whitespace-nowrap p-3 font-mono text-xs text-[#13334F]">
                    {row.id.slice(0, 8)}…
                  </td>
                  <td className="p-3 text-[#10283D]">{row.requesterLabel}</td>
                  <td className="p-3 text-[#607583]">
                    {row.ticketType || row.subject || 'Support'}
                  </td>
                  <td className="p-3">
                    <AdminTicketPriorityBadge priority={row.priority} />
                  </td>
                  <td className="max-w-[220px] p-3 text-[#607583]">{row.relatedLine ?? '—'}</td>
                  <td className="p-3">
                    <AdminTicketStatusBadge status={row.status} />
                  </td>
                  <td className="p-3 text-[#607583]">{formatWhen(row.updatedAt)}</td>
                  <td className="p-3">
                    <SupabaseTicketActions
                      row={row}
                      busyId={busyId}
                      onStatus={handleStatus}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-[#607583]">
              No tickets match this filter.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryStrip({ data }: { data: AdminSupportTicketPayload }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
        <div className="text-2xl font-semibold text-[#13334F]">{data.openCount}</div>
        <div className="text-xs text-[#607583]">Open</div>
      </div>
      <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
        <div className="text-2xl font-semibold text-[#13334F]">{data.assignedCount}</div>
        <div className="text-xs text-[#607583]">In progress</div>
      </div>
      <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
        <div className="text-2xl font-semibold text-[#13334F]">{data.urgentCount}</div>
        <div className="text-xs text-[#607583]">Urgent / high</div>
      </div>
      <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
        <div className="text-2xl font-semibold text-[#13334F]">{data.resolvedCount}</div>
        <div className="text-xs text-[#607583]">Resolved</div>
      </div>
    </div>
  );
}

export default function Support() {
  const supabaseMode = isSupabaseBackendEnabled();

  return (
    <>
      <div className="border-b border-[#DDE7E8] bg-white p-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-semibold text-[#13334F]">Support Queue</h1>
          <p className="mt-1 text-[#607583]">
            {supabaseMode
              ? 'Triage provider and worker support tickets (audited status updates via RPC)'
              : 'Triage worker and provider requests across shifts, pay, credentials, and safety.'}
          </p>
        </div>
      </div>

      {supabaseMode ? <SupabaseSupportView /> : <MockSupportView />}
    </>
  );
}
