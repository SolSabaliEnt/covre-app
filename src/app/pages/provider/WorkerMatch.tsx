import { Link, useParams } from 'react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { StatusBadge } from '../../components/StatusBadge';
import { ArrowLeft, MapPin, Star, CheckCircle2, Shield, TrendingUp, Repeat2 } from 'lucide-react';
import {
  addWorkerToBench,
  bookWorkerForShift,
  getProviderWorkerMatchPage,
  getProviderWorkerProfile,
} from '../../services';
import type { ProviderWorkerMatchPage } from '../../services/types';
import { useProviderAction } from '../../hooks/useProviderAction';
import { useAsyncResource } from '../../hooks/useAsyncResource';

function shiftSummaryLine(page: ProviderWorkerMatchPage): string {
  const { shift } = page;
  return `${shift.roleTitle} · ${shift.siteName} · ${shift.dateLabel}, ${shift.timeRange}`;
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

function NotFoundCard() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-lg rounded-2xl border border-[#DDE7E8] bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-[#13334F]">Shift not found</h1>
      <p className="mt-2 text-sm text-[#607583]">
        This shift was not found for your organization. Return to shift management to choose another
        shift.
      </p>
      <Link
        to="/provider/shifts"
        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to shifts
      </Link>
    </div>
  );
}

function SimulatedNotice({ page }: { page: ProviderWorkerMatchPage }) {
  if (page.source !== 'supabase_shift_mock_candidates') {
    return null;
  }
  return (
    <div
      className="rounded-xl border border-[#DDE7E8] bg-[#F7FAFA] px-4 py-3 text-sm leading-relaxed text-[#607583]"
      role="status"
    >
      Candidate recommendations and booking actions are simulated here. Real worker applications and
      booking acceptance live on shift detail; continuity language in this preview does not bypass that boundary.
    </div>
  );
}

export default function WorkerMatch() {
  const { shiftId } = useParams<{ shiftId: string }>();
  const { run, isPending } = useProviderAction();
  const [bookedByWorker, setBookedByWorker] = useState<Record<string, boolean>>({});
  const [benchByWorker, setBenchByWorker] = useState<Record<string, boolean>>({});

  const { data: page, error, loading, reload } = useAsyncResource(
    () =>
      !shiftId
        ? Promise.resolve({
            ok: false as const,
            error: { code: 'validation', message: 'Shift ID is required.' },
          })
        : getProviderWorkerMatchPage(shiftId),
    [shiftId],
  );

  const { data: siteHistoryByWorker } = useAsyncResource(async () => {
    if (!page) return { ok: true as const, data: {} as Record<string, number> };

    const entries = await Promise.all(
      page.candidates.map(async worker => {
        const result = await getProviderWorkerProfile(worker.id);
        if (!result.ok || !result.data) return [worker.id, 0] as const;
        const siteHistory = result.data.siteFamiliarity.find(site => site.siteId === page.shift.siteId);
        return [worker.id, siteHistory?.shiftCount ?? 0] as const;
      }),
    );

    return { ok: true as const, data: Object.fromEntries(entries) as Record<string, number> };
  }, [page?.shift.id]);

  const isSupabaseSimulated = page?.source === 'supabase_shift_mock_candidates';

  if (!shiftId) {
    return (
      <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
        <NotFoundCard />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
        <LoadingBlock />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
        <ErrorBlock message={error.message} onRetry={reload} />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
        <NotFoundCard />
      </div>
    );
  }

  const { shift, candidates } = page;

  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto w-full max-w-full min-w-0 space-y-6">
        <div className="min-w-0">
          <Link
            to={`/provider/shifts/${shift.id}`}
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Shift details
          </Link>
          <h1 className="break-words text-2xl font-semibold text-[#13334F]">Worker Matches</h1>
          <p className="mt-1 break-words text-sm text-[#607583]">{shiftSummaryLine(page)}</p>
          <p className="mt-1 text-sm text-[#607583]">
            Bill rate: {shift.hourlyPayDisplay}
            {shift.isUrgent ? (
              <span className="ml-2 font-medium text-[#A93636]">· Urgent</span>
            ) : null}
          </p>
        </div>

        <SimulatedNotice page={page} />

        <div className="rounded-xl border border-[#53B59F] bg-[#E6F6F2] p-4">
          <div className="font-semibold text-[#13334F]">
            {candidates.length} qualified workers available
          </div>
          <div className="text-sm text-[#607583]">
            {isSupabaseSimulated
              ? 'Demo workers shown for layout review; matching is not connected yet.'
              : 'Credential fit and prior site history are shown together.'}
          </div>
        </div>

        <div className="space-y-4">
          {candidates.map(worker => {
            const priorShiftsHere = siteHistoryByWorker?.[worker.id] ?? 0;
            const isFamiliarHere = priorShiftsHere > 0;
            return (
              <div
                key={worker.id}
                className="rounded-xl border border-[#DDE7E8] bg-white p-4 transition-all hover:border-[#53B59F] sm:p-6"
              >
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <Link
                      to={`/provider/workers/${worker.id}`}
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#53B59F] text-xl font-semibold text-white no-underline transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] sm:h-16 sm:w-16"
                      aria-label={`Open profile for ${worker.name}`}
                    >
                      {worker.name
                        .split(' ')
                        .map(n => n[0])
                        .join('')}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Link
                          to={`/provider/workers/${worker.id}`}
                          className="break-words text-lg font-semibold text-[#13334F] no-underline hover:text-[#53B59F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] sm:text-xl"
                        >
                          {worker.name}
                        </Link>
                        {worker.status === 'preferred' ? (
                          <StatusBadge variant="preferred">Preferred</StatusBadge>
                        ) : null}
                        {isFamiliarHere ? (
                          <StatusBadge variant="verified">Familiar here</StatusBadge>
                        ) : null}
                      </div>
                      <div className="text-[#607583]">{worker.role}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-[#53B59F]" />
                          <span className="font-medium text-[#13334F]">{worker.score}</span>
                          <span className="text-[#607583]">Covre Score</span>
                        </div>
                        <div className="flex items-center gap-1 text-[#607583]">
                          <MapPin className="h-4 w-4" />
                          {worker.distance}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <div className="text-3xl font-semibold text-[#53B59F]">{worker.score}</div>
                    <div className="text-xs text-[#607583]">Match Score</div>
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-1 gap-3 rounded-lg bg-[#F7FAFA] p-4 sm:grid-cols-3">
                  <div>
                    <div className="mb-1 flex items-center gap-1 text-[#607583]">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-xs">On-Time Rate</span>
                    </div>
                    <div className="text-lg font-semibold text-[#13334F]">{worker.onTime}%</div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-1 text-[#607583]">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs">Worked Here</span>
                    </div>
                    <div className="text-lg font-semibold text-[#13334F]">{priorShiftsHere}×</div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-1 text-[#607583]">
                      <Shield className="h-4 w-4" />
                      <span className="text-xs">Credentials</span>
                    </div>
                    <div className="text-lg font-semibold text-[#13334F]">{worker.credentials.length}</div>
                  </div>
                </div>

                <div
                  className={`mb-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
                    isFamiliarHere
                      ? 'border border-[#BFDCD5] bg-[#E6F6F2] text-[#257665]'
                      : 'border border-[#DDE7E8] bg-[#F7FAFA] text-[#607583]'
                  }`}
                >
                  <Repeat2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    {isFamiliarHere
                      ? `You have worked with ${worker.name} at ${shift.siteName} ${priorShiftsHere} ${priorShiftsHere === 1 ? 'time' : 'times'} before. Covre treats this as a return relationship.`
                      : `New relationship at ${shift.siteName}. No completed shifts together here yet.`}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="mb-2 text-sm font-medium text-[#13334F]">Verified Credentials</div>
                  <div className="flex flex-wrap gap-2">
                    {worker.credentials.map(cred => (
                      <span
                        key={cred}
                        className="flex items-center gap-1 rounded-full bg-[#E6F6F2] px-3 py-1 text-xs font-medium text-[#257665]"
                      >
                        <Shield className="h-3 w-3" />
                        {cred}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#607583]">
                  {isFamiliarHere ? 'Continue this relationship' : 'Start this relationship'}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    disabled={bookedByWorker[worker.id] || isPending(`book-${worker.id}`)}
                    onClick={async e => {
                      e.stopPropagation();
                      const r = await run(`book-${worker.id}`, () =>
                        bookWorkerForShift(worker.id, shift.id),
                      );
                      if (r.ok) {
                        toast.success(r.data.message);
                        setBookedByWorker(prev => ({ ...prev, [worker.id]: true }));
                      } else toast.error(r.error.message);
                    }}
                    className="w-full rounded-lg bg-[#53B59F] px-6 py-3 font-medium text-white transition-colors hover:bg-[#2F8E7A] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
                  >
                    {bookedByWorker[worker.id]
                      ? isSupabaseSimulated
                        ? 'Simulated booking'
                        : isFamiliarHere
                          ? 'Booked again'
                          : 'Booked'
                      : isFamiliarHere
                        ? 'Book Again'
                        : 'Book Worker'}
                  </button>
                  <Link
                    to={`/provider/workers/${worker.id}`}
                    className="flex w-full items-center justify-center rounded-lg bg-[#E8EEF2] px-6 py-3 text-center font-medium text-[#13334F] no-underline transition-colors hover:bg-[#DDE7E8] sm:flex-1"
                  >
                    {isFamiliarHere ? 'View Shared History' : 'View Profile'}
                  </Link>
                  <button
                    type="button"
                    disabled={benchByWorker[worker.id] || isPending(`bench-${worker.id}`)}
                    onClick={async e => {
                      e.stopPropagation();
                      const r = await run(`bench-${worker.id}`, () => addWorkerToBench(worker.id));
                      if (r.ok) {
                        toast.success(r.data.message);
                        setBenchByWorker(prev => ({ ...prev, [worker.id]: true }));
                      } else toast.error(r.error.message);
                    }}
                    className="w-full rounded-lg border border-[#DDE7E8] bg-white px-6 py-3 font-medium text-[#13334F] transition-colors hover:bg-[#F7FAFA] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
                  >
                    {benchByWorker[worker.id]
                      ? isSupabaseSimulated
                        ? 'Simulated bench'
                        : 'Added'
                      : 'Add to Bench'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
