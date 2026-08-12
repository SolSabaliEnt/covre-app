import { useParams, Link } from 'react-router';
import { ArrowLeft, FileText, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { getAdminIncident } from '../../services';
import type { IncidentWorkflowStatus } from '../../data/types';
import { useAsyncResource } from '../../hooks/useAsyncResource';

function workflowLabel(status: IncidentWorkflowStatus): string {
  if (status === 'under-review') return 'Under Review';
  if (status === 'pending') return 'Pending';
  return 'Resolved';
}

function NotFoundCard() {
  return (
    <div className="w-full max-w-lg pb-10">
      <div className="rounded-2xl border border-[#DDE7E8] bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-[#13334F]">Incident not found</h1>
        <p className="mt-2 text-sm text-[#607583]">This incident is not in the preview dataset.</p>
        <Link
          to="/admin/incidents"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to incidents
        </Link>
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="w-full max-w-lg pb-10">
      <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
        <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
      </div>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="w-full max-w-lg pb-10">
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

export default function IncidentDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useAsyncResource(
    () => (!id ? Promise.resolve({ ok: true as const, data: undefined }) : getAdminIncident(id)),
    [id],
  );

  if (loading) {
    return <LoadingCard />;
  }
  if (error) {
    return <ErrorCard message={error.message} onRetry={reload} />;
  }
  if (!data) {
    return <NotFoundCard />;
  }

  return (
    <div className="w-full max-w-5xl pb-10">
      <div className="border-b border-[#DDE7E8] bg-white px-6 py-4">
        <Link
          to="/admin/incidents"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Incidents
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#13334F]">Incident {data.id}</h1>
            <p className="mt-1 text-[#607583]">{data.type}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-[#DDE7E8] bg-white px-4 py-2 text-sm font-medium text-[#13334F] transition-colors hover:bg-[#F7FAFA]"
              onClick={() => toast.success('Incident marked under review')}
            >
              Mark Under Review
            </button>
            <button
              type="button"
              className="rounded-lg border border-[#DDE7E8] bg-white px-4 py-2 text-sm font-medium text-[#13334F] transition-colors hover:bg-[#F7FAFA]"
              onClick={() => toast.success('Statement request queued')}
            >
              Request Statement
            </button>
            <button
              type="button"
              className="rounded-lg bg-[#53B59F] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2F8E7A]"
              onClick={() => toast.success('Incident resolved')}
            >
              Resolve Incident
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <dl className="rounded-xl border border-[#DDE7E8] bg-white p-5">
            <dt className="text-xs font-medium uppercase tracking-wide text-[#607583]">Severity</dt>
            <dd className="mt-1 font-semibold text-[#13334F]">{data.severity}</dd>
            <dt className="mt-4 text-xs font-medium uppercase tracking-wide text-[#607583]">Status</dt>
            <dd className="mt-1 font-semibold text-[#13334F]">{workflowLabel(data.status)}</dd>
            <dt className="mt-4 text-xs font-medium uppercase tracking-wide text-[#607583]">Reported</dt>
            <dd className="mt-1 text-[#13334F]">{data.reportedAt}</dd>
          </dl>
          <dl className="rounded-xl border border-[#DDE7E8] bg-white p-5">
            <dt className="text-xs font-medium uppercase tracking-wide text-[#607583]">Worker</dt>
            <dd className="mt-1 font-semibold text-[#13334F]">{data.workerName}</dd>
            <dt className="mt-4 text-xs font-medium uppercase tracking-wide text-[#607583]">Provider</dt>
            <dd className="mt-1 text-[#13334F]">{data.providerName}</dd>
            <dt className="mt-4 text-xs font-medium uppercase tracking-wide text-[#607583]">Site</dt>
            <dd className="mt-1 text-[#13334F]">{data.siteName}</dd>
            <dt className="mt-4 text-xs font-medium uppercase tracking-wide text-[#607583]">Shift</dt>
            <dd className="mt-1 text-[#13334F]">{data.shiftSummary}</dd>
          </dl>
        </div>

        <section className="rounded-xl border border-[#DDE7E8] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#13334F]">Timeline</h2>
          <ol className="mt-4 space-y-3 border-l-2 border-[#DDE7E8] pl-4">
            <li className="text-sm text-[#607583]">
              <span className="font-medium text-[#13334F]">{data.reportedAt}</span> — Report submitted
            </li>
            <li className="text-sm text-[#607583]">Triaged by Covre Trust &amp; Safety (mock)</li>
            <li className="text-sm text-[#607583]">Provider acknowledged (mock)</li>
          </ol>
        </section>

        <section className="rounded-xl border border-[#DDE7E8] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#13334F]">Worker statement</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#607583]">{data.workerStatement}</p>
        </section>

        <section className="rounded-xl border border-[#DDE7E8] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#13334F]">Provider response</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#607583]">{data.providerResponse}</p>
        </section>

        <section className="rounded-xl border border-[#DDE7E8] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#13334F]">Internal notes</h2>
          <p className="mt-2 text-sm text-[#607583]">{data.internalNotes}</p>
        </section>

        <section className="rounded-xl border border-dashed border-[#DDE7E8] bg-[#F7FAFA] p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#13334F]">
            <Paperclip className="h-5 w-5 text-[#607583]" aria-hidden />
            Attached documents
          </h2>
          <p className="mt-2 text-sm text-[#607583]">
            No files attached in this preview. Document uploads will appear here when connected to storage.
          </p>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A]"
          >
            <FileText className="h-4 w-4" aria-hidden />
            Placeholder: add document (mock)
          </button>
        </section>
      </div>
    </div>
  );
}
