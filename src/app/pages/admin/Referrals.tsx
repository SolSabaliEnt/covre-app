import { useMemo } from 'react';
import { toast } from 'sonner';
import type { ReferralRecord, ReferralStatus, ReferralTrack } from '../../services/types';
import { approveReferralReward, listAdminReferrals, markReferralIneligible } from '../../services';
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

function trackLabel(t: ReferralTrack): string {
  return t === 'worker_to_provider' ? 'Worker → Provider' : 'Provider → Provider';
}

function formatReward(rec: ReferralRecord): string {
  return rec.rewardType === 'cash'
    ? `$${rec.rewardAmount.toLocaleString()}`
    : `${rec.rewardAmount.toLocaleString()} shift credits`;
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
          className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0B243A]"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export default function AdminReferrals() {
  const { data: records, error, loading, reload } = useAsyncResource(() => listAdminReferrals(), []);

  const metrics = useMemo(() => {
    const list = records ?? [];
    const invited = list.filter(r => r.status === 'invited').length;
    const signedUp = list.filter(r => r.status === 'signed_up' || r.status === 'first_shift_completed').length;
    const qualified = list.filter(r => r.status === 'qualified').length;
    const paidCredited = list.filter(r => r.status === 'paid' || r.status === 'credited').length;
    return { invited, signedUp, qualified, paidCredited };
  }, [records]);

  const runApprove = async (id: string) => {
    const r = await approveReferralReward(id);
    if (r.ok) {
      toast.success(r.data.message);
      reload();
    } else toast.error(r.error.message);
  };

  const runIneligible = async (id: string) => {
    const r = await markReferralIneligible(id);
    if (r.ok) {
      toast.success(r.data.message);
      reload();
    } else toast.error(r.error.message);
  };

  if (loading) {
    return (
      <>
        <div className="border-b border-[#DDE7E8] bg-white p-6">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-3xl font-semibold text-[#13334F]">Referral Ledger</h1>
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
            <h1 className="text-3xl font-semibold text-[#13334F]">Referral Ledger</h1>
          </div>
        </div>
        <ErrorBlock message={error.message} onRetry={reload} />
      </>
    );
  }

  const list = records ?? [];

  return (
    <div className="min-h-full w-full min-w-0 bg-[#F7FAFA] text-[#10283D]">
      <div className="border-b border-[#DDE7E8] bg-white p-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-semibold text-[#13334F]">Referral Ledger</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#607583]">
            Review affiliate referrals, qualification status, rewards, and credits.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-8 p-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Invited', value: metrics.invited },
            { label: 'Signed up', value: metrics.signedUp },
            { label: 'Qualified', value: metrics.qualified },
            { label: 'Paid / credited', value: metrics.paidCredited },
          ].map(m => (
            <div key={m.label} className="rounded-xl border border-[#DDE7E8] bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#607583]">{m.label}</div>
              <div className="mt-2 text-2xl font-semibold text-[#13334F]">{m.value}</div>
            </div>
          ))}
        </section>

        <section className="lg:hidden">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#607583]">Ledger</h2>
          <div className="space-y-3">
            {list.map(rec => (
              <div key={rec.id} className="rounded-xl border border-[#DDE7E8] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#13334F]">{rec.referredOrganization}</div>
                    <div className="mt-1 text-sm text-[#607583]">{rec.referrerName}</div>
                    <div className="mt-1 text-xs text-[#9AAAB3]">{rec.facilityType}</div>
                    <div className="mt-1 text-xs text-[#607583]">{trackLabel(rec.track)}</div>
                    <div className="mt-1 text-xs text-[#9AAAB3]">
                      {new Date(rec.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <StatusBadge variant={referralStatusVariant(rec.status)}>
                    {formatStatusLabel(rec.status)}
                  </StatusBadge>
                </div>
                <div className="mt-2 text-sm font-medium text-[#53B59F]">{formatReward(rec)}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={rec.status !== 'qualified'}
                    onClick={() => runApprove(rec.id)}
                    className="min-h-9 rounded-lg bg-[#53B59F] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2F8E7A] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Approve reward
                  </button>
                  <button
                    type="button"
                    disabled={['paid', 'credited', 'ineligible'].includes(rec.status)}
                    onClick={() => runIneligible(rec.id)}
                    className="min-h-9 rounded-lg border border-[#DDE7E8] bg-white px-3 py-2 text-xs font-semibold text-[#13334F] transition-colors hover:bg-[#F7FAFA] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Mark ineligible
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="hidden overflow-x-auto rounded-xl border border-[#DDE7E8] bg-white shadow-sm lg:block">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
              <tr>
                <th className="p-4 font-semibold text-[#13334F]">Referrer</th>
                <th className="p-4 font-semibold text-[#13334F]">Referred</th>
                <th className="p-4 font-semibold text-[#13334F]">Facility type</th>
                <th className="p-4 font-semibold text-[#13334F]">Track</th>
                <th className="p-4 font-semibold text-[#13334F]">Status</th>
                <th className="p-4 font-semibold text-[#13334F]">Reward</th>
                <th className="p-4 font-semibold text-[#13334F]">Created</th>
                <th className="p-4 font-semibold text-[#13334F]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map(rec => (
                <tr key={rec.id} className="border-b border-[#DDE7E8] last:border-0">
                  <td className="p-4 font-medium text-[#13334F]">{rec.referrerName}</td>
                  <td className="p-4 text-[#607583]">{rec.referredOrganization}</td>
                  <td className="max-w-[10rem] p-4 text-[#607583]">{rec.facilityType}</td>
                  <td className="p-4 text-[#607583]">{trackLabel(rec.track)}</td>
                  <td className="p-4">
                    <StatusBadge variant={referralStatusVariant(rec.status)}>
                      {formatStatusLabel(rec.status)}
                    </StatusBadge>
                  </td>
                  <td className="p-4 font-medium text-[#53B59F]">{formatReward(rec)}</td>
                  <td className="whitespace-nowrap p-4 text-[#607583]">
                    {new Date(rec.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={rec.status !== 'qualified'}
                        onClick={() => runApprove(rec.id)}
                        className="rounded-lg bg-[#53B59F] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2F8E7A] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Approve reward
                      </button>
                      <button
                        type="button"
                        disabled={['paid', 'credited', 'ineligible'].includes(rec.status)}
                        onClick={() => runIneligible(rec.id)}
                        className="rounded-lg border border-[#DDE7E8] bg-white px-3 py-2 text-xs font-semibold text-[#13334F] transition-colors hover:bg-[#F7FAFA] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Mark ineligible
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p className="max-w-3xl text-xs leading-relaxed text-[#607583]">
          Demo ledger only — no payouts or credit billing are executed from this console.
        </p>
      </div>
    </div>
  );
}
