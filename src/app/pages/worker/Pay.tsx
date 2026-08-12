import type { ReactNode } from 'react';
import { Calendar, DollarSign, FileText, TrendingUp, Zap } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { getWorkerPayReadiness } from '../../services';
import type {
  WorkerEarningRow,
  WorkerEarningStatus,
  WorkerPayReadiness,
  WorkerPayoutMethodReadiness,
  WorkerPayoutMethodReadinessUiStatus,
  WorkerPayoutRow,
  WorkerPayoutStatus,
} from '../../services/types';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';

const mockPaymentHistory = [
  { date: 'May 13', facility: 'Sunrise Group Home', role: 'DSP', hours: 8, amount: '$224', status: 'paid' },
  { date: 'May 12', facility: 'Oak Memory Care', role: 'CNA', hours: 8, amount: '$208', status: 'paid' },
  { date: 'May 10', facility: 'Cedar Assisted Living', role: 'Med Aide', hours: 8, amount: '$256', status: 'processing' },
  { date: 'May 8', facility: 'Maple Residential', role: 'DSP', hours: 12, amount: '$336', status: 'paid' },
];

function formatUsdFromCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDateLabel(iso?: string): string | undefined {
  if (!iso) return undefined;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return undefined;
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function earningStatusLabel(status: WorkerEarningStatus): string {
  if (status === 'pending') return 'Pending';
  if (status === 'approved') return 'Approved';
  if (status === 'held') return 'Held';
  if (status === 'queued') return 'Queued';
  if (status === 'paid') return 'Paid';
  if (status === 'failed') return 'Failed';
  if (status === 'cancelled') return 'Cancelled';
  return status;
}

function earningStatusVariant(
  status: WorkerEarningStatus,
): 'covered' | 'pending' | 'missing' | 'urgent' {
  if (status === 'paid' || status === 'approved') return 'covered';
  if (status === 'failed' || status === 'cancelled') return 'missing';
  if (status === 'held') return 'urgent';
  return 'pending';
}

function payoutStatusLabel(status: WorkerPayoutStatus): string {
  if (status === 'created') return 'Prepared';
  if (status === 'processing') return 'Processing';
  if (status === 'paid') return 'Paid';
  if (status === 'failed') return 'Failed';
  if (status === 'cancelled') return 'Cancelled';
  return status;
}

function payoutStatusVariant(
  status: WorkerPayoutStatus,
): 'covered' | 'pending' | 'missing' | 'urgent' {
  if (status === 'paid') return 'covered';
  if (status === 'failed' || status === 'cancelled') return 'missing';
  if (status === 'processing') return 'pending';
  return 'pending';
}

function LoadingBlock() {
  return (
    <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm font-medium text-[#13334F]">Loading earnings…</p>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
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

function EarningCard({ row }: { row: WorkerEarningRow }) {
  const subtitle = [row.providerName, row.shiftRole].filter(Boolean).join(' · ');
  const dates = [
    row.approvedAt ? `Approved ${formatDateLabel(row.approvedAt)}` : undefined,
    row.availableForPayoutAt
      ? `Payout eligible ${formatDateLabel(row.availableForPayoutAt)}`
      : undefined,
  ].filter(Boolean);

  return (
    <article className="rounded-xl border border-[#DDE7E8] bg-white p-5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-[#13334F]">
            {subtitle || 'Shift earning'}
          </div>
          {row.createdAt && (
            <div className="text-xs text-[#607583]">Recorded {formatDateLabel(row.createdAt)}</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold text-[#13334F]">
            {formatUsdFromCents(row.netEarningsCents, row.currency)}
          </div>
          <StatusBadge variant={earningStatusVariant(row.status)}>
            {earningStatusLabel(row.status)}
          </StatusBadge>
        </div>
      </div>
      {dates.length > 0 && (
        <p className="text-xs text-[#9AAAB3]">{dates.join(' · ')}</p>
      )}
    </article>
  );
}

function PayoutCard({ row, title = 'Payout batch' }: { row: WorkerPayoutRow; title?: string }) {
  return (
    <article className="rounded-xl border border-[#DDE7E8] bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-[#13334F]">{title}</div>
          <div className="text-sm text-[#607583]">
            {row.lineCount != null && row.lineCount > 0
              ? `${row.lineCount} earning${row.lineCount === 1 ? '' : 's'}`
              : 'Payout record'}
            {row.createdAt ? ` · ${formatDateLabel(row.createdAt)}` : ''}
          </div>
          {row.paidAt && row.status === 'paid' && (
            <div className="mt-1 text-xs text-[#257665]">Paid {formatDateLabel(row.paidAt)}</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold text-[#13334F]">
            {formatUsdFromCents(row.amountCents, row.currency)}
          </div>
          <StatusBadge variant={payoutStatusVariant(row.status)}>
            {payoutStatusLabel(row.status)}
          </StatusBadge>
        </div>
      </div>
    </article>
  );
}

function TotalsGrid({ readiness }: { readiness: WorkerPayReadiness }) {
  const items = [
    { label: 'Pending', cents: readiness.totals.pendingCents },
    { label: 'Approved', cents: readiness.totals.approvedCents },
    { label: 'Queued', cents: readiness.totals.queuedCents },
    { label: 'Paid', cents: readiness.totals.paidCents },
    { label: 'Held', cents: readiness.totals.heldCents },
  ].filter(item => item.cents > 0);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map(item => (
        <div key={item.label} className="rounded-lg bg-[#F7FAFA] p-3">
          <div className="text-xs text-[#607583]">{item.label}</div>
          <div className="text-lg font-semibold text-[#13334F]">
            {formatUsdFromCents(item.cents)}
          </div>
        </div>
      ))}
    </div>
  );
}

function payoutMethodBadgeLabel(status: WorkerPayoutMethodReadinessUiStatus): string {
  if (status === 'setup_not_connected' || status === 'no_method') return 'Not connected';
  if (status === 'pending') return 'Pending';
  if (status === 'active') return 'Active';
  if (status === 'failed') return 'Needs attention';
  if (status === 'inactive') return 'Inactive';
  return 'Unknown';
}

function payoutMethodBadgeVariant(
  status: WorkerPayoutMethodReadinessUiStatus,
): 'covered' | 'pending' | 'missing' | 'urgent' {
  if (status === 'active') return 'covered';
  if (status === 'failed') return 'urgent';
  if (status === 'setup_not_connected' || status === 'no_method' || status === 'inactive') {
    return 'pending';
  }
  return 'pending';
}

/** Read-only payout method status — setup button stays disabled until processor onboarding is live. */
function PayoutReadinessCard({ readiness }: { readiness: WorkerPayoutMethodReadiness }) {
  const supportingLines = [
    'Prepared payout batches are visible here, but Covre is not sending payouts yet.',
  ];
  if (readiness.status === 'active') {
    supportingLines.push(
      'Payout method active. Payout processing is still not live yet.',
    );
  }

  const setupButtonLabel =
    readiness.status === 'setup_not_connected' || readiness.status === 'no_method'
      ? 'Payout setup coming soon'
      : (readiness.actionLabel ?? 'Payout setup coming soon');

  return (
    <div className="rounded-2xl border border-[#DDE7E8] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#607583]">
          Payout readiness
        </h2>
        <StatusBadge variant={payoutMethodBadgeVariant(readiness.status)}>
          {payoutMethodBadgeLabel(readiness.status)}
        </StatusBadge>
      </div>
      <p className="text-sm leading-relaxed text-[#13334F]">{readiness.message}</p>
      <ul className="mt-3 space-y-1">
        {supportingLines.map(line => (
          <li key={line} className="text-xs leading-relaxed text-[#607583]">
            {line}
          </li>
        ))}
      </ul>
      {readiness.processor && (
        <p className="mt-2 text-xs text-[#9AAAB3]">Processor: {readiness.processor}</p>
      )}
      {/* Disabled until create-worker-payout-method-setup-session is live — no Edge call from this card. */}
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="mt-4 w-full rounded-xl border border-[#DDE7E8] bg-[#F7FAFA] px-4 py-3 text-sm font-semibold text-[#13334F] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {setupButtonLabel}
      </button>
    </div>
  );
}

function PaySection({
  title,
  description,
  emptyCopy,
  isEmpty,
  children,
}: {
  title: string;
  description: string;
  emptyCopy?: string;
  isEmpty: boolean;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="px-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#607583]">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-[#607583]">{description}</p>
      </div>
      {isEmpty && emptyCopy ? (
        <p className="rounded-xl border border-dashed border-[#DDE7E8] bg-white px-5 py-4 text-sm text-[#607583]">
          {emptyCopy}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

function SupabasePayView() {
  const { data: readiness, error, loading, reload } = useAsyncResource(
    () => getWorkerPayReadiness(),
    [],
  );

  const approved = readiness?.earningsByStatus.approved ?? [];
  const queuedEarnings = readiness?.earningsByStatus.queued ?? [];
  const held = readiness?.earningsByStatus.held ?? [];
  const pending = readiness?.earningsByStatus.pending ?? [];
  const paidEarnings = readiness?.earningsByStatus.paid ?? [];
  const preparedPayouts = readiness?.payoutsByStatus.prepared ?? [];
  const processingPayouts = readiness?.payoutsByStatus.processing ?? [];
  const paidPayouts = readiness?.payoutsByStatus.paid ?? [];
  const failedPayouts = readiness?.payoutsByStatus.failed ?? [];
  const cancelledPayouts = readiness?.payoutsByStatus.cancelled ?? [];
  const failedEarnings = readiness?.earningsByStatus.failed ?? [];
  const cancelledEarnings = readiness?.earningsByStatus.cancelled ?? [];

  const hasPaidHistory = paidEarnings.length > 0 || paidPayouts.length > 0;
  const hasAnyRows =
    readiness &&
    (readiness.earnings.length > 0 ||
      readiness.payouts.length > 0 ||
      readiness.totals.pendingCents > 0 ||
      readiness.totals.approvedCents > 0 ||
      readiness.totals.queuedCents > 0 ||
      readiness.totals.paidCents > 0 ||
      readiness.totals.heldCents > 0);

  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 text-[#10283D]">
      <div className="space-y-6">
        <div className="border-b border-[#DDE7E8] bg-white p-5 sm:p-6">
          <h1 className="mb-2 text-2xl font-semibold text-[#13334F]">Earnings</h1>
          <p className="text-sm leading-relaxed text-[#607583]">
            Read-only earnings from your approved work. This page does not send money or change
            payout status.
          </p>
        </div>

        {loading && <LoadingBlock />}
        {error && <ErrorBlock message={error.message} onRetry={reload} />}

        {!loading && !error && readiness && (
          <>
            <PayoutReadinessCard readiness={readiness.payoutMethodReadiness} />

            <div className="rounded-xl border border-[#E8D9B8] bg-[#FFFBF2] px-4 py-3 text-sm text-[#6B4E16]">
              Payout processing is not live yet.
            </div>

            <div className="rounded-2xl border border-[#DDE7E8] bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-[#607583]">
                <DollarSign className="h-4 w-4 shrink-0" aria-hidden />
                Earnings summary
              </div>
              <p className="mb-4 text-xs text-[#9AAAB3]">
                Totals reflect ledger records only — not an available cash balance.
              </p>
              <TotalsGrid readiness={readiness} />
            </div>

            {!hasAnyRows && (
              <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
                <p className="text-center font-medium text-[#13334F]">No earnings yet</p>
                <p className="mt-2 text-center text-sm leading-relaxed text-[#607583]">
                  Approved timesheets will appear here once worker earnings are generated for your
                  account.
                </p>
                {readiness.message && (
                  <p className="mt-3 text-center text-xs text-[#9AAAB3]">{readiness.message}</p>
                )}
              </div>
            )}

            {hasAnyRows && (
              <div className="space-y-8">
                <PaySection
                  title="Approved earnings"
                  description="Approved earnings are ready for payout batching."
                  emptyCopy="No approved earnings waiting for a payout batch."
                  isEmpty={approved.length === 0}
                >
                  {approved.map(row => (
                    <EarningCard key={row.id} row={row} />
                  ))}
                </PaySection>

                <PaySection
                  title="Queued payout batches"
                  description="Queued payout batches have been prepared, but money has not been sent yet."
                  emptyCopy="No payout batches have been prepared yet."
                  isEmpty={
                    preparedPayouts.length === 0 &&
                    processingPayouts.length === 0 &&
                    queuedEarnings.length === 0
                  }
                >
                  {preparedPayouts.map(row => (
                    <PayoutCard key={row.id} row={row} title="Queued payout batch" />
                  ))}
                  {processingPayouts.map(row => (
                    <PayoutCard key={row.id} row={row} title="Payout batch in progress" />
                  ))}
                  {queuedEarnings.map(row => (
                    <EarningCard key={row.id} row={row} />
                  ))}
                </PaySection>

                {hasPaidHistory && (
                  <PaySection
                    title="Paid earnings and payout history"
                    description="These records show confirmed paid status from the ledger only."
                    isEmpty={false}
                  >
                    {paidPayouts.map(row => (
                      <PayoutCard key={row.id} row={row} title="Paid payout" />
                    ))}
                    {paidEarnings.map(row => (
                      <EarningCard key={row.id} row={row} />
                    ))}
                  </PaySection>
                )}

                {held.length > 0 && (
                  <PaySection
                    title="Held earnings"
                    description="Held earnings are blocked from payout batching until released by operations."
                    isEmpty={false}
                  >
                    {held.map(row => (
                      <EarningCard key={row.id} row={row} />
                    ))}
                  </PaySection>
                )}

                {pending.length > 0 && (
                  <PaySection
                    title="Pending earnings"
                    description="Pending earnings are not yet approved for payout."
                    isEmpty={false}
                  >
                    {pending.map(row => (
                      <EarningCard key={row.id} row={row} />
                    ))}
                  </PaySection>
                )}

                {(failedPayouts.length > 0 ||
                  cancelledPayouts.length > 0 ||
                  failedEarnings.length > 0 ||
                  cancelledEarnings.length > 0) && (
                  <PaySection
                    title="Failed or cancelled"
                    description="These records did not complete payout processing."
                    isEmpty={false}
                  >
                    {failedPayouts.map(row => (
                      <PayoutCard key={row.id} row={row} />
                    ))}
                    {cancelledPayouts.map(row => (
                      <PayoutCard key={row.id} row={row} />
                    ))}
                    {failedEarnings.map(row => (
                      <EarningCard key={row.id} row={row} />
                    ))}
                    {cancelledEarnings.map(row => (
                      <EarningCard key={row.id} row={row} />
                    ))}
                  </PaySection>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MockPayView() {
  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 text-[#10283D]">
      <div className="border-b border-[#DDE7E8] bg-white p-5 sm:p-6">
        <h1 className="mb-4 text-2xl font-semibold text-[#13334F]">Earnings</h1>

        <div className="rounded-2xl bg-gradient-to-br from-[#13334F] to-[#244965] p-5 sm:p-6 text-white">
          <div className="mb-2 text-sm opacity-90">Available Balance</div>
          <div className="mb-6 text-4xl font-semibold">$688.00</div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2F8E7A] min-[360px]:text-base"
            >
              <Zap className="h-4 w-4 shrink-0" />
              Instant Pay
            </button>
            <button
              type="button"
              className="rounded-xl bg-white/20 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/30 min-[360px]:text-base"
            >
              Standard
            </button>
          </div>

          <div className="mt-4 text-xs opacity-75">Instant pay: $2.99 fee • Standard: Free (2-3 days)</div>
        </div>
      </div>

      <div className="border-b border-[#DDE7E8] bg-white p-5 sm:p-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div>
            <div className="mb-1 flex items-center gap-1 text-[#607583]">
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="text-xs">This Week</span>
            </div>
            <div className="text-2xl font-semibold text-[#13334F]">$688</div>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1 text-[#607583]">
              <TrendingUp className="h-4 w-4 shrink-0" />
              <span className="text-xs">This Month</span>
            </div>
            <div className="text-2xl font-semibold text-[#13334F]">$2,456</div>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1 text-[#607583]">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="text-xs">Shifts</span>
            </div>
            <div className="text-2xl font-semibold text-[#13334F]">12</div>
          </div>
        </div>
      </div>

      <div className="py-4">
        <h3 className="mb-3 px-1 font-semibold text-[#13334F]">Payment History</h3>
        <div className="space-y-4">
          {mockPaymentHistory.map((payment, index) => (
            <div key={index} className="rounded-xl border border-[#DDE7E8] bg-white p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-[#13334F]">{payment.facility}</div>
                  <div className="text-sm text-[#607583]">
                    {payment.role} • {payment.hours} hours
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold text-[#13334F]">{payment.amount}</div>
                  <div
                    className={`text-xs ${
                      payment.status === 'paid' ? 'text-[#257665]' : 'text-[#9B6419]'
                    }`}
                  >
                    {payment.status === 'paid' ? 'Paid' : 'Processing'}
                  </div>
                </div>
              </div>
              <div className="text-xs text-[#607583]">{payment.date}</div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 font-medium text-[#13334F] transition-colors hover:bg-[#F7FAFA]"
        >
          <FileText className="h-4 w-4" />
          View Tax Documents
        </button>
      </div>
    </div>
  );
}

export default function Pay() {
  if (isSupabaseBackendEnabled()) {
    return <SupabasePayView />;
  }
  return <MockPayView />;
}
