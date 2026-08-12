import { Link } from 'react-router';
import { Award, CheckCircle2, Clock, Star, TrendingUp, Building2 } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { getWorkerReputation } from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';

export default function Reputation() {
  const { data: worker, error, loading, reload } = useAsyncResource(
    () => getWorkerReputation('worker-001'),
    [],
  );

  const score = worker?.covreScore ?? 94;
  const completed = worker?.completedShifts ?? 87;
  const onTime = worker?.onTimeRatePct ?? 98;
  const repeat = worker?.repeatRequests ?? 42;
  const preferred = worker?.preferredByFacilities ?? 14;

  if (loading) {
    return (
      <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 text-[#10283D]">
        <Link
          to="/worker/account"
          className="mb-4 inline-flex text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
        >
          ← Back to Account
        </Link>
        <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
          <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 text-[#10283D]">
        <Link
          to="/worker/account"
          className="mb-4 inline-flex text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
        >
          ← Back to Account
        </Link>
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
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 text-[#10283D]">
      <Link
        to="/worker/account"
        className="mb-4 inline-flex text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
      >
        ← Back to Account
      </Link>
      {/* Header */}
      <div className="border-b border-[#DDE7E8] bg-white p-5 sm:p-6">
        <h1 className="mb-4 text-2xl font-semibold text-[#13334F]">Covre Score</h1>

        {/* Score Card */}
        <div className="rounded-2xl bg-gradient-to-br from-[#53B59F] to-[#2F8E7A] p-5 text-center text-white sm:p-6">
          <div className="mb-2 text-sm opacity-90">Your Covre Score</div>
          <div className="mb-2 text-6xl font-semibold">{score}</div>
          <StatusBadge variant="verified">
            <Star className="mr-1 h-3 w-3" />
            Excellent Standing
          </StatusBadge>
        </div>
      </div>

      {/* Metrics */}
      <div className="border-b border-[#DDE7E8] bg-white p-5 sm:p-6">
        <h3 className="mb-4 font-semibold text-[#13334F]">Score Breakdown</h3>
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-[#53B59F]" />
                <span className="text-sm text-[#607583]">Completed Shifts</span>
              </div>
              <span className="font-semibold text-[#13334F]">{completed}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#EEF4F5]">
              <div className="h-full bg-[#53B59F]" style={{ width: '100%' }} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#53B59F]" />
                <span className="text-sm text-[#607583]">On-Time Rate</span>
              </div>
              <span className="font-semibold text-[#13334F]">{onTime}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#EEF4F5]">
              <div className="h-full bg-[#53B59F]" style={{ width: '98%' }} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#53B59F]" />
                <span className="text-sm text-[#607583]">Repeat Requests</span>
              </div>
              <span className="font-semibold text-[#13334F]">{repeat}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#EEF4F5]">
              <div className="h-full bg-[#53B59F]" style={{ width: '85%' }} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-[#53B59F]" />
                <span className="text-sm text-[#607583]">Preferred by Facilities</span>
              </div>
              <span className="font-semibold text-[#13334F]">{preferred}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#EEF4F5]">
              <div className="h-full bg-[#53B59F]" style={{ width: '70%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="py-4">
        <h3 className="mb-3 px-1 font-semibold text-[#13334F]">Achievements</h3>
        <div className="space-y-4">
          <div className="rounded-xl border border-[#DDE7E8] bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E6F6F2]">
                <Award className="h-6 w-6 text-[#257665]" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="mb-1 font-semibold text-[#13334F]">Credential Master</h4>
                <p className="text-sm text-[#607583]">All credentials verified and current</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#DDE7E8] bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E6F6F2]">
                <Building2 className="h-6 w-6 text-[#257665]" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="mb-1 font-semibold text-[#13334F]">Facility Familiar</h4>
                <p className="text-sm text-[#607583]">Worked at 8+ different facilities</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#DDE7E8] bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E6F6F2]">
                <CheckCircle2 className="h-6 w-6 text-[#257665]" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="mb-1 font-semibold text-[#13334F]">Reliable Pro</h4>
                <p className="text-sm text-[#607583]">50+ completed shifts with 0 no-shows</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#DDE7E8] bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E6F6F2]">
                <Star className="h-6 w-6 text-[#257665]" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="mb-1 font-semibold text-[#13334F]">Preferred Worker</h4>
                <p className="text-sm text-[#607583]">Added to 14 facility benches</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
