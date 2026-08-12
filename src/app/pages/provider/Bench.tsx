import { Link } from 'react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { StatusBadge } from '../../components/StatusBadge';
import { Star, Shield, Plus, Calendar, Users } from 'lucide-react';
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
      <h2 className="text-lg font-semibold text-[#13334F]">Your bench is empty</h2>
      <p className="mt-2 text-sm leading-relaxed text-[#607583]">
        {message ??
          'Workers you book or save will appear here once bench management is connected.'}
      </p>
      <p className="mt-3 text-sm text-[#607583]">
        Bench is not built yet. Preferred-worker lists and save-to-bench will ship in a later pass.
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

function SupabaseBenchWorkerRow({ worker }: { worker: ProviderBenchWorker }) {
  const role = worker.roleLabel ?? 'Care worker';

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
          <div className="font-semibold text-[#13334F] hover:text-[#53B59F]">{worker.name}</div>
          <div className="text-sm text-[#607583]">{role}</div>
          {worker.completedShiftCount != null && worker.completedShiftCount > 0 ? (
            <p className="mt-1 text-xs text-[#607583]">
              {worker.completedShiftCount} confirmed booking
              {worker.completedShiftCount === 1 ? '' : 's'}
              {worker.lastWorkedAt ? ` · Last booked ${worker.lastWorkedAt}` : ''}
            </p>
          ) : null}
        </div>
      </Link>

      <button
        type="button"
        disabled
        title="Shift invites from bench are coming soon"
        className="w-full cursor-not-allowed rounded-lg border border-[#DDE7E8] bg-white px-4 py-2 text-sm font-medium text-[#607583] opacity-80 sm:w-auto"
      >
        Invite coming soon
      </button>
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
    return <ErrorBlock message={error ?? 'Unable to load bench.'} onRetry={reload} />;
  }

  const isSupabase = data.isSupabaseBacked;
  const hasWorkers = data.sections.some(s => s.workers.length > 0);

  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto w-full max-w-full min-w-0 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold text-[#13334F]">Covre Bench</h1>
            <p className="mt-1 text-sm text-[#607583]">
              {isSupabase
                ? 'Workers you have booked with your organization'
                : 'Your trusted pool of preferred workers'}
            </p>
          </div>
          <button
            type="button"
            disabled={isSupabase}
            onClick={() => {
              if (isSupabase) {
                toast.message(
                  'Save-to-bench is coming soon. Book workers from shift applications for now.',
                );
                return;
              }
              toast.success('Add worker request queued');
            }}
            className="flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[#53B59F] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2F8E7A] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:text-base"
          >
            <Plus className="h-5 w-5" />
            {isSupabase ? 'Add worker (soon)' : 'Add Worker'}
          </button>
        </div>

        {isSupabase && !hasWorkers ? <BenchEmptyState message={data.message} /> : null}

        {data.sections.map(section =>
          section.workers.length === 0 ? null : (
            <div key={section.title} className="rounded-xl border border-[#DDE7E8] bg-white p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-[#13334F] sm:text-xl">{section.title}</h2>
                <StatusBadge variant="preferred">
                  {section.workers.length} worker{section.workers.length === 1 ? '' : 's'}
                </StatusBadge>
              </div>

              <div className="space-y-3">
                {section.workers.map(worker =>
                  isSupabase ? (
                    <SupabaseBenchWorkerRow key={`${section.title}-${worker.id}`} worker={worker} />
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
          <p className="text-center text-xs text-[#607583]">
            Preferred bench lists and save-to-bench are coming soon. Only confirmed bookings are
            shown — no scores or simulated invites.
          </p>
        ) : null}
      </div>
    </div>
  );
}
