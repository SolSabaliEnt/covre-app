import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '../../components/StatusBadge';
import {
  getProviderPaymentMethodReadiness,
  getProviderSettingsSummary,
  updateProviderBillingSettings,
  updateProviderNotificationSettings,
} from '../../services';
import type {
  ProviderPaymentMethodReadiness,
  ProviderPaymentMethodStatus,
  ProviderPaymentMethodSummary,
  ProviderSettingsSummary,
} from '../../services/types';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import { isProviderPaymentMethodSetupUiEnabled } from '../../lib/providerPaymentSetupEnabled';
import { startProviderPaymentMethodSetup } from '../../lib/providerPaymentMethodSetup';

type SettingsRow = { label: string; to?: string };

const SECTIONS: { title: string; rows: SettingsRow[] }[] = [
  {
    title: 'Organization',
    rows: [
      { label: 'Company profile' },
      { label: 'Facilities & service area' },
      { label: 'Brand & communications' },
    ],
  },
  {
    title: 'Users & permissions',
    rows: [
      { label: 'Users & permissions', to: '/provider/team' },
      { label: 'Seat management' },
      { label: 'Role templates' },
      { label: 'Invite history' },
    ],
  },
  {
    title: 'Notifications',
    rows: [
      { label: 'Shift alerts' },
      { label: 'Billing & invoicing' },
      { label: 'Compliance reminders' },
    ],
  },
  {
    title: 'Billing preferences',
    rows: [
      { label: 'Payment methods' },
      { label: 'Invoice delivery' },
      { label: 'Tax documentation' },
    ],
  },
  {
    title: 'Compliance requirements',
    rows: [
      { label: 'Credential rules by role' },
      { label: 'Required training' },
      { label: 'Document retention' },
    ],
  },
];

const rowClassName =
  'flex w-full max-w-full items-center justify-between gap-3 overflow-hidden px-4 py-3.5 text-left transition-colors hover:bg-[#F7FAFA] focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] no-underline';

function formatRole(role?: string): string {
  if (!role) return '—';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatSetupLabel(status: ProviderSettingsSummary['setupStatus']): string {
  if (status === 'complete') return 'Complete';
  if (status === 'incomplete') return 'Setup incomplete';
  return 'Unknown';
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
        className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0B243A]"
      >
        Retry
      </button>
    </div>
  );
}

function SettingsSections({
  onRowClick,
}: {
  onRowClick: (sectionTitle: string, row: SettingsRow) => void;
}) {
  return (
    <div className="space-y-6">
      {SECTIONS.map(section => (
        <section key={section.title} className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-[#607583]">
            {section.title}
          </h2>
          <div className="overflow-hidden rounded-2xl border border-[#DDE7E8] bg-white shadow-sm">
            {section.rows.map((row, i) => (
              <div key={row.label} className={i > 0 ? 'border-t border-[#DDE7E8]' : ''}>
                {row.to ? (
                  <Link to={row.to} className={rowClassName}>
                    <span className="min-w-0 font-medium text-[#13334F]">{row.label}</span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-[#B8C6CC]" aria-hidden />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRowClick(section.title, row)}
                    className={rowClassName}
                  >
                    <span className="min-w-0 font-medium text-[#13334F]">{row.label}</span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-[#B8C6CC]" aria-hidden />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MockSettingsView() {
  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6 pb-40">
      <div className="mx-auto w-full min-w-0 max-w-full space-y-6">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-[#13334F]">Settings</h1>
          <p className="mt-1 text-sm text-[#607583]">Manage your organization and Covre preferences.</p>
        </div>
        <SettingsSections
          onRowClick={() => {
            toast('Settings editor coming soon');
          }}
        />
      </div>
    </div>
  );
}

function formatPaymentMethodLabel(method: ProviderPaymentMethodSummary): string {
  const brand = method.brand?.trim();
  const last4 = method.last4?.trim();
  if (brand && last4) return `${brand} •••• ${last4}`;
  if (brand) return brand;
  if (last4) return `•••• ${last4}`;
  return 'Payment method on file';
}

function formatPaymentMethodStatus(status: ProviderPaymentMethodStatus): string {
  if (status === 'active') return 'Active';
  if (status === 'pending') return 'Pending';
  if (status === 'inactive') return 'Inactive';
  if (status === 'failed') return 'Failed';
  if (status === 'removed') return 'Removed';
  return status;
}

function PaymentMethodStatusBadge({ status }: { status: ProviderPaymentMethodStatus }) {
  if (status === 'active') {
    return <StatusBadge variant="covered">{formatPaymentMethodStatus(status)}</StatusBadge>;
  }
  if (status === 'failed' || status === 'removed') {
    return <StatusBadge variant="missing">{formatPaymentMethodStatus(status)}</StatusBadge>;
  }
  return <StatusBadge variant="pending">{formatPaymentMethodStatus(status)}</StatusBadge>;
}

function PaymentMethodOnFileCard({
  readiness,
  loading,
  error,
  onRetry,
}: {
  readiness?: ProviderPaymentMethodReadiness;
  loading: boolean;
  error?: { message: string } | null;
  onRetry: () => void;
}) {
  const setupUiEnabled = isProviderPaymentMethodSetupUiEnabled();
  const [setupLoading, setSetupLoading] = useState(false);

  const activeDefault =
    readiness?.defaultMethod?.status === 'active'
      ? readiness.defaultMethod
      : readiness?.methods.find(m => m.status === 'active' && m.isDefault) ??
        readiness?.methods.find(m => m.status === 'active');

  const addButtonLabel = setupUiEnabled ? 'Add payment method' : 'Add payment method soon';
  const addButtonDisabled = !setupUiEnabled || setupLoading;
  const addButtonClassName = setupUiEnabled
    ? 'shrink-0 rounded-lg bg-[#13334F] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B243A] disabled:cursor-not-allowed disabled:opacity-60'
    : 'shrink-0 cursor-not-allowed rounded-lg bg-[#E8EEF2] px-4 py-2 text-sm font-medium text-[#9AAAB3]';

  const handleAddPaymentMethod = async () => {
    if (!setupUiEnabled || setupLoading) return;
    setSetupLoading(true);
    try {
      await startProviderPaymentMethodSetup('/provider/settings');
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#DDE7E8] bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#607583]">
        Payment method on file
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[#607583]">
        Covre redirects you to Stripe to save a payment method. This does not collect invoice
        payment yet. After setup, return here; the saved method will appear after Stripe confirms
        it.
      </p>

      {loading && <p className="mt-3 text-sm text-[#607583]">Loading payment method…</p>}

      {error && !loading && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-[#607583]">{error.message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-[#13334F] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B243A]"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && readiness && activeDefault && (
        <div className="mt-4 flex flex-col gap-4 rounded-lg bg-[#F7FAFA] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#E8EEF2]">
              <CreditCard className="h-6 w-6 text-[#13334F]" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[#13334F]">
                {formatPaymentMethodLabel(activeDefault)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#607583]">
                <PaymentMethodStatusBadge status={activeDefault.status} />
                {activeDefault.isDefault && (
                  <span className="text-xs font-medium text-[#257665]">Default</span>
                )}
                {activeDefault.processor && (
                  <span className="text-xs text-[#9AAAB3]">Processor: {activeDefault.processor}</span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={addButtonDisabled}
            onClick={() => void handleAddPaymentMethod()}
            className={`${addButtonClassName} w-full sm:w-auto`}
            title={
              setupUiEnabled
                ? undefined
                : 'Enable VITE_PROVIDER_PAYMENT_METHOD_SETUP_ENABLED to start setup'
            }
          >
            {setupLoading ? 'Starting setup…' : addButtonLabel}
          </button>
        </div>
      )}

      {!loading && !error && readiness && !activeDefault && (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg bg-[#F7FAFA] p-4">
            <p className="font-medium text-[#13334F]">No payment method is on file.</p>
            {readiness.message && (
              <p className="mt-2 text-xs text-[#9AAAB3]">{readiness.message}</p>
            )}
          </div>
          <button
            type="button"
            disabled={addButtonDisabled}
            onClick={() => void handleAddPaymentMethod()}
            className={`${addButtonClassName} w-full sm:w-auto`}
            title={
              setupUiEnabled
                ? undefined
                : 'Enable VITE_PROVIDER_PAYMENT_METHOD_SETUP_ENABLED to start setup'
            }
          >
            {setupLoading ? 'Starting setup…' : addButtonLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function ContextSummaryCard({ summary }: { summary: ProviderSettingsSummary }) {
  return (
    <div className="rounded-2xl border border-[#DDE7E8] bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#607583]">Workspace</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-[#607583]">Facility</dt>
          <dd className="font-medium text-[#13334F]">{summary.organizationName ?? '—'}</dd>
        </div>
        {summary.organizationType && (
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
            <dt className="text-[#607583]">Type</dt>
            <dd className="text-[#13334F]">{summary.organizationType}</dd>
          </div>
        )}
        {summary.organizationStatus && (
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
            <dt className="text-[#607583]">Org status</dt>
            <dd className="text-[#13334F]">{summary.organizationStatus}</dd>
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-[#607583]">Your role</dt>
          <dd className="text-[#13334F]">{formatRole(summary.memberRole)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-[#607583]">Account</dt>
          <dd className="text-right text-[#13334F]">
            {summary.accountName ?? '—'}
            {summary.accountEmail && (
              <span className="block text-xs font-normal text-[#607583]">{summary.accountEmail}</span>
            )}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-[#607583]">Setup</dt>
          <dd className="text-[#13334F]">{formatSetupLabel(summary.setupStatus)}</dd>
        </div>
      </dl>
    </div>
  );
}

function SupabaseSettingsView() {
  const { data: summary, error, loading, reload } = useAsyncResource(
    () => getProviderSettingsSummary(),
    [],
  );
  const {
    data: paymentReadiness,
    error: paymentError,
    loading: paymentLoading,
    reload: reloadPayment,
  } = useAsyncResource(() => getProviderPaymentMethodReadiness(), []);

  const handleRowClick = async (sectionTitle: string) => {
    if (sectionTitle === 'Notifications') {
      const result = await updateProviderNotificationSettings();
      if (result.ok) toast.message(result.data.message);
      else toast.error(result.error.message);
      return;
    }
    if (sectionTitle === 'Billing preferences') {
      const result = await updateProviderBillingSettings();
      if (result.ok) toast.message(result.data.message);
      else toast.error(result.error.message);
      return;
    }
    toast.message('This setting will be connected in a later release.');
  };

  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6 pb-40">
      <div className="mx-auto w-full min-w-0 max-w-full space-y-6">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-[#13334F]">Settings</h1>
          <p className="mt-1 text-sm text-[#607583]">
            Organization and account context from Supabase — sensitive controls stay staged.
          </p>
        </div>

        {loading && <LoadingBlock />}
        {error && <ErrorBlock message={error.message} onRetry={reload} />}

        {!loading && !error && summary && (
          <>
            <ContextSummaryCard summary={summary} />

            <PaymentMethodOnFileCard
              readiness={paymentReadiness}
              loading={paymentLoading}
              error={paymentError}
              onRetry={reloadPayment}
            />

            {summary.setupStatus === 'incomplete' && (
              <div className="rounded-xl border border-[#F4A83D] bg-[#FFF4E0] p-4">
                <p className="text-sm font-medium text-[#9B6419]">Finish facility setup</p>
                <p className="mt-1 text-sm text-[#9B6419]">
                  Complete onboarding to link your workspace before changing organization settings.
                </p>
                <Link
                  to="/provider/onboarding"
                  className="mt-3 inline-flex rounded-lg bg-[#13334F] px-4 py-2 text-sm font-medium text-white no-underline hover:bg-[#0B243A]"
                >
                  Continue setup
                </Link>
              </div>
            )}

            <SettingsSections onRowClick={sectionTitle => void handleRowClick(sectionTitle)} />
          </>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  if (isSupabaseBackendEnabled()) {
    return <SupabaseSettingsView />;
  }
  return <MockSettingsView />;
}
