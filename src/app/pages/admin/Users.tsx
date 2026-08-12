import { useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { toast } from 'sonner';
import { listUsersAndProviders } from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';

type Tab = 'workers' | 'providers' | 'admins';

type UserRow = {
  id: string;
  name: string;
  accountType: string;
  status: 'active' | 'suspended' | 'review';
  role: string;
  location: string;
  lastActive: string;
};

function AccStatus({ s }: { s: 'active' | 'suspended' | 'review' }) {
  if (s === 'active') {
    return <StatusBadge variant="covered">Active</StatusBadge>;
  }
  if (s === 'review') {
    return <StatusBadge variant="pending">Review</StatusBadge>;
  }
  return <StatusBadge variant="missing">Suspended</StatusBadge>;
}

function UserTable({ rows }: { rows: UserRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead className="border-b border-[#DDE7E8] bg-[#F7FAFA]">
          <tr>
            <th className="p-3 font-semibold text-[#13334F]">Name</th>
            <th className="p-3 font-semibold text-[#13334F]">Account type</th>
            <th className="p-3 font-semibold text-[#13334F]">Status</th>
            <th className="p-3 font-semibold text-[#13334F]">Role</th>
            <th className="p-3 font-semibold text-[#13334F]">Location / site</th>
            <th className="p-3 font-semibold text-[#13334F]">Last active</th>
            <th className="p-3 font-semibold text-[#13334F]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-[#DDE7E8]">
              <td className="p-3 font-medium text-[#10283D]">{row.name}</td>
              <td className="p-3 text-[#607583]">{row.accountType}</td>
              <td className="p-3">
                <AccStatus s={row.status} />
              </td>
              <td className="p-3 text-[#607583]">{row.role}</td>
              <td className="p-3 text-[#607583]">{row.location}</td>
              <td className="p-3 text-[#607583]">{row.lastActive}</td>
              <td className="p-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => toast(`Profile: ${row.name}`)}
                    className="rounded-lg bg-[#13334F] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#0B243A]"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => toast(`Deactivate flow: ${row.name}`)}
                    className="rounded-lg border border-[#D94A4A] bg-white px-2.5 py-1 text-xs font-medium text-[#A93636] hover:bg-[#FDEAEA]"
                  >
                    Deactivate
                  </button>
                  <button
                    type="button"
                    onClick={() => toast.success(`Invite sent (mock): ${row.name}`)}
                    className="rounded-lg border border-[#53B59F] bg-[#E6F6F2] px-2.5 py-1 text-xs font-medium text-[#257665] hover:bg-[#D4EFE8]"
                  >
                    Send Invite
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'workers', label: 'Workers' },
  { id: 'providers', label: 'Providers' },
  { id: 'admins', label: 'Admins' },
];

export default function Users() {
  const [tab, setTab] = useState<Tab>('workers');
  const { data, error, loading, reload } = useAsyncResource(() => listUsersAndProviders(), []);

  if (loading) {
    return (
      <>
        <div className="border-b border-[#DDE7E8] bg-white p-6">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-3xl font-semibold text-[#13334F]">Users &amp; Providers</h1>
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
            <h1 className="text-3xl font-semibold text-[#13334F]">Users &amp; Providers</h1>
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

  const { workers, providers, admins } = data;
  const rows = tab === 'workers' ? workers : tab === 'providers' ? providers : admins;

  return (
    <>
      <div className="border-b border-[#DDE7E8] bg-white p-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-semibold text-[#13334F]">Users &amp; Providers</h1>
          <p className="mt-1 text-[#607583]">
            Manage workers, provider organizations, facility admins, and account status.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex flex-wrap gap-2 border-b border-[#DDE7E8] pb-4">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] ${
                tab === t.id
                  ? 'bg-[#13334F] text-white'
                  : 'bg-white text-[#607583] ring-1 ring-[#DDE7E8] hover:bg-[#F7FAFA]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <section className="rounded-xl border border-[#DDE7E8] bg-white p-0">
          <UserTable rows={rows} />
        </section>
      </div>
    </>
  );
}
