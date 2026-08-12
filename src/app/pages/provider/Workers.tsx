import { Link } from 'react-router';
import { ArrowRight, Calendar, Heart, Users } from 'lucide-react';
import { listProviderShifts } from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';

export default function ProviderWorkers() {
  const { data: shifts, loading } = useAsyncResource(() => listProviderShifts(), []);

  const openShifts =
    shifts?.filter(s => s.providerBoardStatus === 'urgent' || s.providerBoardStatus === 'pending') ??
    [];
  const matchTargets = openShifts.slice(0, 5);

  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto w-full min-w-0 max-w-lg space-y-6">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-[#13334F]">Workers</h1>
          <p className="mt-1 text-sm leading-relaxed text-[#607583]">
            Review applicants, match care workers to shifts, and open worker profiles from here.
          </p>
        </div>

        <div className="rounded-2xl border border-[#DDE7E8] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-[#53B59F]" aria-hidden />
            <p className="text-sm leading-relaxed text-[#607583]">
              Worker matching and applicant review live on each shift. A dedicated workers workspace
              with cross-shift search is coming soon.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Link
            to="/provider/shifts"
            className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 shadow-sm transition-colors hover:border-[#53B59F]/40 no-underline"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Calendar className="h-5 w-5 shrink-0 text-[#53B59F]" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#13334F]">All shifts</span>
                <span className="block text-xs text-[#607583]">Applications and coverage by shift</span>
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-[#9AAAB3]" aria-hidden />
          </Link>

          <Link
            to="/provider/bench"
            className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 shadow-sm transition-colors hover:border-[#53B59F]/40 no-underline"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Heart className="h-5 w-5 shrink-0 text-[#53B59F]" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#13334F]">Covre Bench</span>
                <span className="block text-xs text-[#607583]">Preferred and approved workers</span>
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-[#9AAAB3]" aria-hidden />
          </Link>
        </div>

        <div className="rounded-2xl border border-[#DDE7E8] bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-[#13334F]">Match workers to open shifts</h2>
          <p className="mt-1 text-sm text-[#607583]">
            Choose a shift to review applicants or find workers.
          </p>

          {loading ? (
            <p className="mt-4 text-center text-sm font-medium text-[#13334F]">Loading shifts…</p>
          ) : matchTargets.length === 0 ? (
            <p className="mt-4 text-sm text-[#607583]">
              No open shifts right now. Post a shift from the dashboard or shifts tab.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {matchTargets.map(shift => (
                <li key={shift.id}>
                  <Link
                    to={`/provider/worker-match/${shift.id}`}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-lg bg-[#F7FAFA] px-3 py-2.5 text-sm transition-colors hover:bg-[#EEF4F5] no-underline"
                  >
                    <span className="min-w-0 truncate font-medium text-[#13334F]">
                      {shift.roleTitle} · {shift.siteName}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[#53B59F]" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
