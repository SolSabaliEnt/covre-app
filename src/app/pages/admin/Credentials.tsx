import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { StatusBadge, type BadgeVariant } from '../../components/StatusBadge';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import {
  listAdminCredentialReviewQueue,
  rejectAdminWorkerCredential,
  verifyAdminWorkerCredential,
} from '../../services';
import type {
  AdminCredentialReviewPayload,
  AdminCredentialReviewRow,
  AdminCredentialReviewStatus,
} from '../../services/types';
import { useAsyncResource } from '../../hooks/useAsyncResource';

const mockCredentials = [
  { worker: 'Sarah Johnson', type: 'CNA License', submitted: '2 hours ago', expires: 'Dec 2027' },
  { worker: 'Mike Chen', type: 'Background Check', submitted: '4 hours ago', expires: 'Annual' },
  { worker: 'Jessica Martinez', type: 'CPR/BLS', submitted: '1 day ago', expires: 'Jun 2026' },
];

type FilterKey = 'all' | 'pending' | 'verified' | 'rejected' | 'expired';

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

function formatExpires(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function statusBadgeVariant(status: AdminCredentialReviewStatus): BadgeVariant {
  if (status === 'verified') return 'verified';
  if (status === 'pending' || status === 'expiring_soon') return 'pending';
  if (status === 'rejected') return 'urgent';
  return 'expiring';
}

function statusLabel(status: AdminCredentialReviewStatus): string {
  switch (status) {
    case 'verified':
      return 'Verified';
    case 'rejected':
      return 'Rejected';
    case 'expired':
      return 'Expired';
    case 'expiring_soon':
      return 'Expiring soon';
    case 'missing':
      return 'Missing';
    default:
      return 'Pending review';
  }
}

function matchesFilter(row: AdminCredentialReviewRow, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  if (filter === 'pending') return row.status === 'pending' || row.status === 'expiring_soon';
  if (filter === 'expired') return row.status === 'expired' || row.status === 'missing';
  return row.status === filter;
}

function MockActionButtons() {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="p-2 bg-[#E6F6F2] text-[#257665] rounded-lg hover:bg-[#53B59F] hover:text-white transition-colors"
        title="Approve"
      >
        <CheckCircle2 className="w-5 h-5" />
      </button>
      <button
        type="button"
        className="p-2 bg-[#FDEAEA] text-[#A93636] rounded-lg hover:bg-[#D94A4A] hover:text-white transition-colors"
        title="Reject"
      >
        <XCircle className="w-5 h-5" />
      </button>
      <button
        type="button"
        className="p-2 bg-[#FFF4E0] text-[#9B6419] rounded-lg hover:bg-[#F4A83D] hover:text-white transition-colors"
        title="Request Info"
      >
        <AlertCircle className="w-5 h-5" />
      </button>
    </div>
  );
}

function canVerifyCredential(status: AdminCredentialReviewStatus): boolean {
  return status === 'pending' || status === 'expiring_soon' || status === 'rejected' || status === 'expired';
}

function canRejectCredential(status: AdminCredentialReviewStatus): boolean {
  return status === 'pending' || status === 'verified' || status === 'expiring_soon';
}

type CredentialActionProps = {
  row: AdminCredentialReviewRow;
  busyId: string | null;
  rejectingId: string | null;
  rejectReason: string;
  onRejectReasonChange: (value: string) => void;
  onStartReject: (credentialId: string) => void;
  onCancelReject: () => void;
  onVerify: (credentialId: string) => void;
  onReject: (credentialId: string) => void;
};

function CredentialActionButtons({
  row,
  busyId,
  rejectingId,
  rejectReason,
  onRejectReasonChange,
  onStartReject,
  onCancelReject,
  onVerify,
  onReject,
}: CredentialActionProps) {
  const isBusy = busyId === row.id;
  const isRejecting = rejectingId === row.id;
  const showVerify = canVerifyCredential(row.status);
  const showReject = canRejectCredential(row.status);

  if (isRejecting) {
    return (
      <div className="min-w-[200px] space-y-2">
        <textarea
          value={rejectReason}
          onChange={e => onRejectReasonChange(e.target.value)}
          placeholder="Rejection reason (required)"
          rows={2}
          className="w-full rounded-lg border border-[#DDE7E8] px-2 py-1.5 text-sm text-[#13334F] focus:border-[#53B59F] focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onReject(row.id)}
            className="rounded-lg bg-[#D94A4A] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            Confirm reject
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onCancelReject}
            className="rounded-lg border border-[#DDE7E8] px-2 py-1 text-xs font-medium text-[#607583]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {showVerify ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onVerify(row.id)}
          className="rounded-lg bg-[#E6F6F2] p-2 text-[#257665] hover:bg-[#53B59F] hover:text-white disabled:opacity-50"
          title="Verify"
        >
          <CheckCircle2 className="h-5 w-5" />
        </button>
      ) : null}
      {showReject ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onStartReject(row.id)}
          className="rounded-lg bg-[#FDEAEA] p-2 text-[#A93636] hover:bg-[#D94A4A] hover:text-white disabled:opacity-50"
          title="Reject"
        >
          <XCircle className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
      <div className="text-2xl font-semibold text-[#13334F]">{value}</div>
      <div className="text-xs text-[#607583]">{label}</div>
    </div>
  );
}

function SummaryStrip({ data }: { data: AdminCredentialReviewPayload }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCard label="Pending" value={data.pendingCount} />
      <SummaryCard label="Verified" value={data.verifiedCount} />
      <SummaryCard label="Rejected" value={data.rejectedCount} />
      <SummaryCard label="Expired" value={data.expiredCount} />
    </div>
  );
}

function FilterTabs({
  filters,
  active,
  onChange,
}: {
  filters: { key: FilterKey; label: string; count?: number }[];
  active: FilterKey;
  onChange: (key: FilterKey) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {filters.map(tab => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            active === tab.key
              ? 'bg-[#53B59F] text-white'
              : 'bg-white border border-[#DDE7E8] text-[#607583] hover:border-[#53B59F]'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && tab.key !== 'all' ? ` (${tab.count})` : ''}
        </button>
      ))}
    </div>
  );
}

function QueueTable({
  rows,
  actionProps,
}: {
  rows: AdminCredentialReviewRow[];
  actionProps?: Omit<CredentialActionProps, 'row'>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#DDE7E8] bg-white p-8 text-center text-sm text-[#607583]">
        No credentials in this filter.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#DDE7E8] bg-white">
      <table className="w-full min-w-[720px]">
        <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
          <tr>
            <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Worker</th>
            <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Credential</th>
            <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Submitted</th>
            <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Verified</th>
            <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Expiration</th>
            <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Status</th>
            <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-[#DDE7E8] hover:bg-[#F7FAFA]">
              <td className="p-4">
                <div className="font-medium text-[#13334F]">{row.workerName}</div>
                {row.workerLocation ? (
                  <div className="text-xs text-[#607583]">{row.workerLocation}</div>
                ) : null}
              </td>
              <td className="p-4 text-[#607583]">{row.credentialName}</td>
              <td className="p-4 text-[#607583]">{formatWhen(row.submittedAt)}</td>
              <td className="p-4 text-[#607583]">{formatWhen(row.verifiedAt)}</td>
              <td className="p-4 text-[#607583]">{formatExpires(row.expiresAt)}</td>
              <td className="p-4">
                <StatusBadge variant={statusBadgeVariant(row.status)}>
                  {statusLabel(row.status)}
                </StatusBadge>
              </td>
              <td className="p-4">
                {actionProps ? (
                  <CredentialActionButtons row={row} {...actionProps} />
                ) : (
                  <MockActionButtons />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MockCredentialsView() {
  return (
    <>
      <div className="mb-6 rounded-xl border border-[#F4A83D] bg-[#FFF4E0] p-4">
        <div className="mb-1 font-semibold text-[#9B6419]">12 credentials awaiting review</div>
        <div className="text-sm text-[#9B6419]">Average review time: 2.3 hours (demo)</div>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#DDE7E8] bg-white">
        <table className="w-full">
          <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
            <tr>
              <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Worker</th>
              <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Credential Type</th>
              <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Submitted</th>
              <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Expiration</th>
              <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Status</th>
              <th className="p-4 text-left text-sm font-semibold text-[#13334F]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockCredentials.map((cred, index) => (
              <tr key={index} className="border-b border-[#DDE7E8] hover:bg-[#F7FAFA]">
                <td className="p-4 font-medium text-[#13334F]">{cred.worker}</td>
                <td className="p-4 text-[#607583]">{cred.type}</td>
                <td className="p-4 text-[#607583]">{cred.submitted}</td>
                <td className="p-4 text-[#607583]">{cred.expires}</td>
                <td className="p-4">
                  <StatusBadge variant="pending">Pending Review</StatusBadge>
                </td>
                <td className="p-4">
                  <MockActionButtons />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SupabaseCredentialsView() {
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { data, error, loading, reload } = useAsyncResource(
    () => listAdminCredentialReviewQueue(),
    [],
  );

  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows.filter(row => matchesFilter(row, filter));
  }, [data?.rows, filter]);

  const filters: { key: FilterKey; label: string; count?: number }[] = [
    { key: 'pending', label: 'Pending', count: data?.pendingCount },
    { key: 'verified', label: 'Verified', count: data?.verifiedCount },
    { key: 'rejected', label: 'Rejected', count: data?.rejectedCount },
    { key: 'expired', label: 'Expired', count: data?.expiredCount },
    { key: 'all', label: 'All' },
  ];

  const handleVerify = async (credentialId: string) => {
    setBusyId(credentialId);
    const result = await verifyAdminWorkerCredential(credentialId);
    setBusyId(null);
    if (result.ok) {
      toast.success(result.data.message);
      setRejectingId(null);
      setRejectReason('');
      reload();
    } else {
      toast.error(result.error.message);
    }
  };

  const handleReject = async (credentialId: string) => {
    setBusyId(credentialId);
    const result = await rejectAdminWorkerCredential(credentialId, rejectReason);
    setBusyId(null);
    if (result.ok) {
      toast.success(result.data.message);
      setRejectingId(null);
      setRejectReason('');
      reload();
    } else {
      toast.error(result.error.message);
    }
  };

  const actionProps: Omit<CredentialActionProps, 'row'> = {
    busyId,
    rejectingId,
    rejectReason,
    onRejectReasonChange: setRejectReason,
    onStartReject: id => {
      setRejectingId(id);
      setRejectReason('');
    },
    onCancelReject: () => {
      setRejectingId(null);
      setRejectReason('');
    },
    onVerify: id => {
      void handleVerify(id);
    },
    onReject: id => {
      void handleReject(id);
    },
  };

  return (
    <>
      <div className="mb-6 rounded-xl border border-[#DDE7E8] bg-[#EEF4F5] p-4">
        <p className="text-sm font-medium text-[#13334F]">
          Verification actions are audited. Document review is manual — Covre does not
          automatically validate license files.
        </p>
        <p className="mt-1 text-sm text-[#607583]">
          Live data from Supabase — {data?.pendingCount ?? 0} credential
          {(data?.pendingCount ?? 0) === 1 ? '' : 's'} awaiting review. Apply migration{' '}
          <span className="font-mono text-xs">0020</span> on the project before verify/reject will
          succeed.
        </p>
      </div>

      {loading && (
        <p className="mb-4 text-sm text-[#607583]">Loading credential submissions…</p>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-[#F4A83D] bg-[#FFF4E0] p-4">
          <p className="text-sm font-medium text-[#9B6419]">{error.message}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-2 text-sm font-semibold text-[#257665] hover:text-[#2F8E7A]"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <SummaryStrip data={data} />
          <FilterTabs filters={filters} active={filter} onChange={setFilter} />
          <QueueTable rows={filteredRows} actionProps={actionProps} />
        </>
      )}
    </>
  );
}

export default function AdminCredentials() {
  const supabaseMode = isSupabaseBackendEnabled();

  return (
    <>
      <div className="border-b border-[#DDE7E8] bg-white p-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-semibold text-[#13334F]">Credential Review Queue</h1>
          <p className="mt-1 text-[#607583]">
            {supabaseMode
              ? 'Review worker credential submissions (audited verify/reject via RPC)'
              : 'Review and approve worker credentials'}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-6">
        {supabaseMode ? <SupabaseCredentialsView /> : <MockCredentialsView />}
      </div>
    </>
  );
}
