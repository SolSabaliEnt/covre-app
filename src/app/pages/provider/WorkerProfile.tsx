import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, MapPin, Shield, Star, Building2, ClipboardList, StickyNote, Repeat2 } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { ProviderShiftInviteControl } from '../../components/ProviderShiftInviteControl';
import {
  addWorkerToBench,
  getCanonicalProviderWorkerProfile,
  markWorkerDoNotSend,
} from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useProviderAction } from '../../hooks/useProviderAction';

function LoadingBlock() {
  return (
    <div className="mx-auto w-full max-w-full min-w-0 rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm font-medium text-[#13334F]">Loading profile…</p>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-full min-w-0 rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm text-[#607583]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B243A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
      >
        Retry
      </button>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#607583]">{children}</h2>
  );
}

export default function WorkerProfile() {
  const { workerId = '' } = useParams<{ workerId: string }>();
  const loader = useCallback(() => getCanonicalProviderWorkerProfile(workerId), [workerId]);
  const { data: profile, error, loading, reload } = useAsyncResource(loader, [workerId]);
  const { run, isPending } = useProviderAction();
  const [benchDone, setBenchDone] = useState(false);
  const [dnsDone, setDnsDone] = useState(false);

  useEffect(() => {
    setBenchDone(false);
    setDnsDone(false);
  }, [workerId]);

  const shiftsTogether = profile?.reliability.completedShifts ?? 0;
  const repeatPlaces = profile?.siteFamiliarity.filter(site => site.shiftCount > 1).length ?? 0;
  const strongestSite = profile?.siteFamiliarity[0];

  if (!workerId) {
    return (
      <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
        <NotFoundCard />
      </div>
    );
  }

  return (
    <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 pb-28">
      <div className="mx-auto w-full max-w-full min-w-0 space-y-6">
        <Link
          to="/provider/bench"
          className="inline-flex min-h-11 min-w-0 items-center gap-2 text-sm font-medium text-[#53B59F] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">Back to Covre Bench</span>
        </Link>

        {loading && <LoadingBlock />}
        {error && <ErrorBlock message={error.message} onRetry={reload} />}
        {!loading && !error && profile === null && <NotFoundCard />}

        {!loading && !error && profile && (
          <>
            <header className="overflow-hidden rounded-2xl border border-[#DDE7E8] bg-white p-5 shadow-sm">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#53B59F] text-xl font-semibold text-white">
                  {profile.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="break-words text-2xl font-semibold text-[#13334F]">{profile.name}</h1>
                    {profile.isPreferredBench ? <StatusBadge variant="preferred">Preferred bench</StatusBadge> : null}
                    {profile.isVerified ? <StatusBadge variant="verified">Verified</StatusBadge> : null}
                    {profile.isSupabaseBacked ? <StatusBadge variant="verified">Approved-work history</StatusBadge> : null}
                  </div>
                  <p className="mt-1 text-sm text-[#607583]">{profile.roles.join(' · ')}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5 text-[#607583]">
                      <MapPin className="h-4 w-4 shrink-0 text-[#53B59F]" aria-hidden />
                      <span className="min-w-0 break-words">{profile.location}</span>
                    </span>
                    {typeof profile.covreScore === 'number' ? (
                      <span className="flex items-center gap-1.5 font-medium text-[#13334F]">
                        <Star className="h-4 w-4 shrink-0 text-[#53B59F]" aria-hidden />
                        Covre Score {profile.covreScore}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </header>

            <section>
              <SectionTitle>Your history with {profile.name}</SectionTitle>
              <div className="rounded-2xl border border-[#BFDCD5] bg-[#E6F6F2] p-4 shadow-sm">
                {shiftsTogether > 0 ? (
                  <>
                    <div className="flex items-start gap-3">
                      <Repeat2 className="mt-0.5 h-5 w-5 shrink-0 text-[#257665]" aria-hidden />
                      <div>
                        <p className="font-semibold text-[#13334F]">You are not starting from zero with this worker.</p>
                        <p className="mt-1 text-sm leading-relaxed text-[#607583]">
                          {profile.name} has {shiftsTogether} approved {shiftsTogether === 1 ? 'shift' : 'shifts'} with your organization.
                          {strongestSite ? ` ${strongestSite.siteName} is the place you know each other best.` : ''}
                        </p>
                        {profile.firstWorkedLabel || profile.lastWorkedLabel ? (
                          <p className="mt-2 text-xs text-[#607583]">
                            {profile.firstWorkedLabel ? `First approved work: ${profile.firstWorkedLabel}.` : ''}{' '}
                            {profile.lastWorkedLabel ? `Most recent: ${profile.lastWorkedLabel}.` : ''}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#BFDCD5] pt-4">
                      <div>
                        <p className="text-xl font-semibold text-[#13334F]">{shiftsTogether}</p>
                        <p className="text-xs text-[#607583]">approved shifts together</p>
                      </div>
                      <div>
                        <p className="text-xl font-semibold text-[#13334F]">{repeatPlaces}</p>
                        <p className="text-xs text-[#607583]">repeat places</p>
                      </div>
                      <div>
                        <p className="text-xl font-semibold text-[#13334F]">{strongestSite?.shiftCount ?? 0}</p>
                        <p className="text-xs text-[#607583]">at top site</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start gap-3">
                    <Repeat2 className="mt-0.5 h-5 w-5 shrink-0 text-[#257665]" aria-hidden />
                    <div>
                      <p className="font-semibold text-[#13334F]">New approved-work relationship</p>
                      <p className="mt-1 text-sm text-[#607583]">
                        No approved shifts together yet. Covre will preserve verified history as work is approved.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section>
              <SectionTitle>Credentials</SectionTitle>
              <div className="rounded-xl border border-[#DDE7E8] bg-white p-4 shadow-sm">
                {profile.credentials.length === 0 ? (
                  <p className="text-sm text-[#607583]">No provider-visible credentials are available for this worker yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {profile.credentials.map(c => (
                      <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <Shield className="h-4 w-4 shrink-0 text-[#257665]" aria-hidden />
                        <span className="font-medium text-[#13334F]">{c.name}</span>
                        <span className="text-[#607583]">({c.category})</span>
                        {c.verified ? <StatusBadge variant="verified">Verified</StatusBadge> : <StatusBadge variant="pending">Pending</StatusBadge>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section>
              <SectionTitle>{profile.isSupabaseBacked ? 'Verified work history' : 'Reliability'}</SectionTitle>
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#DDE7E8] bg-white p-4 shadow-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium text-[#607583]">{profile.isSupabaseBacked ? 'Approved shifts together' : 'Completed shifts'}</p>
                  <p className="mt-1 text-lg font-semibold text-[#13334F]">{profile.reliability.completedShifts}</p>
                </div>
                {typeof profile.reliability.onTimeRatePct === 'number' ? (
                  <div>
                    <p className="text-xs font-medium text-[#607583]">On-time rate</p>
                    <p className="mt-1 text-lg font-semibold text-[#13334F]">{profile.reliability.onTimeRatePct}%</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-[#607583]">Care sites together</p>
                    <p className="mt-1 text-lg font-semibold text-[#13334F]">{profile.distinctSiteCount}</p>
                  </div>
                )}
                {typeof profile.reliability.repeatRequests === 'number' ? (
                  <div>
                    <p className="text-xs font-medium text-[#607583]">Repeat requests</p>
                    <p className="mt-1 text-lg font-semibold text-[#13334F]">{profile.reliability.repeatRequests}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-[#607583]">Repeat places</p>
                    <p className="mt-1 text-lg font-semibold text-[#13334F]">{repeatPlaces}</p>
                  </div>
                )}
              </div>
            </section>

            <section>
              <SectionTitle>Places you&apos;ve worked together</SectionTitle>
              <div className="rounded-xl border border-[#DDE7E8] bg-white p-4 shadow-sm">
                {profile.siteFamiliarity.length === 0 ? (
                  <p className="text-sm text-[#607583]">No approved assignments together yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {profile.siteFamiliarity.map(s => (
                      <li key={s.siteId} className="flex min-w-0 items-start justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-start gap-2">
                          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#53B59F]" aria-hidden />
                          <span className="min-w-0 break-words font-medium text-[#13334F]">{s.siteName}</span>
                        </span>
                        <span className="shrink-0 text-[#607583]">{s.shiftCount} approved</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section>
              <SectionTitle>{profile.isSupabaseBacked ? 'Recent approved work' : 'Recent work history'}</SectionTitle>
              <div className="rounded-xl border border-[#DDE7E8] bg-white p-4 shadow-sm">
                {profile.recentShifts.length === 0 ? (
                  <p className="text-sm text-[#607583]">No recent approved work is available for this worker.</p>
                ) : (
                  <ul className="space-y-3">
                    {profile.recentShifts.map(s => (
                      <li key={s.shiftId} className="border-b border-[#EEF4F5] pb-3 last:border-0 last:pb-0">
                        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-[#13334F]">{s.roleTitle}</p>
                            <p className="text-sm text-[#607583]">{s.siteName}</p>
                            <p className="mt-1 text-xs text-[#9AAAB3]">{s.dateLabel} · {s.timeRange}</p>
                          </div>
                          <Link
                            to={`/provider/worker-match/${s.shiftId}`}
                            className="shrink-0 text-xs font-medium text-[#53B59F] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
                          >
                            Match view
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {profile.providerNotes ? (
              <section>
                <SectionTitle>Provider notes</SectionTitle>
                <div className="flex gap-3 rounded-xl border border-[#DDE7E8] bg-white p-4 shadow-sm">
                  <StickyNote className="mt-0.5 h-5 w-5 shrink-0 text-[#607583]" aria-hidden />
                  <p className="min-w-0 text-sm leading-relaxed text-[#607583]">{profile.providerNotes}</p>
                </div>
              </section>
            ) : null}

            <section className="space-y-3 pb-4">
              <SectionTitle>Relationship actions</SectionTitle>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  disabled={benchDone || isPending(`profile-bench-${profile.id}`)}
                  onClick={async e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const r = await run(`profile-bench-${profile.id}`, () => addWorkerToBench(profile.id));
                    if (r.ok) {
                      toast.success(r.data.message);
                      setBenchDone(true);
                    } else toast.error(r.error.message);
                  }}
                  className="w-full rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#13334F] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
                >
                  {benchDone ? 'Added to Bench' : profile.isPreferredBench ? 'On your Bench' : 'Add to Bench'}
                </button>
                <button
                  type="button"
                  disabled={dnsDone || isPending(`profile-dns-${profile.id}`)}
                  onClick={async e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const r = await run(`profile-dns-${profile.id}`, () => markWorkerDoNotSend(profile.id));
                    if (r.ok) {
                      toast.success(r.data.message);
                      setDnsDone(true);
                    } else toast.error(r.error.message);
                  }}
                  className="w-full rounded-xl border border-[#DDE7E8] bg-[#FDEAEA]/40 px-4 py-3 text-sm font-semibold text-[#A93636] transition-colors hover:bg-[#FDEAEA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
                >
                  {dnsDone ? 'Marked do not send' : 'Do Not Send'}
                </button>
              </div>

              <ProviderShiftInviteControl workerId={profile.id} hasPriorHistory={shiftsTogether > 0} />

              {profile.isSupabaseBacked ? (
                <p className="text-xs leading-relaxed text-[#607583]">
                  Approved-work history, provider relationship state, and shift invitations are separate records. An invitation never books the worker automatically.
                </p>
              ) : null}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function NotFoundCard() {
  return (
    <div className="mx-auto mt-4 w-full max-w-md rounded-2xl border border-[#DDE7E8] bg-white p-8 text-center shadow-sm">
      <ClipboardList className="mx-auto h-10 w-10 text-[#607583]" aria-hidden />
      <h1 className="mt-4 text-lg font-semibold text-[#13334F]">Worker not found</h1>
      <p className="mt-2 text-sm text-[#607583]">We couldn&apos;t load this worker for your provider workspace.</p>
      <Link
        to="/provider/bench"
        className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B243A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
      >
        Back to Covre Bench
      </Link>
    </div>
  );
}
