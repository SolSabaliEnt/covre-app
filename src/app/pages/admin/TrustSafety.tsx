import { StatusBadge } from '../../components/StatusBadge';
import { AlertOctagon, FileWarning, Home, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { listTrustSafetyFlags } from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';

const TRUST_ICONS = [AlertOctagon, FileWarning, Home, Repeat] as const;

function Sev({ level }: { level: 'high' | 'medium' | 'low' }) {
  if (level === 'high') {
    return <StatusBadge variant="urgent">High</StatusBadge>;
  }
  if (level === 'medium') {
    return <StatusBadge variant="pending">Medium</StatusBadge>;
  }
  return <StatusBadge variant="new">Low</StatusBadge>;
}

function RowActions({ label }: { label: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => toast(`${label}: review queued`)}
        className="rounded-lg bg-[#13334F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0B243A]"
      >
        Review
      </button>
      <button
        type="button"
        onClick={() => toast(`${label}: suspension draft saved`)}
        className="rounded-lg border border-[#D94A4A] bg-white px-3 py-1.5 text-xs font-medium text-[#A93636] hover:bg-[#FDEAEA]"
      >
        Suspend
      </button>
      <button
        type="button"
        onClick={() => toast(`${label}: flag cleared`)}
        className="rounded-lg border border-[#DDE7E8] bg-white px-3 py-1.5 text-xs font-medium text-[#607583] hover:bg-[#F7FAFA]"
      >
        Clear Flag
      </button>
    </div>
  );
}

export default function TrustSafety() {
  const { data, error, loading, reload } = useAsyncResource(() => listTrustSafetyFlags(), []);

  if (loading) {
    return (
      <>
        <div className="border-b border-[#DDE7E8] bg-white p-6">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-3xl font-semibold text-[#13334F]">Trust &amp; Safety</h1>
          </div>
        </div>
        <div className="mx-auto max-w-7xl p-6">
          <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
            <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
          </div>
        </div>
      </>
    );
  }
  if (error) {
    return (
      <>
        <div className="border-b border-[#DDE7E8] bg-white p-6">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-3xl font-semibold text-[#13334F]">Trust &amp; Safety</h1>
          </div>
        </div>
        <div className="mx-auto max-w-7xl p-6">
          <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
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
      </>
    );
  }
  if (!data) {
    return null;
  }

  const { metrics: trustMetrics, flaggedWorkers, flaggedProviders, riskSignals } = data;

  return (
    <>
      <div className="border-b border-[#DDE7E8] bg-white p-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-semibold text-[#13334F]">Trust &amp; Safety</h1>
          <p className="mt-1 text-[#607583]">
            Monitor flagged workers, facilities, documents, and risky marketplace behavior.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {trustMetrics.map((m, i) => {
            const Icon = TRUST_ICONS[i] ?? AlertOctagon;
            return (
              <div key={m.label} className="rounded-xl border border-[#DDE7E8] bg-white p-5">
                <div
                  className={`mb-3 flex h-11 w-11 items-center justify-center rounded-lg ${
                    m.tone === 'danger'
                      ? 'bg-[#FDEAEA]'
                      : m.tone === 'warn'
                        ? 'bg-[#FFF4E0]'
                        : 'bg-[#E8EEF2]'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      m.tone === 'danger' ? 'text-[#D94A4A]' : m.tone === 'warn' ? 'text-[#9B6419]' : 'text-[#13334F]'
                    }`}
                  />
                </div>
                <div className="text-2xl font-semibold text-[#13334F]">{m.value}</div>
                <div className="text-sm text-[#607583]">{m.label}</div>
              </div>
            );
          })}
        </div>

        <section className="rounded-xl border border-[#DDE7E8] bg-white">
          <div className="border-b border-[#DDE7E8] px-5 py-3">
            <h2 className="text-lg font-semibold text-[#13334F]">Flagged Workers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
                <tr>
                  <th className="p-3 font-semibold text-[#13334F]">Name</th>
                  <th className="p-3 font-semibold text-[#13334F]">Role</th>
                  <th className="p-3 font-semibold text-[#13334F]">Issue</th>
                  <th className="p-3 font-semibold text-[#13334F]">Severity</th>
                  <th className="p-3 font-semibold text-[#13334F]">Last activity</th>
                  <th className="p-3 font-semibold text-[#13334F]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flaggedWorkers.map(row => (
                  <tr key={row.id} className="border-b border-[#DDE7E8]">
                    <td className="p-3 font-medium text-[#10283D]">{row.name}</td>
                    <td className="p-3 text-[#607583]">{row.role}</td>
                    <td className="max-w-xs p-3 text-[#10283D]">{row.issue}</td>
                    <td className="p-3">
                      <Sev level={row.severity} />
                    </td>
                    <td className="p-3 text-[#607583]">{row.lastActivity}</td>
                    <td className="p-3">
                      <RowActions label={row.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-[#DDE7E8] bg-white">
          <div className="border-b border-[#DDE7E8] px-5 py-3">
            <h2 className="text-lg font-semibold text-[#13334F]">Flagged Providers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
                <tr>
                  <th className="p-3 font-semibold text-[#13334F]">Name</th>
                  <th className="p-3 font-semibold text-[#13334F]">Type</th>
                  <th className="p-3 font-semibold text-[#13334F]">Issue</th>
                  <th className="p-3 font-semibold text-[#13334F]">Severity</th>
                  <th className="p-3 font-semibold text-[#13334F]">Last activity</th>
                  <th className="p-3 font-semibold text-[#13334F]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flaggedProviders.map(row => (
                  <tr key={row.id} className="border-b border-[#DDE7E8]">
                    <td className="p-3 font-medium text-[#10283D]">{row.name}</td>
                    <td className="p-3 text-[#607583]">{row.type}</td>
                    <td className="max-w-xs p-3 text-[#10283D]">{row.issue}</td>
                    <td className="p-3">
                      <Sev level={row.severity} />
                    </td>
                    <td className="p-3 text-[#607583]">{row.lastActivity}</td>
                    <td className="p-3">
                      <RowActions label={row.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-[#DDE7E8] bg-white">
          <div className="border-b border-[#DDE7E8] px-5 py-3">
            <h2 className="text-lg font-semibold text-[#13334F]">Risk Signals</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
                <tr>
                  <th className="p-3 font-semibold text-[#13334F]">Name</th>
                  <th className="p-3 font-semibold text-[#13334F]">Type</th>
                  <th className="p-3 font-semibold text-[#13334F]">Issue</th>
                  <th className="p-3 font-semibold text-[#13334F]">Severity</th>
                  <th className="p-3 font-semibold text-[#13334F]">Last activity</th>
                  <th className="p-3 font-semibold text-[#13334F]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {riskSignals.map(row => (
                  <tr key={row.id} className="border-b border-[#DDE7E8]">
                    <td className="p-3 font-medium text-[#10283D]">{row.name}</td>
                    <td className="p-3 text-[#607583]">{row.type}</td>
                    <td className="max-w-xs p-3 text-[#10283D]">{row.issue}</td>
                    <td className="p-3">
                      <Sev level={row.severity} />
                    </td>
                    <td className="p-3 text-[#607583]">{row.lastActivity}</td>
                    <td className="p-3">
                      <RowActions label={row.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
