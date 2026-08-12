import { useCallback } from 'react';
import { Link } from 'react-router';
import { Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ReferralStatus } from '../../services/types';
import { copyReferralLink, getWorkerReferralDashboard } from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { StatusBadge, type BadgeVariant } from '../../components/StatusBadge';

function referralStatusVariant(status: ReferralStatus): BadgeVariant {
  switch (status) {
    case 'invited':
      return 'new';
    case 'signed_up':
    case 'first_shift_completed':
      return 'pending';
    case 'qualified':
      return 'verified';
    case 'paid':
    case 'credited':
      return 'covered';
    case 'ineligible':
      return 'missing';
    default:
      return 'new';
  }
}

function formatStatusLabel(status: ReferralStatus): string {
  return status
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatCash(n: number) {
  return `$${n.toLocaleString()}`;
}

function LoadingBlock() {
  return (
    <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
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
        className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B243A]"
      >
        Retry
      </button>
    </div>
  );
}

export default function WorkerReferrals() {
  const { data, error, loading, reload } = useAsyncResource(() => getWorkerReferralDashboard(), []);

  const onCopy = useCallback(async () => {
    const r = await copyReferralLink('worker-001', 'worker_to_provider');
    if (r.ok) toast.success(r.data.message);
    else toast.error(r.error.message);
  }, []);

  const onShare = useCallback(() => {
    toast.success('Referral invite ready');
  }, []);

  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 text-[#10283D]">
      <header className="mb-6 border-b border-[#DDE7E8] bg-white p-5 sm:p-6">
        <Link
          to="/worker/account"
          className="mb-3 inline-flex text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
        >
          ← Account
        </Link>
        <h1 className="text-2xl font-semibold text-[#13334F]">Referrals</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#607583]">
          Refer care sites that need coverage and track rewards after their first covered shift.
        </p>
      </header>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error.message} onRetry={reload} />}

      {!loading && !error && data && (
        <div className="mx-auto w-full max-w-lg space-y-6">
          <section className="rounded-xl border border-[#DDE7E8] bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#607583]">Your link</h2>
            <p className="mt-2 break-all rounded-lg bg-[#F7FAFA] px-3 py-2 font-mono text-xs text-[#13334F]">
              {data.referralLink}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onCopy}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B243A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
              >
                <Copy className="h-4 w-4 shrink-0" aria-hidden />
                Copy link
              </button>
              <button
                type="button"
                onClick={onShare}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm font-semibold text-[#13334F] transition-colors hover:bg-[#F7FAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
              >
                <Share2 className="h-4 w-4 shrink-0" aria-hidden />
                Share referral
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-[#DDE7E8] pt-4 text-center text-xs sm:text-sm">
              <div>
                <dt className="text-[#607583]">Pending</dt>
                <dd className="mt-1 font-semibold text-[#13334F]">{formatCash(data.totalPending)}</dd>
              </div>
              <div>
                <dt className="text-[#607583]">Qualified</dt>
                <dd className="mt-1 font-semibold text-[#13334F]">{formatCash(data.totalQualified)}</dd>
              </div>
              <div>
                <dt className="text-[#607583]">Paid</dt>
                <dd className="mt-1 font-semibold text-[#53B59F]">{formatCash(data.totalPaidOrCredited)}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-[#607583]">
              Reward tiers
            </h2>
            <div className="space-y-2">
              {data.tiers.map(tier => (
                <div
                  key={tier.id}
                  className="rounded-xl border border-[#DDE7E8] bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-[#13334F]">{tier.facilityType}</div>
                      <div className="mt-1 text-sm text-[#607583]">{tier.description}</div>
                    </div>
                    <div className="shrink-0 text-lg font-semibold text-[#53B59F]">
                      {formatCash(tier.rewardAmount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-[#607583]">
              Referral tracker
            </h2>
            <div className="space-y-3">
              {data.records.map(rec => (
                <div
                  key={rec.id}
                  className="w-full max-w-full rounded-xl border border-[#DDE7E8] bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-[#13334F]">{rec.referredOrganization}</div>
                      <div className="mt-1 text-sm text-[#607583]">{rec.facilityType}</div>
                      <div className="mt-2 text-xs text-[#9AAAB3]">
                        Started {new Date(rec.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <StatusBadge variant={referralStatusVariant(rec.status)}>
                      {formatStatusLabel(rec.status)}
                    </StatusBadge>
                  </div>
                  <div className="mt-3 text-sm font-medium text-[#53B59F]">
                    Potential reward: {formatCash(rec.rewardAmount)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <p className="rounded-xl border border-[#E8EEF2] bg-[#F7FAFA] px-4 py-3 text-xs leading-relaxed text-[#607583]">
            Rewards are reviewed and issued after eligibility is confirmed. The referred provider must complete a
            qualifying first covered shift.
          </p>
        </div>
      )}
    </div>
  );
}
