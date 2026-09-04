import { Link } from 'react-router';
import { ArrowRight, Calendar, Heart, History, Repeat2, Users } from 'lucide-react';
import { getProviderBench, listProviderShifts, trackContinuityEvent } from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import type { ProviderBenchWorker } from '../../services/types';

function relationshipCount(worker: ProviderBenchWorker): number {
  return worker.completedShiftCount ?? worker.shifts ?? 0;
}

function buildKnownWorkers(sections: { workers: ProviderBenchWorker[] }[]): ProviderBenchWorker[] {
  const byId = new Map<string, ProviderBenchWorker>();

  for (const section of sections) {
    for (const worker of section.workers) {
      const existing = byId.get(worker.id);
      if (!existing || relationshipCount(worker) > relationshipCount(existing)) {
        byId.set(worker.id, worker);
      }
    }
  }

  return [...byId.values()]
    .filter(worker => relationshipCount(worker) > 0)
    .sort((a, b) => relationshipCount(b) - relationshipCount(a));
}

export default function ProviderWorkers() {
  const { data: shifts, loading: shiftsLoading } = useAsyncResource(() => listProviderShifts(), []);
  const { data: bench, loading: benchLoading } = useAsyncResource(() => getProviderBench(), []);

  const openShifts =
    shifts?.filter(s => s.providerBoardStatus === 'urgent' || s.providerBoardStatus === 'pending') ?? [];
  const matchTargets = openShifts.slice(0, 5);
  const knownWorkers = buildKnownWorkers(bench?.sections ?? []).slice(0, 6);
  const repeatWorkers = knownWorkers.filter(worker => relationshipCount(worker) > 1);
  const isSupabase = Boolean(bench?.isSupabaseBacked);

  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto w-full min-w-0 max-w-lg space-y-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2F8E7A]">Provider continuity</p>
          <h1 className="mt-1 break-words text-2xl font-semibold text-[#13334F]">Workers</h1>
          <p className="mt-1 text-sm leading-relaxed text-[#607583]">
            Find new coverage without losing sight of the workers your organization already knows.
          </p>
        </div>

        <div className="rounded-2xl border border-[#BFDCD5] bg-[#E6F6F2] p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <Repeat2 className="mt-0.5 h-5 w-5 shrink-0 text-[#257665]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#13334F]">Your organization is building working history.</p>
              <p className="mt-1 text-sm leading-relaxed text-[#607583]">
                {benchLoading
                  ? 'Loading the workers you already know…'
                  : repeatWorkers.length > 0
                    ? `${repeatWorkers.length} ${repeatWorkers.length === 1 ? 'worker has' : 'workers have'} more than one booking relationship with your organization.`
                    : knownWorkers.length > 0
                      ? 'You have workers with prior booking history. Repeat relationships will become more visible as you work together again.'
                      : 'Once you book workers, Covre will keep those relationships visible instead of treating every shift like a first meeting.'}
              </p>
            </div>
          </div>
        </div>

        {knownWorkers.length > 0 ? (
          <section className="rounded-2xl border border-[#DDE7E8] bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#607583]">People you know</p>
                <h2 className="mt-1 text-lg font-semibold text-[#13334F]">Repeat-worker memory</h2>
                <p className="mt-1 text-sm leading-relaxed text-[#607583]">
                  {isSupabase
                    ? 'Based on confirmed, accepted, or completed bookings with your organization.'
                    : 'Preview relationships derived from the provider demo history.'}
                </p>
              </div>
              <Link to="/provider/bench" className="shrink-0 text-sm font-semibold text-[#2F8E7A] hover:underline">
                Full bench
              </Link>
            </div>

            <div className="space-y-3">
              {knownWorkers.map(worker => {
                const count = relationshipCount(worker);
                const repeat = count > 1;
                const regular = count >= 5;

                return (
                  <div key={worker.id} className="rounded-xl border border-[#DDE7E8] bg-[#F7FAFA] p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/provider/workers/${worker.id}`}
                            onClick={() => {
                              if (!repeat) return;
                              trackContinuityEvent('provider_repeat_worker_open', {
                                actor: 'provider',
                                workerId: worker.id,
                                source: 'workers_workspace_name',
                                completedShiftsHere: count,
                              });
                            }}
                            className="break-words font-semibold text-[#13334F] no-underline hover:text-[#2F8E7A]"
                          >
                            {worker.name}
                          </Link>
                          {repeat ? (
                            <span className="rounded-full bg-[#E6F6F2] px-2.5 py-1 text-xs font-semibold text-[#257665]">
                              {regular ? 'Regular with you' : 'Worked together before'}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-[#607583]">{worker.roleLabel ?? 'Care worker'}</p>
                        {worker.lastWorkedAt ? <p className="mt-1 text-xs text-[#9AAAB3]">Last booked {worker.lastWorkedAt}</p> : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-2xl font-semibold text-[#13334F]">{count}</p>
                        <p className="text-xs text-[#607583]">bookings together</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 border-t border-[#DDE7E8] pt-3 sm:flex-row">
                      <Link
                        to={`/provider/workers/${worker.id}`}
                        onClick={() => {
                          if (!repeat) return;
                          trackContinuityEvent('provider_repeat_worker_open', {
                            actor: 'provider',
                            workerId: worker.id,
                            source: 'workers_workspace_shared_history',
                            completedShiftsHere: count,
                          });
                        }}
                        className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#13334F] px-3 py-2 text-sm font-semibold text-white no-underline hover:bg-[#0B243A]"
                      >
                        <History className="h-4 w-4" aria-hidden />
                        {repeat ? 'View shared history' : 'View profile'}
                      </Link>
                      <Link
                        to="/provider/shifts"
                        onClick={() => {
                          if (!repeat) return;
                          trackContinuityEvent('provider_return_intent', {
                            actor: 'provider',
                            workerId: worker.id,
                            source: 'workers_workspace_work_together_again',
                            completedShiftsHere: count,
                          });
                        }}
                        className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#DDE7E8] bg-white px-3 py-2 text-sm font-semibold text-[#13334F] no-underline hover:bg-[#F7FAFA]"
                      >
                        <Calendar className="h-4 w-4" aria-hidden />
                        {repeat ? 'Work together again' : 'Find a shift'}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

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
                <span className="block text-xs text-[#607583]">Workers with history, preference, or approval</span>
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-[#9AAAB3]" aria-hidden />
          </Link>
        </div>

        <div className="rounded-2xl border border-[#DDE7E8] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-[#53B59F]" aria-hidden />
            <div>
              <h2 className="text-base font-semibold text-[#13334F]">Match workers to open shifts</h2>
              <p className="mt-1 text-sm text-[#607583]">Choose a shift to compare credential fit with prior site familiarity.</p>
            </div>
          </div>

          {shiftsLoading ? (
            <p className="mt-4 text-center text-sm font-medium text-[#13334F]">Loading shifts…</p>
          ) : matchTargets.length === 0 ? (
            <p className="mt-4 text-sm text-[#607583]">No open shifts right now. Post a shift from the dashboard or shifts tab.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {matchTargets.map(shift => (
                <li key={shift.id}>
                  <Link
                    to={`/provider/worker-match/${shift.id}`}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-lg bg-[#F7FAFA] px-3 py-2.5 text-sm transition-colors hover:bg-[#EEF4F5] no-underline"
                  >
                    <span className="min-w-0 truncate font-medium text-[#13334F]">{shift.roleTitle} · {shift.siteName}</span>
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