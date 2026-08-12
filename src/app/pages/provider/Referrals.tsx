import { useCallback } from 'react';
import { Link } from 'react-router';
import { Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ReferralStatus } from '../../services/types';
import { copyReferralLink, getProviderReferralDashboard } from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { StatusBadge, type BadgeVariant } from '../../components/StatusBadge';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';

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

function formatCredits(n: number) {
  return `${n.toLocaleString()} shift credits`;
}

function LoadingBlock() {
  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
        <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
      </div>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
        <p className="text-center text-sm text-[#607583]">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0B243A]"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export default function ProviderReferrals() {
  const supabaseMode = isSupabaseBackendEnabled();
  const { data, error, loading, reload } = useAsyncResource(() => getProviderReferralDashboard(), []);

  const onCopy = useCallback(async () => {
    if (!data?.referralLink) {
      toast.error('Complete facility setup to get your referral link.');
      return;
    }
    try {
      await navigator.clipboard.writeText(data.referralLink);
      toast.success('Referral link copied');
    } catch {
      const r = await copyReferralLink(
        data.providerId ?? 'provider-001',
        'provider_to_provider',
      );
      if (r.ok) toast.success(r.data.message);
      else toast.error(r.error.message);
    }
  }, [data, supabaseMode]);

  const onShare = useCallback(() => {
    if (supabaseMode && data?.isSimulated) {
      toast.message(
        'Share your org referral link — credits and qualification tracking are simulated until referral processing is wired.',
      );
      return;
    }
    toast.success('Referral invite ready');
  }, [data?.isSimulated, supabaseMode]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error.message} onRetry={reload} />;
  if (!data) return <LoadingBlock />;

  return (
    <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 text-[#10283D]">
      <header className="mb-6 min-w-0">
        <h1 className="break-words text-2xl font-semibold text-[#13334F]">Refer Providers</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#607583]">
          Share Covre with other care operators and earn shift credits after their first covered shift.
        </p>
        {data.organizationName && (
          <p className="mt-2 text-sm font-medium text-[#13334F]">Workspace: {data.organizationName}</p>
        )}
        {supabaseMode && data.isSimulated && (
          <p className="mt-3 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm leading-relaxed text-[#607583]">
            Your referral link uses your real facility ID. Credit totals and tracker rows are
            simulated until referral qualification, fraud checks, and reward issuance are connected.
            No shift credits or payouts are issued in this pass.
          </p>
        )}
      </header>

      <div className="mx-auto w-full max-w-lg space-y-6">
        {data.setupStatus === 'incomplete' && (
          <div className="rounded-xl border border-[#F4A83D] bg-[#FFF4E0] p-4">
            <p className="text-sm font-medium text-[#9B6419]">Finish facility setup</p>
            <p className="mt-1 text-sm text-[#9B6419]">
              Complete onboarding to generate your provider referral link.
            </p>
            <Link
              to="/provider/onboarding"
              className="mt-3 inline-flex rounded-lg bg-[#13334F] px-4 py-2 text-sm font-medium text-white no-underline hover:bg-[#0B243A]"
            >
              Continue setup
            </Link>
          </div>
        )}

        <section className="rounded-xl border border-[#DDE7E8] bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#607583]">Your link</h2>
          <p className="mt-2 break-all rounded-lg bg-[#F7FAFA] px-3 py-2 font-mono text-xs text-[#13334F]">
            {data.referralLink || '—'}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onCopy}
              disabled={!data.referralLink}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B243A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] disabled:cursor-not-allowed disabled:opacity-60"
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
        </section>

        <section className="rounded-xl border border-[#DDE7E8] bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#607583]">Credit summary</h2>
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-[#F7FAFA] p-3 text-center">
              <dt className="text-xs text-[#607583]">Pending credits</dt>
              <dd className="mt-1 text-lg font-semibold text-[#13334F]">{formatCredits(data.totalPending)}</dd>
            </div>
            <div className="rounded-lg bg-[#F7FAFA] p-3 text-center">
              <dt className="text-xs text-[#607583]">Qualified credits</dt>
              <dd className="mt-1 text-lg font-semibold text-[#13334F]">{formatCredits(data.totalQualified)}</dd>
            </div>
            <div className="rounded-lg bg-[#E6F6F2] p-3 text-center">
              <dt className="text-xs text-[#607583]">Credited total</dt>
              <dd className="mt-1 text-lg font-semibold text-[#257665]">{formatCredits(data.totalPaidOrCredited)}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-[#607583]">
            Shift credit tiers
          </h2>
          <div className="space-y-2">
            {data.tiers.map(tier => (
              <div key={tier.id} className="rounded-xl border border-[#DDE7E8] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#13334F]">{tier.facilityType}</div>
                    <div className="mt-1 text-sm text-[#607583]">{tier.description}</div>
                  </div>
                  <div className="shrink-0 text-lg font-semibold text-[#53B59F]">
                    {formatCredits(tier.rewardAmount)}
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
            {data.records.length === 0 && (
              <p className="rounded-xl border border-[#DDE7E8] bg-white px-4 py-6 text-center text-sm text-[#607583]">
                {data.isSimulated
                  ? 'No referral activity yet. Tracker rows will appear after referral processing and RLS are wired.'
                  : 'No referrals yet.'}
              </p>
            )}
            {data.records.map(rec => (
              <div key={rec.id} className="w-full max-w-full rounded-xl border border-[#DDE7E8] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#13334F]">{rec.referredOrganization}</div>
                    <div className="mt-2 text-xs text-[#9AAAB3]">
                      Started {new Date(rec.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <StatusBadge variant={referralStatusVariant(rec.status)}>
                    {formatStatusLabel(rec.status)}
                  </StatusBadge>
                </div>
                <div className="mt-3 text-sm font-medium text-[#53B59F]">
                  Credit: {formatCredits(rec.rewardAmount)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <p className="rounded-xl border border-[#E8EEF2] bg-[#F7FAFA] px-4 py-3 text-xs leading-relaxed text-[#607583]">
          Shift credits apply after the referred provider completes a qualifying first covered shift.
        </p>
      </div>
    </div>
  );
}
