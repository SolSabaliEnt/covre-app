import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { CircleDollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge, type BadgeVariant } from '../../components/StatusBadge';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import {
  listAdminWorkerRateReviewQueue,
  lockAdminShiftRates,
  setAdminShiftWorkerRate,
  unlockAdminShiftRates,
  updateAdminShiftBillRate,
} from '../../services';
import type {
  AdminWorkerRateReviewQueue,
  AdminWorkerRateReviewRow,
  AdminWorkerRateReviewStatus,
} from '../../services/types';
import { useAsyncResource } from '../../hooks/useAsyncResource';

type RateFilter = 'all' | 'missing_worker_rate' | 'missing_bill_rate' | 'rate_ready' | 'locked';
type RateActionKind = 'set_worker' | 'update_bill' | 'lock' | 'unlock';

type ActiveRateAction = {
  shiftId: string;
  kind: RateActionKind;
};

const FILTERS: { id: RateFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'missing_worker_rate', label: 'Missing worker rate' },
  { id: 'missing_bill_rate', label: 'Missing bill rate' },
  { id: 'rate_ready', label: 'Ready' },
  { id: 'locked', label: 'Locked' },
];

function formatWhen(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRateCents(cents: number | undefined): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}/hr`;
}

function parseDollarsToCents(input: string): number | null {
  const trimmed = input.trim().replace(/^\$/, '');
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [wholePart, fractionPart = ''] = trimmed.split('.');
  const whole = Number.parseInt(wholePart, 10);
  const fraction = Number.parseInt((fractionPart + '00').slice(0, 2), 10);
  if (!Number.isFinite(whole) || !Number.isFinite(fraction) || whole < 0 || fraction < 0) {
    return null;
  }
  return whole * 100 + fraction;
}

function statusBadgeVariant(status: AdminWorkerRateReviewStatus): BadgeVariant {
  switch (status) {
    case 'rate_ready':
      return 'covered';
    case 'locked':
      return 'verified';
    case 'missing_bill_rate':
      return 'pending';
    case 'missing_worker_rate':
    default:
      return 'missing';
  }
}

function statusLabel(status: AdminWorkerRateReviewStatus): string {
  switch (status) {
    case 'missing_worker_rate':
      return 'Missing worker rate';
    case 'missing_bill_rate':
      return 'Missing bill rate';
    case 'rate_ready':
      return 'Rate ready';
    case 'locked':
      return 'Locked';
    default:
      return status;
  }
}

function filterRows(rows: AdminWorkerRateReviewRow[], filter: RateFilter): AdminWorkerRateReviewRow[] {
  if (filter === 'all') return rows;
  return rows.filter(r => r.status === filter);
}

function actionLabel(kind: RateActionKind): string {
  switch (kind) {
    case 'set_worker':
      return 'Set worker rate';
    case 'update_bill':
      return 'Update bill rate';
    case 'lock':
      return 'Lock rates';
    case 'unlock':
      return 'Unlock rates';
  }
}

function ActionButtonRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function MockRateActions() {
  return (
    <ActionButtonRow>
      <button
        type="button"
        disabled
        className="cursor-not-allowed rounded-lg bg-[#E8EEF0] px-2.5 py-1 text-xs font-medium text-[#9AAAB3]"
        title="Demo mode — rate RPC actions require Supabase backend"
      >
        Set worker rate (demo)
      </button>
    </ActionButtonRow>
  );
}

type RateActionFormProps = {
  kind: RateActionKind;
  amountDollars: string;
  reason: string;
  busy: boolean;
  onAmountChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

function RateActionForm({
  kind,
  amountDollars,
  reason,
  busy,
  onAmountChange,
  onReasonChange,
  onSubmit,
  onCancel,
}: RateActionFormProps) {
  const needsAmount = kind === 'set_worker' || kind === 'update_bill';

  return (
    <div className="min-w-[220px] space-y-2 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-2">
      <p className="text-xs font-semibold text-[#13334F]">{actionLabel(kind)}</p>
      {needsAmount ? (
        <label className="block text-xs text-[#607583]">
          Rate (USD / hour)
          <input
            type="text"
            inputMode="decimal"
            value={amountDollars}
            onChange={e => onAmountChange(e.target.value)}
            placeholder="28.00"
            className="mt-1 w-full rounded-lg border border-[#DDE7E8] bg-white px-2 py-1.5 text-sm text-[#13334F] focus:border-[#53B59F] focus:outline-none"
          />
        </label>
      ) : null}
      <label className="block text-xs text-[#607583]">
        Reason (required)
        <textarea
          value={reason}
          onChange={e => onReasonChange(e.target.value)}
          placeholder="Market CNA rate — Denver metro"
          rows={2}
          className="mt-1 w-full rounded-lg border border-[#DDE7E8] bg-white px-2 py-1.5 text-sm text-[#13334F] focus:border-[#53B59F] focus:outline-none"
        />
      </label>
      <p className="text-[11px] leading-snug text-[#607583]">
        Audited admin RPC only. Booked shifts may be blocked. Setting a rate does not generate worker
        earnings.
      </p>
      <ActionButtonRow>
        <button
          type="button"
          disabled={busy}
          onClick={onSubmit}
          className="rounded-lg bg-[#13334F] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#0B243A] disabled:opacity-50"
        >
          Submit
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-lg border border-[#DDE7E8] bg-white px-2.5 py-1 text-xs font-medium text-[#607583]"
        >
          Cancel
        </button>
      </ActionButtonRow>
    </div>
  );
}

type RateActionCellProps = {
  row: AdminWorkerRateReviewRow;
  actionsEnabled: boolean;
  busyId: string | null;
  activeAction: ActiveRateAction | null;
  amountDollars: string;
  reason: string;
  onStartAction: (shiftId: string, kind: RateActionKind) => void;
  onAmountChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

function RateActionCell({
  row,
  actionsEnabled,
  busyId,
  activeAction,
  amountDollars,
  reason,
  onStartAction,
  onAmountChange,
  onReasonChange,
  onSubmit,
  onCancel,
}: RateActionCellProps) {
  if (!actionsEnabled) {
    return <MockRateActions />;
  }

  const isBusy = busyId === row.shiftId;
  const isActive = activeAction?.shiftId === row.shiftId && activeAction.kind;

  if (isActive && activeAction) {
    return (
      <RateActionForm
        kind={activeAction.kind}
        amountDollars={amountDollars}
        reason={reason}
        busy={isBusy}
        onAmountChange={onAmountChange}
        onReasonChange={onReasonChange}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );
  }

  const showSetWorker = row.status === 'missing_worker_rate';
  const showUpdateBill = row.status === 'missing_bill_rate' || row.status === 'rate_ready';
  const showLock = row.status === 'rate_ready';
  const showUnlock = row.status === 'locked';

  if (!showSetWorker && !showUpdateBill && !showLock && !showUnlock) {
    return <span className="text-xs text-[#9AAAB3]">—</span>;
  }

  return (
    <ActionButtonRow>
      {showSetWorker ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onStartAction(row.shiftId, 'set_worker')}
          className="rounded-lg bg-[#E6F6F2] px-2.5 py-1 text-xs font-medium text-[#257665] hover:bg-[#53B59F] hover:text-white disabled:opacity-50"
        >
          Set worker rate
        </button>
      ) : null}
      {showUpdateBill ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onStartAction(row.shiftId, 'update_bill')}
          className="rounded-lg border border-[#DDE7E8] bg-white px-2.5 py-1 text-xs font-medium text-[#607583] hover:bg-[#F7FAFA] disabled:opacity-50"
        >
          Update bill rate
        </button>
      ) : null}
      {showLock ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onStartAction(row.shiftId, 'lock')}
          className="rounded-lg border border-[#13334F] bg-white px-2.5 py-1 text-xs font-medium text-[#13334F] hover:bg-[#F7FAFA] disabled:opacity-50"
        >
          Lock rates
        </button>
      ) : null}
      {showUnlock ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onStartAction(row.shiftId, 'unlock')}
          className="rounded-lg border border-[#F4A83D] bg-white px-2.5 py-1 text-xs font-medium text-[#9B6419] hover:bg-[#FFF4E0] disabled:opacity-50"
        >
          Unlock
        </button>
      ) : null}
    </ActionButtonRow>
  );
}

function RateReviewContent({
  data,
  reload,
  actionsEnabled,
}: {
  data: AdminWorkerRateReviewQueue;
  reload: () => void;
  actionsEnabled: boolean;
}) {
  const [filter, setFilter] = useState<RateFilter>('missing_worker_rate');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveRateAction | null>(null);
  const [amountDollars, setAmountDollars] = useState('');
  const [reason, setReason] = useState('');
  const filtered = useMemo(() => filterRows(data.rows, filter), [data.rows, filter]);

  const clearForm = () => {
    setActiveAction(null);
    setAmountDollars('');
    setReason('');
  };

  const handleStartAction = (shiftId: string, kind: RateActionKind) => {
    setActiveAction({ shiftId, kind });
    setAmountDollars('');
    setReason('');
  };

  const handleSubmit = async () => {
    if (!activeAction) return;

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      toast.error('A reason is required for audited rate changes.');
      return;
    }

    setBusyId(activeAction.shiftId);

    if (activeAction.kind === 'set_worker') {
      const cents = parseDollarsToCents(amountDollars);
      if (cents == null) {
        setBusyId(null);
        toast.error('Enter a valid worker rate (USD per hour, zero or greater).');
        return;
      }
      const result = await setAdminShiftWorkerRate({
        shiftId: activeAction.shiftId,
        workerRateCents: cents,
        reason: trimmedReason,
      });
      setBusyId(null);
      if (result.ok) {
        toast.success(result.data.message);
        clearForm();
        reload();
      } else {
        toast.error(result.error.message);
      }
      return;
    }

    if (activeAction.kind === 'update_bill') {
      const cents = parseDollarsToCents(amountDollars);
      if (cents == null) {
        setBusyId(null);
        toast.error('Enter a valid bill rate (USD per hour, zero or greater).');
        return;
      }
      const result = await updateAdminShiftBillRate({
        shiftId: activeAction.shiftId,
        billRateCents: cents,
        reason: trimmedReason,
      });
      setBusyId(null);
      if (result.ok) {
        toast.success(result.data.message);
        clearForm();
        reload();
      } else {
        toast.error(result.error.message);
      }
      return;
    }

    if (activeAction.kind === 'lock') {
      const result = await lockAdminShiftRates({
        shiftId: activeAction.shiftId,
        reason: trimmedReason,
      });
      setBusyId(null);
      if (result.ok) {
        toast.success(result.data.message);
        clearForm();
        reload();
      } else {
        toast.error(result.error.message);
      }
      return;
    }

    if (activeAction.kind === 'unlock') {
      const result = await unlockAdminShiftRates({
        shiftId: activeAction.shiftId,
        reason: trimmedReason,
      });
      setBusyId(null);
      if (result.ok) {
        toast.success(result.data.message);
        clearForm();
        reload();
      } else {
        toast.error(result.error.message);
      }
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 rounded-xl border border-[#53B59F] bg-[#E6F6F2] p-4">
        <p className="text-sm leading-relaxed text-[#257665]">
          Rate changes are audited through admin RPCs. Worker earnings remain blocked until booking
          snapshots include worker rates.
        </p>
      </div>

      {!actionsEnabled ? (
        <div className="mb-6 rounded-xl border border-[#F4A83D] bg-[#FFF4E0] p-4">
          <p className="text-sm text-[#9B6419]">
            Demo / prep mode — rate actions are disabled. Switch to Supabase backend after migration
            0025 to use audited RPCs.
          </p>
        </div>
      ) : null}

      {data.message ? (
        <div className="mb-6 rounded-xl border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <p className="text-sm text-[#607583]">{data.message}</p>
        </div>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#607583]">
            Missing worker rate
          </p>
          <p className="mt-1 text-2xl font-semibold text-[#A93636]">{data.summary.missingWorkerRate}</p>
        </div>
        <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#607583]">
            Missing bill rate
          </p>
          <p className="mt-1 text-2xl font-semibold text-[#F4A83D]">{data.summary.missingBillRate}</p>
        </div>
        <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#607583]">Ready</p>
          <p className="mt-1 text-2xl font-semibold text-[#257665]">{data.summary.ready}</p>
        </div>
        <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#607583]">Locked</p>
          <p className="mt-1 text-2xl font-semibold text-[#13334F]">{data.summary.locked}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(f => (
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
              <th className="p-3 text-left text-sm font-semibold text-[#13334F]">Role</th>
              <th className="p-3 text-left text-sm font-semibold text-[#13334F]">Provider / site</th>
              <th className="p-3 text-left text-sm font-semibold text-[#13334F]">Starts</th>
              <th className="p-3 text-left text-sm font-semibold text-[#13334F]">Bill rate</th>
              <th className="p-3 text-left text-sm font-semibold text-[#13334F]">Worker rate</th>
              <th className="p-3 text-left text-sm font-semibold text-[#13334F]">Status</th>
              <th className="p-3 text-left text-sm font-semibold text-[#13334F]">Shift</th>
              <th className="p-3 text-left text-sm font-semibold text-[#13334F]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr key={row.id} className="border-b border-[#DDE7E8] hover:bg-[#F7FAFA]">
                <td className="p-3">
                  <p className="font-medium text-[#13334F]">{row.role}</p>
                  {row.isUrgent ? (
                    <span className="text-xs font-medium text-[#A93636]">Urgent</span>
                  ) : null}
                </td>
                <td className="p-3 text-sm text-[#607583]">
                  <p>{row.providerName ?? '—'}</p>
                  <p className="text-xs">{row.siteName ?? '—'}</p>
                </td>
                <td className="p-3 text-sm text-[#607583]">{formatWhen(row.startsAt)}</td>
                <td className="p-3 text-sm text-[#13334F]">{formatRateCents(row.billRateCents)}</td>
                <td className="p-3 text-sm text-[#13334F]">{formatRateCents(row.workerRateCents)}</td>
                <td className="p-3">
                  <StatusBadge variant={statusBadgeVariant(row.status)}>
                    {statusLabel(row.status)}
                  </StatusBadge>
                </td>
                <td className="p-3 text-sm text-[#607583]">
                  {row.shiftStatus ?? '—'}
                  <Link
                    to={`/admin/shifts/${row.shiftId}`}
                    className="mt-1 block text-xs font-medium text-[#53B59F] hover:text-[#2F8E7A]"
                  >
                    View shift
                  </Link>
                </td>
                <td className="p-3">
                  <RateActionCell
                    row={row}
                    actionsEnabled={actionsEnabled}
                    busyId={busyId}
                    activeAction={activeAction}
                    amountDollars={amountDollars}
                    reason={reason}
                    onStartAction={handleStartAction}
                    onAmountChange={setAmountDollars}
                    onReasonChange={setReason}
                    onSubmit={() => void handleSubmit()}
                    onCancel={clearForm}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-[#607583]">
            No shifts match this filter.
            <button
              type="button"
              onClick={reload}
              className="mt-3 block w-full text-sm font-medium text-[#53B59F] hover:underline"
            >
              Refresh queue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RateReviewView() {
  const supabaseMode = isSupabaseBackendEnabled();
  const { data, error, loading, reload } = useAsyncResource(() => listAdminWorkerRateReviewQueue(), []);
  const actionsEnabled = supabaseMode && (data?.isSupabaseBacked ?? false);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <p className="text-sm text-[#607583]">Loading worker rate review…</p>
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

  return <RateReviewContent data={data} reload={reload} actionsEnabled={actionsEnabled} />;
}

export default function AdminWorkerRates() {
  const supabaseMode = isSupabaseBackendEnabled();

  return (
    <>
      <div className="border-b border-[#DDE7E8] bg-white p-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <CircleDollarSign className="h-8 w-8 text-[#53B59F]" aria-hidden />
            <div>
              <h1 className="text-3xl font-semibold text-[#13334F]">Worker rate review</h1>
              <p className="mt-1 text-[#607583]">
                {supabaseMode
                  ? 'Set and lock worker pay rates via audited admin RPCs'
                  : 'Prep queue for worker pay rate governance (demo)'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <RateReviewView />
    </>
  );
}
