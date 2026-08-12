import { Link, useParams } from 'react-router';
import { ArrowLeft, MessageSquare, StickyNote } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { toast } from 'sonner';
import { getAdminShift } from '../../services';
import type { AdminShiftOperations, Shift } from '../../data/types';
import { useAsyncResource } from '../../hooks/useAsyncResource';

function PayBadge({ s }: { s: AdminShiftOperations['paymentStatus'] }) {
  if (s === 'released') {
    return <StatusBadge variant="covered">Released</StatusBadge>;
  }
  if (s === 'hold') {
    return <StatusBadge variant="missing">Hold</StatusBadge>;
  }
  return <StatusBadge variant="pending">Pending</StatusBadge>;
}

function InvBadge({ s }: { s: AdminShiftOperations['invoiceStatus'] }) {
  return s === 'paid' ? (
    <StatusBadge variant="covered">Paid</StatusBadge>
  ) : (
    <StatusBadge variant="pending">Open</StatusBadge>
  );
}

function clockLine(shift: Shift): string {
  if (shift.lifecycleStatus === 'Clocked In') {
    return 'Clocked in (mock)';
  }
  if (!shift.assignedWorkerId) {
    return '—';
  }
  return `Scheduled (${shift.lifecycleStatus})`;
}

function NotFoundCard() {
  return (
    <div className="border-b border-[#DDE7E8] bg-white p-6">
      <div className="mx-auto max-w-lg">
        <div className="rounded-2xl border border-[#DDE7E8] bg-[#F7FAFA] p-6">
          <h1 className="text-lg font-semibold text-[#13334F]">Shift not found</h1>
          <p className="mt-2 text-sm text-[#607583]">This shift ID is not in the preview dataset.</p>
          <Link
            to="/admin/marketplace"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ShiftDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useAsyncResource(
    () => (!id ? Promise.resolve({ ok: true as const, data: null }) : getAdminShift(id)),
    [id],
  );

  if (loading) {
    return (
      <div className="border-b border-[#DDE7E8] bg-white p-6">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
          <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="border-b border-[#DDE7E8] bg-white p-6">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
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
  if (!data) {
    return <NotFoundCard />;
  }

  const { shift, operations: rec, workerLabel } = data;
  const scheduled = `${shift.dateLabel} · ${shift.timeRange}`;

  return (
    <>
      <div className="border-b border-[#DDE7E8] bg-white p-6">
        <div className="mx-auto max-w-7xl">
          <Link
            to="/admin/marketplace"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to marketplace
          </Link>
          <h1 className="text-3xl font-semibold text-[#13334F]">Shift Detail</h1>
          <p className="mt-1 font-mono text-sm text-[#607583]">{rec.displayShiftCode}</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => toast('Dispute case opened')}
            className="rounded-lg bg-[#A93636] px-4 py-2 text-sm font-medium text-white hover:bg-[#8B2B2B]"
          >
            Open Dispute
          </button>
          <button
            type="button"
            onClick={() => toast('Payment hold applied')}
            className="rounded-lg border border-[#F4A83D] bg-[#FFF4E0] px-4 py-2 text-sm font-medium text-[#9B6419] hover:bg-[#FFE8C4]"
          >
            Put Payment Hold
          </button>
          <button
            type="button"
            onClick={() => toast.success('Shift marked resolved')}
            className="rounded-lg bg-[#53B59F] px-4 py-2 text-sm font-medium text-white hover:bg-[#2F8E7A]"
          >
            Mark Resolved
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <dl className="rounded-xl border border-[#DDE7E8] bg-white p-5">
            <dt className="text-xs font-semibold uppercase text-[#607583]">Provider</dt>
            <dd className="mt-1 text-[#10283D]">{shift.providerName}</dd>
            <dt className="mt-4 text-xs font-semibold uppercase text-[#607583]">Site</dt>
            <dd className="mt-1 text-[#10283D]">{shift.siteName}</dd>
            <dt className="mt-4 text-xs font-semibold uppercase text-[#607583]">Role</dt>
            <dd className="mt-1 text-[#10283D]">{shift.roleTitle}</dd>
            <dt className="mt-4 text-xs font-semibold uppercase text-[#607583]">Worker</dt>
            <dd className="mt-1 text-[#10283D]">{workerLabel}</dd>
            <dt className="mt-4 text-xs font-semibold uppercase text-[#607583]">Scheduled time</dt>
            <dd className="mt-1 text-[#10283D]">{scheduled}</dd>
            <dt className="mt-4 text-xs font-semibold uppercase text-[#607583]">Clock in / out</dt>
            <dd className="mt-1 text-[#10283D]">{clockLine(shift)}</dd>
          </dl>
          <dl className="rounded-xl border border-[#DDE7E8] bg-white p-5">
            <dt className="text-xs font-semibold uppercase text-[#607583]">Payment status</dt>
            <dd className="mt-1">
              <PayBadge s={rec.paymentStatus} />
            </dd>
            <dt className="mt-4 text-xs font-semibold uppercase text-[#607583]">Invoice status</dt>
            <dd className="mt-1">
              <InvBadge s={rec.invoiceStatus} />
            </dd>
            <dt className="mt-4 text-xs font-semibold uppercase text-[#607583]">Credential eligibility</dt>
            <dd className="mt-1 text-sm text-[#10283D]">{rec.credentialEligibility}</dd>
            <dt className="mt-4 text-xs font-semibold uppercase text-[#607583]">Risk score</dt>
            <dd className="mt-1 text-sm font-medium text-[#13334F]">{rec.riskScoreLabel}</dd>
          </dl>
        </div>

        <section className="rounded-xl border border-[#DDE7E8] bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold text-[#13334F]">Timeline</h2>
          <ul className="space-y-2 text-sm text-[#10283D]">
            {rec.timeline.map(line => (
              <li key={line} className="flex gap-2 border-l-2 border-[#53B59F]/40 pl-3">
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-[#DDE7E8] bg-white p-5">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-[#13334F]">
            <MessageSquare className="h-5 w-5 text-[#53B59F]" />
            Messages
          </h2>
          <p className="rounded-lg bg-[#F7FAFA] p-4 text-sm text-[#607583]">{rec.messagesPlaceholder}</p>
        </section>

        <section className="rounded-xl border border-[#DDE7E8] bg-white p-5">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-[#13334F]">
            <StickyNote className="h-5 w-5 text-[#607583]" />
            Admin notes
          </h2>
          <p className="text-sm text-[#10283D]">{rec.adminNotes || '—'}</p>
        </section>
      </div>
    </>
  );
}
