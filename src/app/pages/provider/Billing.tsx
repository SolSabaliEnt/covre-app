import { useState } from 'react';
import { DollarSign, Download, CreditCard, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '../../components/StatusBadge';
import {
  generateProviderInvoiceFromApprovedTimesheets,
  getProviderBillingReadiness,
  getProviderPaymentMethodReadiness,
  listProviderInvoices,
} from '../../services';
import type {
  ProviderBillingReadinessRow,
  ProviderInvoiceRow,
  ProviderPaymentMethodReadiness,
} from '../../services/types';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useProviderAction } from '../../hooks/useProviderAction';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import { isProviderPaymentMethodSetupUiEnabled } from '../../lib/providerPaymentSetupEnabled';
import { startProviderPaymentMethodSetup } from '../../lib/providerPaymentMethodSetup';

const invoices = [
  { date: 'May 1-7, 2026', shifts: 18, amount: '$5,832', status: 'paid' },
  { date: 'May 8-14, 2026', shifts: 24, amount: '$7,648', status: 'pending' },
];

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function LoadingBlock() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-full rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
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
  );
}

function EmptyBlock() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-full rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm font-medium text-[#13334F]">No shifts yet</p>
      <p className="mt-2 text-center text-sm text-[#607583]">
        Post a shift to see billing readiness here. Invoices and payments require worker
        bookings, approved timesheets, and payment rails.
      </p>
    </div>
  );
}

function ReadinessBadge({ row }: { row: ProviderBillingReadinessRow }) {
  if (row.isSimulated) {
    return <StatusBadge variant="pending">{row.statusLabel}</StatusBadge>;
  }
  if (row.status === 'ready') {
    return <StatusBadge variant="covered">Ready to invoice</StatusBadge>;
  }
  return <StatusBadge variant="pending">{row.statusLabel}</StatusBadge>;
}

function MockBillingView() {
  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto w-full min-w-0 max-w-full space-y-6">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-[#13334F]">Billing</h1>
          <p className="mt-1 text-sm text-[#607583]">Manage invoices and payment methods</p>
        </div>

        <div className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#13334F] to-[#244965] p-5 text-white sm:p-8">
          <div className="mb-2 text-sm opacity-90">Current Balance</div>
          <div className="mb-6 break-words text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl">$7,648.00</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="mb-1 text-sm opacity-75">This Month</div>
              <div className="text-xl font-semibold sm:text-2xl">$13,480</div>
            </div>
            <div>
              <div className="mb-1 text-sm opacity-75">Total Shifts</div>
              <div className="text-xl font-semibold sm:text-2xl">42</div>
            </div>
            <div>
              <div className="mb-1 text-sm opacity-75">Avg Cost/Shift</div>
              <div className="text-xl font-semibold sm:text-2xl">$321</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#DDE7E8] bg-white p-4 sm:p-6">
          <h2 className="mb-4 text-xl font-semibold text-[#13334F]">Payment Method</h2>
          <div className="flex flex-col gap-4 rounded-lg bg-[#F7FAFA] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#E8EEF2]">
                <CreditCard className="h-6 w-6 text-[#13334F]" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-[#13334F]">Bank Account ••••4892</div>
                <div className="text-sm text-[#607583]">Auto-pay enabled</div>
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg bg-[#E8EEF2] px-4 py-2 font-medium text-[#13334F] transition-colors hover:bg-[#DDE7E8]"
            >
              Update
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[#DDE7E8] bg-white p-4 sm:p-6">
          <h2 className="mb-4 text-xl font-semibold text-[#13334F]">Invoice History</h2>
          <div className="space-y-3">
            {invoices.map((invoice, index) => (
              <div
                key={index}
                className="flex flex-col gap-3 rounded-lg bg-[#F7FAFA] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[#13334F]">{invoice.date}</div>
                  <div className="text-sm text-[#607583]">{invoice.shifts} shifts</div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="text-left sm:text-right">
                    <div className="text-xl font-semibold text-[#13334F]">{invoice.amount}</div>
                    <div className="text-sm text-[#607583]">
                      {invoice.status === 'paid' ? 'Paid' : 'Pending'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 rounded-lg border border-[#DDE7E8] bg-white px-4 py-2 text-[#13334F] transition-colors hover:bg-[#F7FAFA]"
                  >
                    <Download className="h-4 w-4" />
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#DDE7E8] bg-white p-4 sm:p-6">
          <h2 className="mb-4 text-xl font-semibold text-[#13334F]">Spend by Site (This Month)</h2>
          <div className="space-y-3">
            {[
              { site: 'Oak Memory Care', amount: '$5,280', shifts: 16 },
              { site: 'Sunrise Group Home', amount: '$4,480', shifts: 14 },
              { site: 'Cedar Assisted Living', amount: '$2,560', shifts: 8 },
              { site: 'Maple Residential', amount: '$1,160', shifts: 4 },
            ].map((site, index) => (
              <div
                key={index}
                className="flex flex-col gap-1 rounded-lg bg-[#F7FAFA] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[#13334F]">{site.site}</div>
                  <div className="text-sm text-[#607583]">{site.shifts} shifts</div>
                </div>
                <div className="text-xl font-semibold text-[#13334F]">{site.amount}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentMethodReadinessBanner({
  readiness,
  loading,
  error,
}: {
  readiness?: ProviderPaymentMethodReadiness;
  loading: boolean;
  error?: { message: string } | null;
}) {
  if (loading) {
    return (
      <p className="rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm text-[#607583]">
        Checking payment method readiness…
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-[#F4A83D] bg-[#FFF4E0] px-4 py-3 text-sm text-[#9B6419]">
        {error.message}
      </p>
    );
  }

  if (!readiness) return null;

  if (readiness.hasActiveMethod) {
    const label = readiness.defaultMethod
      ? [
          readiness.defaultMethod.brand?.trim(),
          readiness.defaultMethod.last4?.trim()
            ? `•••• ${readiness.defaultMethod.last4.trim()}`
            : undefined,
        ]
          .filter(Boolean)
          .join(' ')
      : undefined;

    return (
      <p className="rounded-xl border border-[#B8E6D8] bg-[#E6F6F2] px-4 py-3 text-sm text-[#257665]">
        <span className="font-medium">Payment method on file.</span>
        {label ? (
          <span className="mt-1 block text-[#13334F]">{label}</span>
        ) : null}
        <span className="mt-1 block text-[#607583]">
          Payment method on file for visibility only. Automatic collection is not connected yet —
          charges will not run until payment collection is enabled server-side.
        </span>
      </p>
    );
  }

  return (
    <p className="rounded-xl border border-[#F4A83D] bg-[#FFF4E0] px-4 py-3 text-sm text-[#9B6419]">
      <span className="font-medium">Automatic collection is not connected yet.</span>
      <span className="mt-1 block">
        Draft invoices can still be generated for review. A payment method will be required before
        automatic collection can run once secure setup is live.
      </span>
      <span className="mt-1 block text-[#607583]">
        After setup, return here; the saved method will appear after Stripe confirms it.
      </span>
    </p>
  );
}

function ProviderPaymentMethodSetupAction({
  loading,
  onSetup,
}: {
  loading: boolean;
  onSetup: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#DDE7E8] bg-white px-4 py-4">
      <p className="text-sm font-medium text-[#13334F]">Set up payment method</p>
      <p className="mt-1 text-sm leading-relaxed text-[#607583]">
        This saves a payment method for future invoice collection. It does not charge now.
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={onSetup}
        className="mt-3 inline-flex rounded-lg bg-[#13334F] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B243A] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Starting setup…' : 'Set up payment method'}
      </button>
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: ProviderInvoiceRow['status'] }) {
  if (status === 'generated') {
    return <StatusBadge variant="covered">Draft generated</StatusBadge>;
  }
  if (status === 'void') {
    return <StatusBadge variant="missing">Void</StatusBadge>;
  }
  return <StatusBadge variant="pending">Draft</StatusBadge>;
}

function SupabaseBillingView() {
  const { run, isPending } = useProviderAction();
  const setupUiEnabled = isProviderPaymentMethodSetupUiEnabled();
  const [setupLoading, setSetupLoading] = useState(false);
  const { data: summary, error, loading, reload } = useAsyncResource(
    () => getProviderBillingReadiness(),
    [],
  );
  const {
    data: invoices,
    error: invoicesError,
    loading: invoicesLoading,
    reload: reloadInvoices,
  } = useAsyncResource(() => listProviderInvoices(), []);
  const {
    data: paymentReadiness,
    error: paymentError,
    loading: paymentLoading,
  } = useAsyncResource(() => getProviderPaymentMethodReadiness(), []);

  const reloadAll = () => {
    reload();
    reloadInvoices();
  };

  const handleSetupPaymentMethod = () => {
    if (!setupUiEnabled || setupLoading) return;
    setSetupLoading(true);
    void startProviderPaymentMethodSetup('/provider/billing').finally(() => {
      setSetupLoading(false);
    });
  };

  return (
    <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 pb-8">
      <div className="mx-auto w-full min-w-0 max-w-full space-y-6">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-[#13334F]">Billing</h1>
          <p className="mt-1 text-sm text-[#607583]">
            Billing readiness and draft invoice records from approved timesheets.
          </p>
          <p className="mt-3 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm leading-relaxed text-[#607583]">
            Invoice generation creates draft invoice records only. Automatic collection requires an
            active payment method on file. Submitted timesheets and shifts without bookings remain
            estimated pipeline only.
          </p>
          <div className="mt-3 space-y-3">
            <PaymentMethodReadinessBanner
              readiness={paymentReadiness}
              loading={paymentLoading}
              error={paymentError}
            />
            {setupUiEnabled &&
              !paymentLoading &&
              !paymentError &&
              paymentReadiness &&
              !paymentReadiness.hasActiveMethod && (
                <ProviderPaymentMethodSetupAction
                  loading={setupLoading}
                  onSetup={handleSetupPaymentMethod}
                />
              )}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={isPending('generate-invoice')}
            onClick={async () => {
              const r = await run('generate-invoice', () =>
                generateProviderInvoiceFromApprovedTimesheets(),
              );
              if (r.ok) {
                toast.success(r.data.message);
                reloadAll();
              } else {
                toast.error(r.error.message);
              }
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#13334F] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B243A] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileText className="h-4 w-4 shrink-0" aria-hidden />
            Generate invoice draft
          </button>
        </div>

        {loading && <LoadingBlock />}
        {error && <ErrorBlock message={error.message} onRetry={reloadAll} />}
        {invoicesError && !loading && (
          <ErrorBlock message={invoicesError.message} onRetry={reloadInvoices} />
        )}

        {!loading && !error && summary && (
          <>
            <div className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#13334F] to-[#244965] p-5 text-white sm:p-8">
              <div className="mb-2 text-sm opacity-90">Estimated open pipeline</div>
              <div className="mb-6 break-words text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl">
                {formatUsd(summary.estimatedOpenValue)}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <div className="mb-1 text-sm opacity-75">Ready to invoice</div>
                  <div className="text-xl font-semibold sm:text-2xl">
                    {formatUsd(summary.readyToInvoiceValue)}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="mb-1 text-sm opacity-75">Simulated pipeline (prep)</div>
                  <div className="text-xl font-semibold sm:text-2xl">
                    {formatUsd(summary.simulatedInvoiceValue)}
                  </div>
                  <p className="mt-2 text-xs opacity-80">
                    Not a real invoice balance — readiness only until billing rails are wired.
                  </p>
                </div>
              </div>
            </div>

            {!invoicesLoading && invoices && invoices.length > 0 && (
              <div className="rounded-xl border border-[#DDE7E8] bg-white p-4 sm:p-6">
                <h2 className="mb-4 text-xl font-semibold text-[#13334F]">Generated invoices</h2>
                <div className="space-y-4">
                  {invoices.map(invoice => (
                    <article
                      key={invoice.invoiceId}
                      className="overflow-hidden rounded-xl border border-[#DDE7E8] bg-[#F7FAFA] p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-[#13334F]">
                            Draft invoice · {invoice.lineCount} line
                            {invoice.lineCount === 1 ? '' : 's'}
                          </h3>
                          <p className="mt-0.5 text-sm text-[#607583]">
                            {invoice.generatedAt
                              ? new Date(invoice.generatedAt).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </p>
                          <p className="mt-1 text-xs text-[#9AAAB3]">
                            Draft record only — not sent for payment
                          </p>
                        </div>
                        <InvoiceStatusBadge status={invoice.status} />
                      </div>
                      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-[#DDE7E8] pt-3">
                        <span className="text-sm text-[#607583]">Total</span>
                        <span className="text-lg font-semibold text-[#13334F]">
                          {formatUsd(invoice.totalAmount)}
                        </span>
                      </div>
                      {invoice.lines && invoice.lines.length > 0 && (
                        <ul className="mt-3 space-y-2 border-t border-[#DDE7E8] pt-3">
                          {invoice.lines.map(line => (
                            <li
                              key={line.id}
                              className="flex flex-col gap-1 text-sm text-[#10283D] sm:flex-row sm:justify-between"
                            >
                              <span className="min-w-0 text-[#607583]">{line.description}</span>
                              <span className="shrink-0 font-medium text-[#13334F]">
                                {line.hours}h · {formatUsd(line.amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}

            {summary.rows.length === 0 && <EmptyBlock />}

            {summary.rows.length > 0 && (
              <div className="rounded-xl border border-[#DDE7E8] bg-white p-4 sm:p-6">
                <h2 className="mb-4 text-xl font-semibold text-[#13334F]">Billing readiness</h2>
                <div className="space-y-4">
                  {summary.rows.map(row => (
                    <article
                      key={row.id}
                      className="overflow-hidden rounded-xl border border-[#DDE7E8] bg-[#F7FAFA] p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E6F6F2] text-[#257665]">
                            <DollarSign className="h-5 w-5" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-[#13334F]">
                              {row.shiftTitle} — {row.siteName}
                            </h3>
                            <p className="mt-0.5 text-sm text-[#607583]">{row.shiftDate}</p>
                            <p className="mt-1 text-xs text-[#9AAAB3]">
                              {row.isSimulated
                                ? 'Shift prep · no invoice created'
                                : row.status === 'ready'
                                  ? 'Approved timesheet · ready for invoice generation'
                                  : 'Awaiting approval or booking'}
                            </p>
                          </div>
                        </div>
                        <ReadinessBadge row={row} />
                      </div>

                      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-[#DDE7E8] pt-3">
                        <span className="text-sm text-[#607583]">Estimated bill</span>
                        <span className="text-lg font-semibold text-[#13334F]">
                          {formatUsd(row.estimatedAmount)}
                        </span>
                      </div>

                      {row.missingItems && row.missingItems.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-[#607583]">
                            Required before invoicing
                          </p>
                          <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-[#10283D]">
                            {row.missingItems.map(item => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => {
                            toast.message(
                              row.missingItems?.length
                                ? `Still needed: ${row.missingItems.join(', ')}.`
                                : 'Booking, timesheet, invoice, and payment rails must be connected first.',
                            );
                          }}
                          className="flex-1 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm font-medium text-[#13334F] transition-colors hover:bg-[#F7FAFA]"
                        >
                          View requirements
                        </button>
                        <button
                          type="button"
                          disabled
                          onClick={() => {
                            toast.message(
                              'Invoice preparation is simulated until bookings and approved timesheets are wired.',
                            );
                          }}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#13334F] px-4 py-3 text-sm font-medium text-white opacity-60 transition-colors disabled:cursor-not-allowed"
                          title="No real invoice is created in Supabase prep mode"
                        >
                          <Download className="h-4 w-4 shrink-0" aria-hidden />
                          Prepare invoice (prep)
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Billing() {
  if (isSupabaseBackendEnabled()) {
    return <SupabaseBillingView />;
  }
  return <MockBillingView />;
}
