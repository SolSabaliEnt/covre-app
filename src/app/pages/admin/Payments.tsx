import { useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { Banknote, Ban, CircleDollarSign, FileText, Layers, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import {
  createAdminWorkerPayoutBatch,
  generateAdminWorkerEarningFromTimesheet,
  issueProviderInvoice,
  listAdminEarningGenerationQueue,
  listAdminInvoiceIssueQueue,
  listAdminProviderInvoiceCollectionQueue,
  listAdminWorkerPayoutBatchQueue,
  listPaymentOperations,
  startAdminProviderInvoiceCollection,
} from '../../services';
import { isProviderInvoiceCollectionUiEnabled } from '../../lib/providerInvoiceCollectionEnabled';
import type { AdminProviderInvoiceCollectionRow } from '../../services/types';
import type { AdminEarningGenerationRow } from '../../services/types';

const METRIC_ICONS = [Banknote, XCircle, Ban, FileText] as const;

function PayStatus({
  s,
}: {
  s: 'pending' | 'failed' | 'open' | 'paid' | 'hold';
}) {
  switch (s) {
    case 'pending':
      return <StatusBadge variant="pending">Pending</StatusBadge>;
    case 'failed':
      return <StatusBadge variant="urgent">Failed</StatusBadge>;
    case 'open':
      return <StatusBadge variant="pending">Open</StatusBadge>;
    case 'paid':
      return <StatusBadge variant="covered">Paid</StatusBadge>;
    case 'hold':
      return <StatusBadge variant="missing">Hold</StatusBadge>;
    default:
      return null;
  }
}

function formatShiftDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function providerSiteLabel(row: AdminEarningGenerationRow): string {
  const parts = [row.providerName, row.siteName].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

function formatCurrencyCents(cents: number, currency = 'usd'): string {
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

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

function EarningGenerationSection({ financeRefreshKey }: { financeRefreshKey: number }) {
  const supabaseMode = isSupabaseBackendEnabled();
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const {
    data: queue,
    error: queueError,
    loading: queueLoading,
    reload: reloadQueue,
  } = useAsyncResource(() => listAdminEarningGenerationQueue(), [financeRefreshKey]);

  if (queueLoading) {
    return (
      <section className="rounded-xl border border-[#DDE7E8] bg-white p-6">
        <p className="text-sm text-[#607583]">Loading earning generation queue…</p>
      </section>
    );
  }

  if (queueError) {
    return (
      <section className="rounded-xl border border-[#DDE7E8] bg-white p-6">
        <p className="text-sm text-[#607583]">{queueError.message}</p>
        <button
          type="button"
          onClick={reloadQueue}
          className="mt-3 rounded-lg bg-[#13334F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0B243A]"
        >
          Retry
        </button>
      </section>
    );
  }

  if (!queue) return null;

  const { rows, summary } = queue;

  async function handleGenerate(timesheetId: string) {
    setGeneratingId(timesheetId);
    try {
      const result = await generateAdminWorkerEarningFromTimesheet(timesheetId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(result.data.message);
      reloadQueue();
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-[#DDE7E8] bg-white">
      <div className="border-b border-[#DDE7E8] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[#13334F]">
              <CircleDollarSign className="h-5 w-5" />
              Earning generation
            </h2>
            <p className="mt-1 text-sm text-[#607583]">
              Convert approved timesheets into worker earnings via audited admin RPCs.
            </p>
          </div>
          {supabaseMode ? (
            <span className="rounded-lg bg-[#E8F5F1] px-3 py-1.5 text-xs font-medium text-[#2F8E7A]">
              Supabase RPC
            </span>
          ) : (
            <span className="rounded-lg bg-[#FFF4E0] px-3 py-1.5 text-xs font-medium text-[#9B6419]">
              Demo queue
            </span>
          )}
        </div>
        {supabaseMode ? (
          <p className="mt-3 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2 text-xs text-[#607583]">
            Earning generation uses audited admin RPCs. Money is not sent from this screen.
          </p>
        ) : (
          queue.message && (
            <p className="mt-3 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2 text-xs text-[#607583]">
              {queue.message}
            </p>
          )
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 border-b border-[#DDE7E8] p-5 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <div className="text-2xl font-semibold text-[#13334F]">{summary.approvedTimesheets}</div>
          <div className="text-sm text-[#607583]">Approved timesheets</div>
        </div>
        <div className="rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <div className="text-2xl font-semibold text-[#13334F]">{summary.readyToGenerate}</div>
          <div className="text-sm text-[#607583]">Ready to generate</div>
        </div>
        <div className="rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <div className="text-2xl font-semibold text-[#13334F]">{summary.alreadyGenerated}</div>
          <div className="text-sm text-[#607583]">Already generated</div>
        </div>
        <div className="rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <div className="text-2xl font-semibold text-[#13334F]">{summary.missingRateSnapshot}</div>
          <div className="text-sm text-[#607583]">Missing rate snapshot</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
            <tr>
              <th className="p-3 font-semibold text-[#13334F]">Worker</th>
              <th className="p-3 font-semibold text-[#13334F]">Provider / site</th>
              <th className="p-3 font-semibold text-[#13334F]">Shift date</th>
              <th className="p-3 font-semibold text-[#13334F]">Accepted pay</th>
              <th className="p-3 font-semibold text-[#13334F]">Timesheet</th>
              <th className="p-3 font-semibold text-[#13334F]">Earning</th>
              <th className="p-3 font-semibold text-[#13334F]">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[#607583]">
                  No approved timesheets in the earning generation queue.
                </td>
              </tr>
            ) : (
              rows.map(row => {
                const busy = generatingId === row.timesheetId;
                return (
                  <tr key={row.timesheetId} className="border-b border-[#DDE7E8]">
                    <td className="p-3 font-medium text-[#10283D]">{row.workerName ?? '—'}</td>
                    <td className="p-3 text-[#607583]">{providerSiteLabel(row)}</td>
                    <td className="p-3 text-[#607583]">{formatShiftDate(row.shiftStartsAt)}</td>
                    <td className="p-3 text-[#10283D]">
                      {row.workerPayDisplay ?? (row.hasWorkerRateSnapshot ? '—' : 'Snapshot missing')}
                    </td>
                    <td className="p-3">
                      <StatusBadge variant="covered">{row.timesheetStatus}</StatusBadge>
                    </td>
                    <td className="p-3">
                      {row.earningStatus ? (
                        <StatusBadge variant="verified">{row.earningStatus}</StatusBadge>
                      ) : (
                        <StatusBadge variant="pending">Not generated</StatusBadge>
                      )}
                    </td>
                    <td className="p-3">
                      {row.canGenerate ? (
                        <button
                          type="button"
                          disabled={busy || !supabaseMode}
                          onClick={() => handleGenerate(row.timesheetId)}
                          className="rounded-lg bg-[#53B59F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2F8E7A] disabled:cursor-not-allowed disabled:opacity-60"
                          title={
                            supabaseMode
                              ? undefined
                              : 'Demo mode — earning RPC actions require Supabase backend'
                          }
                        >
                          {busy ? 'Generating…' : 'Generate earning'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="cursor-not-allowed rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-1.5 text-xs font-medium text-[#9AAAB3]"
                          title={row.blockerReason}
                        >
                          Generate earning
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InvoicePaymentStatusBadge({ status }: { status: string | undefined }) {
  if (!status) return <StatusBadge variant="pending">—</StatusBadge>;
  if (status === 'not_started') {
    return <StatusBadge variant="pending">Not started</StatusBadge>;
  }
  if (status === 'paid') {
    return <StatusBadge variant="covered">Paid</StatusBadge>;
  }
  return <StatusBadge variant="verified">{status.replace(/_/g, ' ')}</StatusBadge>;
}

function InvoiceIssuingSection({ financeRefreshKey }: { financeRefreshKey: number }) {
  const supabaseMode = isSupabaseBackendEnabled();
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const {
    data: queue,
    error: queueError,
    loading: queueLoading,
    reload: reloadQueue,
  } = useAsyncResource(() => listAdminInvoiceIssueQueue(), [financeRefreshKey]);

  if (queueLoading) {
    return (
      <section className="rounded-xl border border-[#DDE7E8] bg-white p-6">
        <p className="text-sm text-[#607583]">Loading invoice issuing queue…</p>
      </section>
    );
  }

  if (queueError) {
    return (
      <section className="rounded-xl border border-[#DDE7E8] bg-white p-6">
        <p className="text-sm text-[#607583]">{queueError.message}</p>
        <button
          type="button"
          onClick={reloadQueue}
          className="mt-3 rounded-lg bg-[#13334F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0B243A]"
        >
          Retry
        </button>
      </section>
    );
  }

  if (!queue) return null;

  const { rows, summary } = queue;

  async function handleIssue(invoiceId: string) {
    setIssuingId(invoiceId);
    try {
      const result = await issueProviderInvoice(invoiceId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      if (supabaseMode) {
        toast.success('Invoice issued. No payment has been collected.');
      } else {
        toast.success(result.data.message);
      }
      reloadQueue();
    } finally {
      setIssuingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-[#DDE7E8] bg-white">
      <div className="border-b border-[#DDE7E8] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[#13334F]">
              <FileText className="h-5 w-5" />
              Invoice issuing
            </h2>
            <p className="mt-1 text-sm text-[#607583]">
              Lock generated draft invoices for future provider collection.
            </p>
          </div>
          {supabaseMode ? (
            <span className="rounded-lg bg-[#E8F5F1] px-3 py-1.5 text-xs font-medium text-[#2F8E7A]">
              Supabase RPC
            </span>
          ) : (
            <span className="rounded-lg bg-[#FFF4E0] px-3 py-1.5 text-xs font-medium text-[#9B6419]">
              Demo queue
            </span>
          )}
        </div>
        {supabaseMode ? (
          <p className="mt-3 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2 text-xs text-[#607583]">
            Issuing locks the invoice for collection later. It does not charge the provider.
          </p>
        ) : (
          queue.message && (
            <p className="mt-3 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2 text-xs text-[#607583]">
              {queue.message}
            </p>
          )
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 border-b border-[#DDE7E8] p-5 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <div className="text-2xl font-semibold text-[#13334F]">{summary.draftInvoices}</div>
          <div className="text-sm text-[#607583]">Draft invoices</div>
        </div>
        <div className="rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <div className="text-2xl font-semibold text-[#13334F]">{summary.readyToIssue}</div>
          <div className="text-sm text-[#607583]">Ready to issue</div>
        </div>
        <div className="rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <div className="text-2xl font-semibold text-[#13334F]">{summary.blocked}</div>
          <div className="text-sm text-[#607583]">Blocked</div>
        </div>
        <div className="rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <div className="text-2xl font-semibold text-[#13334F]">{summary.openInvoices}</div>
          <div className="text-sm text-[#607583]">Open invoices</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
            <tr>
              <th className="p-3 font-semibold text-[#13334F]">Provider</th>
              <th className="p-3 font-semibold text-[#13334F]">Invoice</th>
              <th className="p-3 font-semibold text-[#13334F]">Total</th>
              <th className="p-3 font-semibold text-[#13334F]">Lines</th>
              <th className="p-3 font-semibold text-[#13334F]">Generated</th>
              <th className="p-3 font-semibold text-[#13334F]">Due</th>
              <th className="p-3 font-semibold text-[#13334F]">Status</th>
              <th className="p-3 font-semibold text-[#13334F]">Payment</th>
              <th className="p-3 font-semibold text-[#13334F]">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-[#607583]">
                  No generated draft invoices are waiting to be issued.
                </td>
              </tr>
            ) : (
              rows.map(row => {
                const busy = issuingId === row.invoiceId;
                const invoiceLabel = row.invoiceNumber
                  ? row.invoiceNumber
                  : row.invoiceId.slice(0, 8);
                return (
                  <tr key={row.invoiceId} className="border-b border-[#DDE7E8]">
                    <td className="p-3 font-medium text-[#10283D]">{row.providerName ?? '—'}</td>
                    <td className="p-3 text-[#607583]" title={row.invoiceId}>
                      {invoiceLabel}
                    </td>
                    <td className="p-3 text-[#10283D]">{row.totalDisplay}</td>
                    <td className="p-3 text-[#607583]">{row.lineCount}</td>
                    <td className="p-3 text-[#607583]">{formatShiftDate(row.generatedAt)}</td>
                    <td className="p-3 text-[#607583]">{formatShiftDate(row.dueAt)}</td>
                    <td className="p-3">
                      <StatusBadge variant="pending">{row.status}</StatusBadge>
                    </td>
                    <td className="p-3">
                      <InvoicePaymentStatusBadge status={row.paymentStatus} />
                    </td>
                    <td className="p-3">
                      {row.canIssue ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleIssue(row.invoiceId)}
                          className="rounded-lg bg-[#53B59F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2F8E7A] disabled:cursor-not-allowed disabled:opacity-60"
                          title={
                            supabaseMode
                              ? undefined
                              : 'Demo only — invoice is not persisted or charged'
                          }
                        >
                          {busy ? 'Issuing…' : 'Issue invoice'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="cursor-not-allowed rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-1.5 text-xs font-medium text-[#9AAAB3]"
                          title={row.blockerReason}
                        >
                          Issue invoice
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatPaymentMethodLabel(row: AdminProviderInvoiceCollectionRow): string {
  if (!row.hasActivePaymentMethod) return 'Not set up';
  const brand = row.methodBrand ? row.methodBrand.toUpperCase() : 'Card';
  const last4 = row.methodLast4 ? ` •••• ${row.methodLast4}` : '';
  return `${brand}${last4}`;
}

function InvoiceCollectionSection({
  financeRefreshKey,
  onCollectionStarted,
}: {
  financeRefreshKey: number;
  onCollectionStarted: () => void;
}) {
  const supabaseMode = isSupabaseBackendEnabled();
  const collectionFlagEnabled = isProviderInvoiceCollectionUiEnabled();
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const {
    data: queue,
    error: queueError,
    loading: queueLoading,
    reload: reloadQueue,
  } = useAsyncResource(() => listAdminProviderInvoiceCollectionQueue(), [financeRefreshKey]);

  if (queueLoading) {
    return (
      <section className="rounded-xl border border-[#DDE7E8] bg-white p-6">
        <p className="text-sm text-[#607583]">Loading invoice collection queue…</p>
      </section>
    );
  }

  if (queueError) {
    return (
      <section className="rounded-xl border border-[#DDE7E8] bg-white p-6">
        <p className="text-sm text-[#607583]">{queueError.message}</p>
        <button
          type="button"
          onClick={reloadQueue}
          className="mt-3 rounded-lg bg-[#13334F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0B243A]"
        >
          Retry
        </button>
      </section>
    );
  }

  if (!queue) return null;

  const { rows, summary } = queue;
  const collectionUiEnabled = queue.collectionUiEnabled && collectionFlagEnabled;

  async function handleStartCollection(invoiceId: string) {
    const confirmed = window.confirm(
      'Start Stripe payment processing for this invoice? The invoice will be marked paid only after Stripe confirms payment.',
    );
    if (!confirmed) return;

    setCollectingId(invoiceId);
    try {
      const result = await startAdminProviderInvoiceCollection(invoiceId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(result.data.message);
      reloadQueue();
      onCollectionStarted();
    } finally {
      setCollectingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-[#DDE7E8] bg-white">
      <div className="border-b border-[#DDE7E8] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[#13334F]">
              <CircleDollarSign className="h-5 w-5" />
              Provider invoice collection
            </h2>
            <p className="mt-1 text-sm text-[#607583]">
              Starts Stripe payment processing for issued invoices. Invoices are marked paid only
              after Stripe confirms payment.
            </p>
          </div>
          {supabaseMode ? (
            <span className="rounded-lg bg-[#E8F5F1] px-3 py-1.5 text-xs font-medium text-[#2F8E7A]">
              Supabase Edge
            </span>
          ) : (
            <span className="rounded-lg bg-[#FFF4E0] px-3 py-1.5 text-xs font-medium text-[#9B6419]">
              Demo queue
            </span>
          )}
        </div>
        {!collectionUiEnabled ? (
          <p className="mt-3 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2 text-xs text-[#607583]">
            Provider invoice collection UI is disabled. Set{' '}
            <span className="font-mono">VITE_PROVIDER_INVOICE_COLLECTION_ENABLED=true</span> to
            enable Start collection when the processor is configured.
          </p>
        ) : (
          <p className="mt-3 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2 text-xs text-[#607583]">
            Starting collection creates a server-side payment attempt. Paid status updates after
            Stripe webhook confirmation only.
          </p>
        )}
        {queue.message && !supabaseMode && (
          <p className="mt-2 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2 text-xs text-[#607583]">
            {queue.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 border-b border-[#DDE7E8] p-5 md:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <div className="text-2xl font-semibold text-[#13334F]">{summary.openInvoices}</div>
          <div className="text-sm text-[#607583]">Open invoices</div>
        </div>
        <div className="rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <div className="text-2xl font-semibold text-[#13334F]">{summary.readyToCollect}</div>
          <div className="text-sm text-[#607583]">Ready to collect</div>
        </div>
        <div className="rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <div className="text-2xl font-semibold text-[#13334F]">{summary.missingPaymentMethod}</div>
          <div className="text-sm text-[#607583]">Missing payment method</div>
        </div>
        <div className="rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <div className="text-2xl font-semibold text-[#13334F]">{summary.processing}</div>
          <div className="text-sm text-[#607583]">Processing</div>
        </div>
        <div className="rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <div className="text-2xl font-semibold text-[#13334F]">{summary.paid}</div>
          <div className="text-sm text-[#607583]">Paid</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
            <tr>
              <th className="p-3 font-semibold text-[#13334F]">Provider</th>
              <th className="p-3 font-semibold text-[#13334F]">Invoice</th>
              <th className="p-3 font-semibold text-[#13334F]">Amount</th>
              <th className="p-3 font-semibold text-[#13334F]">Payment status</th>
              <th className="p-3 font-semibold text-[#13334F]">Payment method</th>
              <th className="p-3 font-semibold text-[#13334F]">Last attempt</th>
              <th className="p-3 font-semibold text-[#13334F]">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[#607583]">
                  No issued invoices are available for collection.
                </td>
              </tr>
            ) : (
              rows.map(row => {
                const busy = collectingId === row.invoiceId;
                const invoiceLabel = row.invoiceNumber
                  ? row.invoiceNumber
                  : row.invoiceId.slice(0, 8);
                const canStart =
                  supabaseMode && collectionUiEnabled && row.canCollect && !busy;
                return (
                  <tr key={row.invoiceId} className="border-b border-[#DDE7E8]">
                    <td className="p-3 font-medium text-[#10283D]">{row.providerName ?? '—'}</td>
                    <td className="p-3 text-[#607583]" title={row.invoiceId}>
                      {invoiceLabel}
                    </td>
                    <td className="p-3 text-[#10283D]">{row.totalDisplay}</td>
                    <td className="p-3">
                      <InvoicePaymentStatusBadge status={row.paymentStatus} />
                    </td>
                    <td className="p-3 text-[#607583]">{formatPaymentMethodLabel(row)}</td>
                    <td className="p-3 text-[#607583]">
                      {formatShiftDate(row.lastPaymentAttemptAt)}
                    </td>
                    <td className="p-3">
                      {canStart ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleStartCollection(row.invoiceId)}
                          className="rounded-lg bg-[#53B59F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2F8E7A] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busy ? 'Starting…' : 'Start collection'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="cursor-not-allowed rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-1.5 text-xs font-medium text-[#9AAAB3]"
                          title={row.blockerReason}
                        >
                          Start collection
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PayoutBatchingSection({
  financeRefreshKey,
  onBatchCreated,
}: {
  financeRefreshKey: number;
  onBatchCreated: () => void;
}) {
  const supabaseMode = isSupabaseBackendEnabled();
  const [batchingWorkerId, setBatchingWorkerId] = useState<string | null>(null);
  const [batchingAll, setBatchingAll] = useState(false);
  const {
    data: queue,
    error: queueError,
    loading: queueLoading,
    reload: reloadQueue,
  } = useAsyncResource(() => listAdminWorkerPayoutBatchQueue(), [financeRefreshKey]);

  if (queueLoading) {
    return (
      <section className="rounded-xl border border-[#DDE7E8] bg-white p-6">
        <p className="text-sm text-[#607583]">Loading payout batching queue…</p>
      </section>
    );
  }

  if (queueError) {
    return (
      <section className="rounded-xl border border-[#DDE7E8] bg-white p-6">
        <p className="text-sm text-[#607583]">{queueError.message}</p>
        <button
          type="button"
          onClick={reloadQueue}
          className="mt-3 rounded-lg bg-[#13334F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0B243A]"
        >
          Retry
        </button>
      </section>
    );
  }

  if (!queue) return null;

  const { groupedByWorker, summary } = queue;
  const hasEligible = summary.readyEarnings > 0;
  const batchBusy = batchingAll || batchingWorkerId != null;

  async function handleCreateBatch(workerId?: string) {
    if (workerId) {
      setBatchingWorkerId(workerId);
    } else {
      setBatchingAll(true);
    }
    try {
      const result = await createAdminWorkerPayoutBatch(workerId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      if (result.data.payoutCount > 0) {
        toast.success('Payout batch created. No money has been sent.');
      } else {
        toast.info(result.data.message);
      }
      reloadQueue();
      onBatchCreated();
    } finally {
      setBatchingWorkerId(null);
      setBatchingAll(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#DDE7E8] bg-white">
      <div className="border-b border-[#DDE7E8] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[#13334F]">
              <Layers className="h-5 w-5" />
              Payout batching
            </h2>
            <p className="mt-1 text-sm text-[#607583]">
              Group approved earnings into payout batches for future processing.
            </p>
          </div>
          {supabaseMode ? (
            <span className="rounded-lg bg-[#E8F5F1] px-3 py-1.5 text-xs font-medium text-[#2F8E7A]">
              Supabase RPC
            </span>
          ) : (
            <span className="rounded-lg bg-[#FFF4E0] px-3 py-1.5 text-xs font-medium text-[#9B6419]">
              Demo queue
            </span>
          )}
        </div>
        {supabaseMode ? (
          <p className="mt-3 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2 text-xs text-[#607583]">
            Payout batches prepare approved earnings for future payout processing. They do not send
            money.
          </p>
        ) : (
          queue.message && (
            <p className="mt-3 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2 text-xs text-[#607583]">
              {queue.message}
            </p>
          )
        )}
        {supabaseMode && hasEligible && (
          <div className="mt-3">
            <button
              type="button"
              disabled={batchBusy}
              onClick={() => handleCreateBatch()}
              className="rounded-lg bg-[#13334F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0B243A] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {batchingAll ? 'Creating batches…' : 'Create all batches'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 border-b border-[#DDE7E8] p-5 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <div className="text-2xl font-semibold text-[#13334F]">{summary.readyEarnings}</div>
          <div className="text-sm text-[#607583]">Ready earnings</div>
        </div>
        <div className="rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <div className="text-2xl font-semibold text-[#13334F]">
            {formatCurrencyCents(summary.totalEligibleCents)}
          </div>
          <div className="text-sm text-[#607583]">Eligible amount</div>
        </div>
        <div className="rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <div className="text-2xl font-semibold text-[#13334F]">{summary.workerCount}</div>
          <div className="text-sm text-[#607583]">Workers</div>
        </div>
        <div className="rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] p-4">
          <div className="text-2xl font-semibold text-[#13334F]">{summary.createdPayouts}</div>
          <div className="text-sm text-[#607583]">Created payout batches</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
            <tr>
              <th className="p-3 font-semibold text-[#13334F]">Worker</th>
              <th className="p-3 font-semibold text-[#13334F]">Earnings</th>
              <th className="p-3 font-semibold text-[#13334F]">Eligible amount</th>
              <th className="p-3 font-semibold text-[#13334F]">Currency</th>
              <th className="p-3 font-semibold text-[#13334F]">Action</th>
            </tr>
          </thead>
          <tbody>
            {groupedByWorker.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-[#607583]">
                  No approved earnings are ready for payout batching.
                </td>
              </tr>
            ) : (
              groupedByWorker.map(group => {
                const busy = batchingWorkerId === group.workerId;
                return (
                  <tr key={`${group.workerId}:${group.currency}`} className="border-b border-[#DDE7E8]">
                    <td className="p-3 font-medium text-[#10283D]">{group.workerName ?? '—'}</td>
                    <td className="p-3 text-[#607583]">{group.earningCount}</td>
                    <td className="p-3 text-[#10283D]">
                      {formatCurrencyCents(group.amountCents, group.currency)}
                    </td>
                    <td className="p-3 text-[#607583]">{group.currency.toUpperCase()}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        disabled={busy || batchBusy || !supabaseMode}
                        onClick={() => handleCreateBatch(group.workerId)}
                        className="rounded-lg bg-[#53B59F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2F8E7A] disabled:cursor-not-allowed disabled:opacity-60"
                        title={
                          supabaseMode
                            ? undefined
                            : 'Demo mode — payout batch RPC requires Supabase backend'
                        }
                      >
                        {busy ? 'Creating…' : 'Create batch for worker'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {summary.queuedEarnings > 0 && (
        <p className="border-t border-[#DDE7E8] px-5 py-3 text-xs text-[#607583]">
          {summary.queuedEarnings} earning(s) already queued in payout batches (not paid).
        </p>
      )}
    </section>
  );
}

export default function Payments() {
  const supabaseMode = isSupabaseBackendEnabled();
  const [financeRefreshKey, setFinanceRefreshKey] = useState(0);
  const { data, error, loading, reload } = useAsyncResource(() => listPaymentOperations(), []);

  if (loading) {
    return (
      <>
        <div className="border-b border-[#DDE7E8] bg-white p-6">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-3xl font-semibold text-[#13334F]">Payment Operations</h1>
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
            <h1 className="text-3xl font-semibold text-[#13334F]">Payment Operations</h1>
          </div>
        </div>
        <ErrorBlock message={error.message} onRetry={reload} />
      </>
    );
  }
  if (!data) {
    return <LoadingBlock />;
  }

  const { paymentMetricCards, records: paymentRecords } = data;
  const workerPayouts = paymentRecords.filter(r => r.kind === 'worker_payout');
  const providerInvoices = paymentRecords.filter(r => r.kind === 'provider_invoice');
  const holds = paymentRecords.filter(r => r.kind === 'hold');

  return (
    <>
      <div className="border-b border-[#DDE7E8] bg-white p-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-semibold text-[#13334F]">Payment Operations</h1>
          <p className="mt-1 text-[#607583]">
            Earning generation, payout batching, invoice issuing, and finance operations.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <EarningGenerationSection financeRefreshKey={financeRefreshKey} />
        <PayoutBatchingSection
          financeRefreshKey={financeRefreshKey}
          onBatchCreated={() => setFinanceRefreshKey(k => k + 1)}
        />
        <InvoiceIssuingSection financeRefreshKey={financeRefreshKey} />
        <InvoiceCollectionSection
          financeRefreshKey={financeRefreshKey}
          onCollectionStarted={() => setFinanceRefreshKey(k => k + 1)}
        />

        {!supabaseMode && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {paymentMetricCards.map((m, i) => {
            const Icon = METRIC_ICONS[i] ?? Banknote;
            const tone = m.tone;
            return (
              <div key={m.label} className="rounded-xl border border-[#DDE7E8] bg-white p-5">
                <div
                  className={`mb-3 flex h-11 w-11 items-center justify-center rounded-lg ${
                    tone === 'bad'
                      ? 'bg-[#FDEAEA]'
                      : tone === 'warn'
                        ? 'bg-[#FFF4E0]'
                        : 'bg-[#E8EEF2]'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      tone === 'bad' ? 'text-[#D94A4A]' : tone === 'warn' ? 'text-[#9B6419]' : 'text-[#13334F]'
                    }`}
                  />
                </div>
                <div className="text-2xl font-semibold text-[#13334F]">{m.value}</div>
                <div className="text-sm text-[#607583]">{m.label}</div>
                {m.sub && <div className="mt-1 text-xs text-[#53B59F]">{m.sub}</div>}
              </div>
            );
          })}
        </div>
        )}

        {!supabaseMode && (
        <section className="rounded-xl border border-[#DDE7E8] bg-white">
          <div className="border-b border-[#DDE7E8] px-5 py-3">
            <h2 className="text-lg font-semibold text-[#13334F]">Worker Payouts</h2>
            <p className="mt-1 text-xs text-[#607583]">Demo only — not connected to live rails.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
                <tr>
                  <th className="p-3 font-semibold text-[#13334F]">Worker</th>
                  <th className="p-3 font-semibold text-[#13334F]">Amount</th>
                  <th className="p-3 font-semibold text-[#13334F]">Status</th>
                  <th className="p-3 font-semibold text-[#13334F]">Date</th>
                  <th className="p-3 font-semibold text-[#13334F]">Method</th>
                  <th className="p-3 font-semibold text-[#13334F]">Action</th>
                </tr>
              </thead>
              <tbody>
                {workerPayouts.map(r => (
                  <tr key={r.id} className="border-b border-[#DDE7E8]">
                    <td className="p-3 font-medium text-[#10283D]">{r.partyLabel}</td>
                    <td className="p-3 text-[#10283D]">{r.amount}</td>
                    <td className="p-3">
                      <PayStatus s={r.status} />
                    </td>
                    <td className="p-3 text-[#607583]">{r.dateLabel}</td>
                    <td className="p-3 text-[#607583]">{r.method}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toast('Payout release queued (mock)')}
                          className="rounded-lg bg-[#53B59F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2F8E7A]"
                        >
                          Release
                        </button>
                        <button
                          type="button"
                          onClick={() => toast('Retry initiated (mock)')}
                          className="rounded-lg border border-[#DDE7E8] bg-white px-3 py-1.5 text-xs font-medium text-[#13334F] hover:bg-[#F7FAFA]"
                        >
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => toast('Opening payout detail drawer (mock)')}
                          className="rounded-lg border border-[#DDE7E8] bg-white px-3 py-1.5 text-xs font-medium text-[#607583] hover:bg-[#F7FAFA]"
                        >
                          View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        )}

        {!supabaseMode && (
        <section className="rounded-xl border border-[#DDE7E8] bg-white">
          <div className="border-b border-[#DDE7E8] px-5 py-3">
            <h2 className="text-lg font-semibold text-[#13334F]">Provider Invoices</h2>
            <p className="mt-1 text-xs text-[#607583]">Demo only.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
                <tr>
                  <th className="p-3 font-semibold text-[#13334F]">Provider</th>
                  <th className="p-3 font-semibold text-[#13334F]">Amount</th>
                  <th className="p-3 font-semibold text-[#13334F]">Status</th>
                  <th className="p-3 font-semibold text-[#13334F]">Date</th>
                  <th className="p-3 font-semibold text-[#13334F]">Method</th>
                  <th className="p-3 font-semibold text-[#13334F]">Action</th>
                </tr>
              </thead>
              <tbody>
                {providerInvoices.map(r => (
                  <tr key={r.id} className="border-b border-[#DDE7E8]">
                    <td className="p-3 font-medium text-[#10283D]">{r.partyLabel}</td>
                    <td className="p-3 text-[#10283D]">{r.amount}</td>
                    <td className="p-3">
                      <PayStatus s={r.status === 'open' ? 'open' : 'paid'} />
                    </td>
                    <td className="p-3 text-[#607583]">{r.dateLabel}</td>
                    <td className="p-3 text-[#607583]">{r.method}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toast('Invoice detail opened (mock)')}
                          className="rounded-lg bg-[#13334F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0B243A]"
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          onClick={() => toast('Release not applicable')}
                          className="rounded-lg border border-[#DDE7E8] px-3 py-1.5 text-xs font-medium text-[#607583] hover:bg-[#F7FAFA]"
                        >
                          Release
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        )}

        {!supabaseMode && (
        <section className="rounded-xl border border-[#DDE7E8] bg-white">
          <div className="border-b border-[#DDE7E8] px-5 py-3">
            <h2 className="text-lg font-semibold text-[#13334F]">Payment Holds</h2>
            <p className="mt-1 text-xs text-[#607583]">Demo only.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
                <tr>
                  <th className="p-3 font-semibold text-[#13334F]">Subject</th>
                  <th className="p-3 font-semibold text-[#13334F]">Amount</th>
                  <th className="p-3 font-semibold text-[#13334F]">Status</th>
                  <th className="p-3 font-semibold text-[#13334F]">Date</th>
                  <th className="p-3 font-semibold text-[#13334F]">Method</th>
                  <th className="p-3 font-semibold text-[#13334F]">Action</th>
                </tr>
              </thead>
              <tbody>
                {holds.map(r => (
                  <tr key={r.id} className="border-b border-[#DDE7E8]">
                    <td className="max-w-xs p-3 font-medium text-[#10283D]">
                      {r.subjectLine ?? r.partyLabel}
                    </td>
                    <td className="p-3 text-[#10283D]">{r.amount}</td>
                    <td className="p-3">
                      <PayStatus s={r.status} />
                    </td>
                    <td className="p-3 text-[#607583]">{r.dateLabel}</td>
                    <td className="p-3 text-[#607583]">{r.method}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toast('Hold review opened (mock)')}
                          className="rounded-lg bg-[#53B59F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2F8E7A]"
                        >
                          Release
                        </button>
                        <button
                          type="button"
                          onClick={() => toast('Escalation retry logged (mock)')}
                          className="rounded-lg border border-[#DDE7E8] bg-white px-3 py-1.5 text-xs font-medium text-[#13334F] hover:bg-[#F7FAFA]"
                        >
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => toast('Hold case detail (mock)')}
                          className="rounded-lg border border-[#DDE7E8] bg-white px-3 py-1.5 text-xs font-medium text-[#607583] hover:bg-[#F7FAFA]"
                        >
                          View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        )}
      </div>
    </>
  );
}
