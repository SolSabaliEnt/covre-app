import { Link } from 'react-router';
import { Building2, ChevronRight, Plus, Users } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { listProviderSites } from '../../services';
import type { CareSite } from '../../data/types';
import { useAsyncResource } from '../../hooks/useAsyncResource';

function SiteStatus({ status }: { status: CareSite['operationalStatus'] }) {
  if (status === 'active') {
    return <StatusBadge variant="covered">Active</StatusBadge>;
  }
  return <StatusBadge variant="pending">Needs Review</StatusBadge>;
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
        className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B243A]"
      >
        Retry
      </button>
    </div>
  );
}

export default function Sites() {
  const { data: careSites, error, loading, reload } = useAsyncResource(() => listProviderSites(), []);

  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto w-full min-w-0 max-w-full space-y-6">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold text-[#13334F]">Care sites</h1>
            <p className="mt-1 text-sm text-[#607583]">
              Manage locations, orientation details, and site-specific staffing requirements.
            </p>
          </div>
          <Link
            to="/provider/sites/new"
            className="flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-center text-sm font-semibold text-[#13334F] shadow-sm transition-colors hover:bg-[#F7FAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] no-underline sm:w-auto"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Plus className="h-4 w-4 text-[#53B59F]" aria-hidden />
              Add Site
            </span>
          </Link>
        </div>

        {loading && <LoadingBlock />}
        {error && <ErrorBlock message={error.message} onRetry={reload} />}

        {!loading && !error && careSites && careSites.length === 0 && (
          <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-[#607583]">No care sites yet.</p>
            <Link
              to="/provider/sites/new"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-semibold text-white no-underline hover:bg-[#2F8E7A]"
            >
              Add your first site
            </Link>
          </div>
        )}

        {!loading && !error && careSites && careSites.length > 0 && (
          <div className="space-y-3">
            {careSites.map(site => (
              <Link
                key={site.id}
                to={`/provider/sites/${site.id}`}
                className="flex min-w-0 max-w-full items-stretch gap-3 overflow-hidden rounded-2xl border border-[#DDE7E8] bg-white p-4 shadow-sm transition-colors hover:border-[#53B59F]/50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] no-underline"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E6F6F2] text-[#257665]">
                  <Building2 className="h-6 w-6" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-[#13334F]">{site.name}</h2>
                      <p className="mt-0.5 text-sm text-[#607583]">{site.facilityType}</p>
                    </div>
                    <SiteStatus status={site.operationalStatus} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#607583]">
                    <span>
                      <span className="font-medium text-[#13334F]">{site.residents}</span> residents
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 shrink-0 text-[#53B59F]" aria-hidden />
                      <span className="font-medium text-[#13334F]">{site.preferredWorkerSlots}</span>{' '}
                      preferred workers
                    </span>
                  </div>
                </div>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 self-center text-[#B8C6CC]" aria-hidden />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
