import { Link } from 'react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { StatusBadge } from '../../components/StatusBadge';
import { Star, Shield, Calendar, Users, Bookmark, History } from 'lucide-react';
import { getProviderBench, inviteWorkerToShift } from '../../services';
import { useProviderAction } from '../../hooks/useProviderAction';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import type { ProviderBenchWorker } from '../../services/types';

function workerInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('');
}

function LoadingBlock() {
  return (
    <div className="flex min-h-full items-center justify-center bg-[#F7FAFA] px-4 py-12 text-sm text-[#607583]">
      Loading bench…
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

function BenchEmptyState({ message }: { message?: string }) {
  return (
    <div className="rounded-xl border border-[#DDE7E8] bg-white p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-[#13334F]">No bench relationships yet</h2>
      <p className="mt-2 text-sm leading-relaxed text-[#607583]">
        {message ??
          'Workers you deliberately save will appear here. Approved work history remains separate.'}
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          to="/provider/shifts"
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#2F8E7A]"
        >
          <Calendar className="h-4 w-4 shrink-0" aria-hidden />
          Review open shifts
        </Link>
        <Link
          to="/provider/workers"
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm font-semibold text-[#13334F] no-underline transition-colors hover:bg-[#F7FAFA]"
        >
          <Users className="h-4 w-4 shrink-0" aria-hidden />
          View workers
        </Link>
      </div>
    </div>
  );
}

function MockBenchWorkerRow({
  worker,
  sectionTitle,
  invited,
  isPending,
  onInvite,
}: {
  worker: ProviderBenchWorker;
  sectionTitle: string;
  invited: boolean;
  isPending: (key: string) => boolean;
  onInvite: (worker: ProviderBenchWorker, sectionTitle: string) => void;
}) {
  const role = worker.roleLabel ?? 'Care worker';
  const score = worker.score ?? 0;
  const shifts = worker.shifts ?? worker.completedShiftCount ?? 0;

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-[#F7FAFA] p-4 transition-colors hover:bg-[#EEF4F5] sm:flex-row sm:items-center sm:justify-between">
      <Link
        to={`/provider/workers/${worker.id}`}
        className="flex min-w-0 items-center gap-4 no-underline"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#53B59F] font-semibold text-white">
          {workerInitials(worker.name)}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-[#13334F] hover:text-[#53B59F]">{worker.name}</div>
          <div className="text-sm text-[#607583]">{role}</div>
        </div>
      </Link>

      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <div className="text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-sm text-[#607583]">
            <Star className="h-4 w-4" />
            Score
          </div>
          <div className="font-semibold text-[#13334F]">{score}</div>
        </div>
        <div className="text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-sm text-[#607583]">
            <Shield className="h-4 w-4" />
            Shifts
          </div>
          <div className="font-semibold text-[#13334F]">{shifts}</div>
        </div>
        <button
          type="button"
          disabled={invited || isPending(`bench-invite-${sectionTitle}-${worker.id}`)}
          onClick={async e => {
            e.stopPropagation();
            onInvite(worker, sectionTitle);
          }}
          className="w-full rounded-lg bg-[#53B59F] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2F8E7A] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {invited ? 'Invited' : 'Invite to Shift'}
        </button>
      </div>
    </div>
  );
}

function SupabaseBenchWorkerRow({
  worker,
  isSaved,
}: {
  worker: ProviderBenchWorker;
  isSaved: boolean;
}) {
  const role = worker.roleLabel ?? 'Care worker';
  const approvedCount = worker.completedShiftCount ?? 0;

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-[#F7FAFA] p-4 sm:flex-row sm:items-center sm:justify-between">
      <Link
        to={`/provider/workers/${worker.id}`}
        className="flex min-w-0 items-center gap-4 no-underline"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#53B59F] font-semibold text-white">
          {workerInitials(worker.name)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-semibold text-[#13334F] hover:text-[#53B59F]">{worker.name}</div>
            {isSaved ? <StatusBadge variant="preferred">Saved</StatusBadge> : null}
          </div>
          <div className="text-sm text-[#607583]">{role}</div>
          <p className="mt-1 text-xs text-[#607583]">
            {approvedCount > 0
              ? `${approvedCount} approved ${approvedCount === 1 ? 'shift' : 'shifts'} together${worker.lastWorkedAt ? ` · Last approved ${worker.lastWorkedAt}` : ''}`
              : 'Saved intentionally · no approved work together yet'}
          </p>
        </div>
      </Link>

      <Link
        to={`/provider/workers/${worker.id}`}
        className="inline-flex w-full items-center justify-center rounded-lg border border-[#DDE7E8] bg-white px-4 py-2 text-sm font-medium text-[#13334F] no-underline transition-colors hover:bg-[#EEF4F5] sm:w-auto"
      >
        {approvedCount > 0 ? 'View shared history' : 'View profile'}
      </Link>
    </div>
  );
}

export default function Bench() {
  const { run, isPending } = useProviderAction();
  const { data, error, loading, reload } = useAsyncResource(() => getProviderBench(), []);
  const [invited, setInvited] = useState<Record<string, boolean>>({});

  const handleMockInvite = async (worker: ProviderBenchWorker, sectionTitle: string) => {
    const r = await run(`bench-invite-${sectionTitle}-${worker.id}`, () =>
      inviteWorkerToShift(worker.id),
    );
    if (r.ok) {
      toast.success(r.data.message);
      setInvited(prev => ({ ...prev, [worker.id]: true }));
    } else {
      toast.error(r.error.message);
    }
  };

  if (loading) return <LoadingBlock />;
  if (error || !data) {
    return <ErrorBlock message={error?.message ?? 'Unable to load bench.'} onRetry={reload} />;
  }

  const isSupabase = data.isSupabaseBacked;
  const hasWorkers = data.sections.some(s => s.workers.length > 0);

  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto w-full max-w-full min-w-0 space-y-6">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-[#13334F]">Covre Bench</h1>
          <p className="mt-1 text-sm text-[#607583]">
            {isSupabase
              ? 'Workers you choose to keep close, separated from workers you simply know through approved work.'
              : 'Your trusted pool of preferred workers'}
          </p>
        </div>

        {isSupabase ? (
          <div className="rounded-2xl border border-[#BFDCD5] bg-[#E6F6F2] p-4">
            <div className="flex items-start gap-3">
              <Bookmark className="mt-0.5 h-5 w-5 shrink-0 text-[#257665]" aria-hidden />
              <div>
                <p className="font-semibold text-[#13334F]">Bench means deliberate provider preference.</p>
                <p className="mt-1 text-sm leading-relaxed text-[#607583]">
                  Approved work history can make someone familiar without putting them on your bench. Do-not-send workers stay out of these bench-facing lists while their verified history remains intact.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {isSupabase && !hasWorkers ? <BenchEmptyState message={data.message} /> : null}

        {data.sections.map(section =>
          section.workers.length === 0 ? null : (
            <div key={section.title} className="rounded-xl border border-[#DDE7E8] bg-white p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {isSupabase && section.title === 'Saved to your Bench' ? (
                      <Bookmark className="h-4 w-4 text-[#53B59F]" aria-hidden />
                    ) : isSupabase ? (
                      <History className="h-4 w-4 text-[#607583]" aria-hidden />
                    ) : null}
                    <h2 className="text-lg font-semibold text-[#13334F] sm:text-xl">{section.title}</h2>
                  </div>
                  {isSupabase ? (
                    <p className="mt-1 text-xs leading-relaxed text-[#607583]">
                      {section.title === 'Saved to your Bench'
                        ? 'Explicitly saved by your organization. This does not imply mutual preference.'
                        : 'Familiar through approved work, but not explicitly saved to your bench.'}
                    </p>
                  ) : null}
                </div>
                <StatusBadge variant="preferred">
                  {section.workers.length} worker{section.workers.length === 1 ? '' : 's'}
                </StatusBadge>
              </div>

              <div className="space-y-3">
                {section.workers.map(worker =>
                  isSupabase ? (
                    <SupabaseBenchWorkerRow
                      key={`${section.title}-${worker.id}`}
                      worker={worker}
                      isSaved={section.title === 'Saved to your Bench'}
                    />
                  ) : (
                    <MockBenchWorkerRow
                      key={`${section.title}-${worker.id}`}
                      worker={worker}
                      sectionTitle={section.title}
                      invited={Boolean(invited[worker.id])}
                      isPending={isPending}
                      onInvite={handleMockInvite}
                    />
                  ),
                )}
              </div>
            </div>
          ),
        )}

        {isSupabase && hasWorkers ? (
          <p className="text-center text-xs leading-relaxed text-[#607583]">
            Covre Bench is provider-private. Worker return preferences remain private to workers and are not shown here.
          </p>
        ) : null}
      </div>
    </div>
  );
}
