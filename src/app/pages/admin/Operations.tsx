import { Link } from 'react-router';
import {
  Activity,
  Building2,
  CalendarCheck,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  HeartHandshake,
  MousePointerClick,
  Network,
  Repeat2,
  ServerCog,
  Users,
} from 'lucide-react';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import {
  getAdminContinuityReadiness,
  getAdminContinuitySummary,
  getAdminMarketplaceDashboard,
  getContinuityTelemetrySummary,
  type AdminContinuityReadiness,
  type AdminContinuitySummary,
  type AdminMarketplaceSummary,
  type ContinuityTelemetrySummary,
} from '../../services';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';

type MetricCardProps = {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
  to?: string;
  accent?: boolean;
};

function MetricCard({ label, value, detail, icon: Icon, to, accent }: MetricCardProps) {
  const card = (
    <div className="h-full rounded-2xl border border-[#DDE7E8] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#607583]">{label}</p>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
            accent ? 'bg-[#E6F6F2] text-[#257665]' : 'bg-[#E8EEF2] text-[#13334F]'
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="text-3xl font-semibold tracking-tight text-[#13334F]">{value}</p>
      <p className="mt-2 text-sm leading-5 text-[#607583]">{detail}</p>
    </div>
  );

  return to ? (
    <Link to={to} className="block h-full no-underline transition-transform hover:-translate-y-0.5">
      {card}
    </Link>
  ) : (
    card
  );
}

function MarketplaceEngine({ summary }: { summary: AdminMarketplaceSummary }) {
  const people = summary.workerCount + summary.providerCount;
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-[#13334F]">Marketplace engine</h2>
        <p className="mt-1 text-sm text-[#607583]">
          Are people entering, booking, completing work, and leaving a reliable record behind?
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="People" value={people} detail={`${summary.workerCount} workers · ${summary.providerCount} provider organizations`} icon={Users} to="/admin/users" />
        <MetricCard label="Open shifts" value={summary.openShiftCount} detail={`${summary.bookedShiftCount} shifts currently booked or further along`} icon={CalendarCheck} to="/admin/marketplace" />
        <MetricCard label="Bookings" value={summary.bookingCount} detail="Confirmed marketplace relationships recorded in Covre" icon={Building2} to="/admin/marketplace" />
        <MetricCard label="Approved work" value={summary.approvedTimesheetCount} detail={`${summary.submittedTimesheetCount} timesheets still awaiting a provider decision`} icon={ClipboardCheck} to="/admin/payments" />
      </div>
    </section>
  );
}

function ContinuitySignals({ summary }: { summary: AdminContinuitySummary }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-[#13334F]">Continuity + durable relationships</h2>
        <p className="mt-1 max-w-4xl text-sm text-[#607583]">
          What remains after a shift: familiarity, repeated trust, and work that becomes easier to return to.
          These signals come from approved work history, not self-awarded community scores.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Workers with history" value={summary.workersWithHistory} detail="Workers with at least one approved work event" icon={Users} accent />
        <MetricCard label="Repeat-site workers" value={summary.repeatSiteWorkers} detail="Workers who have returned to at least one care site" icon={Repeat2} accent />
        <MetricCard label="Familiar site ties" value={summary.familiarWorkerSiteTies} detail="Worker + site relationships with two or more approved shifts" icon={HeartHandshake} accent />
        <MetricCard label="Repeat provider ties" value={summary.repeatProviderWorkerTies} detail="Worker + provider relationships with two or more approved shifts" icon={Network} accent />
        <MetricCard label="Returning work share" value={`${summary.returningWorkSharePct}%`} detail="Approved work beyond the first shift in an already-familiar worker/site relationship" icon={Activity} accent />
      </div>
      {summary.sampled ? <p className="mt-3 text-xs text-[#9B6419]">Continuity metrics are calculated from the most recent 5,000 approved work records.</p> : null}
    </section>
  );
}

function ContinuityReadinessPanel({ summary }: { summary: AdminContinuityReadiness }) {
  const fullyReady = summary.totalCount > 0 && summary.readyCount === summary.totalCount;
  const missingCount = Math.max(0, summary.totalCount - summary.readyCount);

  return (
    <section className="rounded-2xl border border-[#DDE7E8] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <ServerCog className="h-5 w-5 text-[#2F8E7A]" aria-hidden />
            <h2 className="text-base font-semibold text-[#13334F]">Continuity readiness</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#607583]">
            Production infrastructure required by Covre’s continuity workflow. This checks database capabilities only—never worker/provider records and never browser-local experiment telemetry.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${fullyReady ? 'bg-[#E6F6F2] text-[#257665]' : 'bg-[#FFF4E0] text-[#9B6419]'}`}>
          {summary.diagnosticAvailable
            ? fullyReady
              ? `${summary.readyCount}/${summary.totalCount} ready`
              : `${missingCount} missing · ${summary.readyCount}/${summary.totalCount} ready`
            : 'Mock mode · not checked'}
        </span>
      </div>

      {!summary.diagnosticAvailable ? (
        <div className="mt-4 rounded-xl border border-[#DDE7E8] bg-[#F7FAFA] p-4 text-sm text-[#607583]">
          Database readiness cannot be verified in mock mode. Switch Covre to its Supabase backend and sign in as an admin to run the diagnostic.
        </div>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {summary.items.map(item => (
            <div key={item.key} className={`rounded-xl border p-4 ${item.ready ? 'border-[#BFDCD5] bg-[#F3FBF9]' : 'border-[#F4D39C] bg-[#FFF9EF]'}`}>
              <div className="flex items-start gap-3">
                {item.ready ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#2F8E7A]" aria-hidden /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#9B6419]" aria-hidden />}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#13334F]">{item.label}</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#607583]">{item.kind}</span>
                  </div>
                  <p className="mt-1 break-all text-xs text-[#607583]">{item.migration}</p>
                  <p className={`mt-2 text-xs font-semibold ${item.ready ? 'text-[#257665]' : 'text-[#9B6419]'}`}>{item.ready ? 'Available in connected database' : 'Not detected in connected database'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {summary.diagnosticAvailable ? (
        <p className="mt-4 text-xs text-[#9AAAB3]">
          Checked {new Date(summary.checkedAt).toLocaleString()}. This reports capability presence, not whether a migration-history table contains a particular filename.
        </p>
      ) : null}
    </section>
  );
}

function ExperimentSignals({ summary }: { summary: ContinuityTelemetrySummary }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#13334F]">Continuity experiment</h2>
          <p className="mt-1 max-w-4xl text-sm text-[#607583]">
            Are the new continuity surfaces changing behavior? This first telemetry seam records only small product-event context such as shift/site IDs and counts—no message contents or sensitive profile data.
          </p>
        </div>
        <span className="rounded-full bg-[#E8EEF2] px-3 py-1 text-xs font-semibold text-[#607583]">Preview telemetry · this browser</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Familiar impressions" value={summary.familiarOpportunityImpressions} detail={`${summary.familiarOpportunityOpenRatePct}% opened from a surfaced familiar opportunity`} icon={Activity} accent />
        <MetricCard label="Familiar opens" value={summary.familiarOpportunityOpens} detail={`${summary.familiarShiftDetailViews} familiar shift-detail views recorded`} icon={MousePointerClick} accent />
        <MetricCard label="Familiar applications" value={summary.familiarShiftApplications} detail={`${summary.familiarApplicationRatePct}% of familiar detail views led to an application event`} icon={CalendarCheck} accent />
        <MetricCard label="Return preferences" value={summary.returnPreferencesSaved} detail={`${summary.providerRebookActions} provider rebook actions · ${summary.providerReturnIntents} return intents`} icon={HeartHandshake} accent />
      </div>
      <p className="mt-3 text-xs text-[#9AAAB3]">This is not cross-user production analytics yet. Events are capped and stored locally until Covre has an approved analytics persistence contract.</p>
    </section>
  );
}

export default function AdminOperations() {
  const supabaseMode = isSupabaseBackendEnabled();
  const marketplace = useAsyncResource(() => getAdminMarketplaceDashboard(), []);
  const continuity = useAsyncResource(() => getAdminContinuitySummary(), []);
  const readiness = useAsyncResource(() => getAdminContinuityReadiness(), []);
  const experiment = getContinuityTelemetrySummary();

  const loading = marketplace.loading || continuity.loading;
  const error = marketplace.error ?? continuity.error;

  return (
    <div className="min-h-full bg-[#F7FAFA]">
      <header className="border-b border-[#DDE7E8] bg-white px-6 py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2F8E7A]">Covre control center</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#13334F]">Operations + Continuity</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#607583]">Marketplace truth beside the durable value Covre is trying to create: reliable work, familiar places, repeat relationships, and a reason to keep building here.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin" className="rounded-xl border border-[#DDE7E8] bg-white px-4 py-2.5 text-sm font-semibold text-[#13334F] no-underline hover:bg-[#F7FAFA]">Overview</Link>
            <Link to="/admin/full-app" className="rounded-xl bg-[#13334F] px-4 py-2.5 text-sm font-semibold text-white no-underline hover:bg-[#0B243A]">Full App</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 p-6">
        {!supabaseMode ? <div className="rounded-xl border border-[#DDE7E8] bg-[#E8EEF2] px-4 py-3 text-sm text-[#607583]">Mock mode is active. Marketplace metrics are demo values; readiness is not a database check; experiment telemetry below reflects actions in this browser.</div> : null}

        {readiness.loading ? (
          <section className="rounded-2xl border border-[#DDE7E8] bg-white p-5 text-sm text-[#607583] shadow-sm">Checking continuity infrastructure…</section>
        ) : readiness.error ? (
          <section className="rounded-2xl border border-[#F4A83D] bg-[#FFF4E0] p-5">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#9B6419]" aria-hidden />
              <div>
                <h2 className="font-semibold text-[#13334F]">Continuity readiness could not be checked.</h2>
                <p className="mt-1 text-sm text-[#9B6419]">{readiness.error.message}</p>
                <button type="button" onClick={readiness.reload} className="mt-3 rounded-lg bg-[#13334F] px-4 py-2 text-sm font-semibold text-white">Retry diagnostic</button>
              </div>
            </div>
          </section>
        ) : readiness.data ? <ContinuityReadinessPanel summary={readiness.data} /> : null}

        {loading ? (
          <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 text-center text-sm text-[#607583]">Loading operations and continuity signals…</div>
        ) : error ? (
          <div className="rounded-2xl border border-[#F4A83D] bg-[#FFF4E0] p-5">
            <p className="font-semibold text-[#13334F]">Some control-center metrics could not load.</p>
            <p className="mt-2 text-sm text-[#9B6419]">{error.message}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={marketplace.reload} className="rounded-lg bg-[#13334F] px-4 py-2 text-sm font-semibold text-white">Retry marketplace</button>
              <button type="button" onClick={continuity.reload} className="rounded-lg border border-[#DDE7E8] bg-white px-4 py-2 text-sm font-semibold text-[#13334F]">Retry continuity</button>
            </div>
          </div>
        ) : (
          <>
            {marketplace.data ? <MarketplaceEngine summary={marketplace.data.summary} /> : null}
            {continuity.data ? <ContinuitySignals summary={continuity.data} /> : null}
          </>
        )}

        <ExperimentSignals summary={experiment} />

        <section className="rounded-2xl border border-[#DDE7E8] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2F8E7A]">Retention test</p>
              <h2 className="mt-1 text-lg font-semibold text-[#13334F]">Is tenure making Covre more valuable?</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-[#607583]">Use this view to ask whether repeat work is creating familiarity and durable relationships—not merely whether booking volume is rising. A five-year Covre worker should have more useful history, trust, and familiar places than a five-week worker.</p>
            </div>
            <Link to="/admin/full-app" className="text-sm font-semibold text-[#2F8E7A] underline decoration-[#53B59F] underline-offset-4">Inspect product surfaces →</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
