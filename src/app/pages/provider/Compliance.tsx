import { useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { ClipboardList, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  generateProviderCompliancePacketFromApprovedTimesheet,
  listCompliancePackets,
  type CompliancePacketRow,
} from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useProviderAction } from '../../hooks/useProviderAction';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';

function PacketBadge({ packet }: { packet: CompliancePacketRow }) {
  if (packet.isSimulated) {
    return (
      <StatusBadge variant="pending">{packet.statusLabel ?? 'Pending booking'}</StatusBadge>
    );
  }
  if (packet.hasGeneratedSnapshot) {
    return <StatusBadge variant="covered">Snapshot generated</StatusBadge>;
  }
  if (packet.canGenerateSnapshot) {
    return <StatusBadge variant="pending">Ready for packet</StatusBadge>;
  }
  if (packet.packetStatus === 'ready') {
    return <StatusBadge variant="covered">Ready</StatusBadge>;
  }
  if (packet.packetStatus === 'review') {
    return <StatusBadge variant="pending">Needs Review</StatusBadge>;
  }
  return <StatusBadge variant="missing">Missing Signature</StatusBadge>;
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

function EmptyBlock() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-full rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm font-medium text-[#13334F]">No shifts yet</p>
      <p className="mt-2 text-center text-sm text-[#607583]">
        Post a shift to see compliance readiness rows here. Full packets require bookings,
        credentials, and timesheets.
      </p>
    </div>
  );
}

function MockComplianceView() {
  const { data: compliancePackets, error, loading, reload } = useAsyncResource(
    () => listCompliancePackets(),
    [],
  );
  const [queuedIds, setQueuedIds] = useState<Set<string>>(() => new Set());

  return (
    <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 pb-8">
      <div className="mx-auto w-full min-w-0 max-w-full space-y-6">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-[#13334F]">Compliance packets</h1>
          <p className="mt-1 text-sm text-[#607583]">
            Keep shift records, credentials, approvals, and incident notes audit-ready.
          </p>
        </div>

        {loading && <LoadingBlock />}
        {error && <ErrorBlock message={error.message} onRetry={reload} />}

        {!loading && !error && compliancePackets && compliancePackets.length === 0 && (
          <EmptyBlock />
        )}

        {!loading && !error && compliancePackets && compliancePackets.length > 0 && (
          <div className="space-y-4">
            {compliancePackets.map(packet => (
              <article
                key={packet.id}
                className="overflow-hidden rounded-2xl border border-[#DDE7E8] bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E6F6F2] text-[#257665]">
                      <ClipboardList className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-semibold text-[#13334F]">
                        {packet.shiftRoleTitle} — {packet.siteName}
                      </h2>
                      <p className="mt-0.5 text-sm text-[#607583]">{packet.shiftWhen}</p>
                      {packet.isSimulated && (
                        <p className="mt-1 text-xs text-[#9AAAB3]">Simulated readiness · not a generated packet</p>
                      )}
                    </div>
                  </div>
                  <PacketBadge packet={packet} />
                </div>

                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-[#607583]">Worker</dt>
                    <dd className="text-[#10283D]">{packet.workerName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-[#607583]">Site</dt>
                    <dd className="text-[#10283D]">{packet.siteName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-[#607583]">
                      Credentials active at shift time
                    </dt>
                    <dd className="text-[#10283D]">{packet.credentialsAtShift}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-[#607583]">Clock in / out</dt>
                    <dd className="text-[#10283D]">{packet.clockSummary}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-[#607583]">Approval status</dt>
                    <dd className="text-[#10283D]">{packet.approvalLine}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-[#607583]">Incident notes</dt>
                    <dd className="text-[#10283D]">{packet.incidentNotes}</dd>
                  </div>
                  {packet.isSimulated && packet.missingItems && packet.missingItems.length > 0 && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-[#607583]">
                        Required before packet
                      </dt>
                      <dd className="text-[#10283D]">
                        <ul className="mt-1 list-inside list-disc space-y-0.5">
                          {packet.missingItems.map(item => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  )}
                </dl>

                <button
                  type="button"
                  disabled={queuedIds.has(packet.id)}
                  onClick={() => {
                    if (packet.isSimulated) {
                      toast.message(
                        'Compliance packet generation will be connected after bookings, credentials, and timesheets are wired.',
                      );
                    } else {
                      toast.success('Compliance packet download queued');
                    }
                    setQueuedIds(prev => new Set(prev).add(packet.id));
                  }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#13334F] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#0B243A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-4 w-4 shrink-0" aria-hidden />
                  {queuedIds.has(packet.id)
                    ? 'Queued'
                    : packet.isSimulated
                      ? 'Queue packet'
                      : 'Download Packet'}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SupabaseComplianceView() {
  const { run, isPending } = useProviderAction();
  const { data: compliancePackets, error, loading, reload } = useAsyncResource(
    () => listCompliancePackets(),
    [],
  );

  return (
    <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 pb-8">
      <div className="mx-auto w-full min-w-0 max-w-full space-y-6">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-[#13334F]">Compliance packets</h1>
          <p className="mt-1 text-sm text-[#607583]">
            Compliance readiness and snapshot records from approved timesheets.
          </p>
          <p className="mt-3 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm leading-relaxed text-[#607583]">
            This creates a compliance packet snapshot record. PDF/file generation is not connected yet.
            Shift prep rows still await booking and timesheet approval.
          </p>
        </div>

        {loading && <LoadingBlock />}
        {error && <ErrorBlock message={error.message} onRetry={reload} />}

        {!loading && !error && compliancePackets && compliancePackets.length === 0 && (
          <EmptyBlock />
        )}

        {!loading && !error && compliancePackets && compliancePackets.length > 0 && (
          <div className="space-y-4">
            {compliancePackets.map(packet => (
              <article
                key={packet.id}
                className="overflow-hidden rounded-2xl border border-[#DDE7E8] bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E6F6F2] text-[#257665]">
                      <ClipboardList className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-semibold text-[#13334F]">
                        {packet.shiftRoleTitle} — {packet.siteName}
                      </h2>
                      <p className="mt-0.5 text-sm text-[#607583]">{packet.shiftWhen}</p>
                      {packet.isSimulated && (
                        <p className="mt-1 text-xs text-[#9AAAB3]">
                          Simulated readiness · not a generated packet
                        </p>
                      )}
                      {packet.hasGeneratedSnapshot && (
                        <p className="mt-1 text-xs text-[#9AAAB3]">
                          Snapshot record only · file pending
                        </p>
                      )}
                    </div>
                  </div>
                  <PacketBadge packet={packet} />
                </div>

                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-[#607583]">Worker</dt>
                    <dd className="text-[#10283D]">{packet.workerName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-[#607583]">Site</dt>
                    <dd className="text-[#10283D]">{packet.siteName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-[#607583]">
                      Credentials active at shift time
                    </dt>
                    <dd className="text-[#10283D]">{packet.credentialsAtShift}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-[#607583]">Clock in / out</dt>
                    <dd className="text-[#10283D]">{packet.clockSummary}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-[#607583]">Approval status</dt>
                    <dd className="text-[#10283D]">{packet.approvalLine}</dd>
                  </div>
                  {packet.hasGeneratedSnapshot && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-[#607583]">File</dt>
                      <dd className="text-[#10283D]">Pending</dd>
                    </div>
                  )}
                  {packet.isSimulated && packet.missingItems && packet.missingItems.length > 0 && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-[#607583]">
                        Required before packet
                      </dt>
                      <dd className="text-[#10283D]">
                        <ul className="mt-1 list-inside list-disc space-y-0.5">
                          {packet.missingItems.map(item => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  )}
                </dl>

                {packet.canGenerateSnapshot && packet.timesheetId && (
                  <button
                    type="button"
                    disabled={isPending(`packet-${packet.timesheetId}`)}
                    onClick={async () => {
                      const r = await run(`packet-${packet.timesheetId}`, () =>
                        generateProviderCompliancePacketFromApprovedTimesheet(packet.timesheetId!),
                      );
                      if (r.ok) {
                        toast.success(r.data.message);
                        reload();
                      } else {
                        toast.error(r.error.message);
                      }
                    }}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#13334F] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#0B243A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Generate packet snapshot
                  </button>
                )}

                {packet.isSimulated && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.message(
                        'Compliance packet generation will be connected after bookings, credentials, and timesheets are wired.',
                      );
                    }}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm font-medium text-[#13334F] transition-colors hover:bg-[#F7FAFA]"
                  >
                    Queue packet
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Compliance() {
  const supabaseMode = isSupabaseBackendEnabled();
  if (supabaseMode) {
    return <SupabaseComplianceView />;
  }
  return <MockComplianceView />;
}
