import { useCallback, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { StatusBadge } from '../../components/StatusBadge';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import {
  disableProviderMember,
  inviteProviderMember,
  listProviderTeamMembers,
  resendProviderInvite,
  updateProviderMemberRole,
} from '../../services';
import type { ProviderMemberRole, ProviderTeamMember } from '../../services';

const INVITE_ROLES: { value: ProviderMemberRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'scheduler', label: 'Scheduler' },
  { value: 'billing', label: 'Billing' },
  { value: 'viewer', label: 'Viewer' },
];

const ALL_ROLES: ProviderMemberRole[] = ['owner', 'admin', 'scheduler', 'billing', 'viewer'];

function roleLabel(role: ProviderMemberRole): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'scheduler':
      return 'Scheduler';
    case 'billing':
      return 'Billing';
    case 'viewer':
      return 'Viewer';
    default:
      return role;
  }
}

function statusBadge(member: ProviderTeamMember) {
  if (member.status === 'active') {
    return <StatusBadge variant="covered">Active</StatusBadge>;
  }
  if (member.status === 'invited') {
    return <StatusBadge variant="pending">Invited</StatusBadge>;
  }
  return <StatusBadge variant="missing">Disabled</StatusBadge>;
}

function formatWhen(iso?: string) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const ROLE_GUIDE: { role: string; text: string }[] = [
  { role: 'Owner', text: 'Full access to organization, billing, team, and sites.' },
  { role: 'Admin', text: 'Manage sites, shifts, team, and most settings.' },
  { role: 'Scheduler', text: 'Post and manage shifts and worker coverage.' },
  { role: 'Billing', text: 'Billing, invoices, and timesheet approvals.' },
  { role: 'Viewer', text: 'Read-only access to dashboards and reports.' },
];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function ProviderTeam() {
  const supabaseMode = isSupabaseBackendEnabled();
  const { data: members, loading, error, reload } = useAsyncResource(() => listProviderTeamMembers(), []);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ProviderMemberRole>('scheduler');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(inviteEmail)) {
      toast.error('Enter a valid email address.');
      return;
    }
    setInviteBusy(true);
    const res = await inviteProviderMember({
      email: inviteEmail.trim(),
      role: inviteRole,
      message: inviteMessage.trim() || undefined,
    });
    setInviteBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(res.data.message);
    setInviteEmail('');
    setInviteMessage('');
    setInviteRole('scheduler');
    reload();
  };

  const onRoleChange = useCallback(
    async (memberId: string, role: ProviderMemberRole) => {
      const res = await updateProviderMemberRole(memberId, role);
      if (!res.ok) {
        toast.error(res.error.message);
        reload();
        return;
      }
      toast.success(res.data.message);
      reload();
    },
    [reload],
  );

  const onDisable = async (memberId: string) => {
    const res = await disableProviderMember(memberId);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(res.data.message);
    reload();
  };

  const onResend = async (memberId: string) => {
    const res = await resendProviderInvite(memberId);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(res.data.message);
    reload();
  };

  return (
    <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 pb-40 pt-6">
      <div className="mx-auto w-full min-w-0 max-w-lg space-y-8">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-[#13334F]">Team</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#607583]">
            Invite staff and manage workspace access for your facility workspace.
          </p>
          {supabaseMode && (
            <p className="mt-3 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm leading-relaxed text-[#607583]">
              Team members are loaded from your facility workspace. Email invitations are
              simulated until invite delivery is connected.
            </p>
          )}
        </div>

        <section className="rounded-2xl border border-[#DDE7E8] bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-[#13334F]">Invite staff</h2>
          <p className="mt-1 text-xs text-[#607583]">
            {supabaseMode
              ? 'Invites are queued only — no email is sent yet.'
              : 'Demo only — no email is sent.'}
          </p>
          <form onSubmit={e => void handleInvite(e)} className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Email</span>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
                placeholder="name@organization.com"
                autoComplete="email"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Role</span>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as ProviderMemberRole)}
                className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
              >
                {INVITE_ROLES.map(r => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Message (optional)</span>
              <textarea
                rows={3}
                value={inviteMessage}
                onChange={e => setInviteMessage(e.target.value)}
                className="w-full min-w-0 resize-none rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
                placeholder="Add context for your teammate…"
              />
            </label>
            <button
              type="submit"
              disabled={inviteBusy}
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2F8E7A] disabled:opacity-60"
            >
              {inviteBusy ? 'Queuing…' : supabaseMode ? 'Queue invite' : 'Send Invite'}
            </button>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="px-1 text-sm font-semibold text-[#13334F]">Team members</h2>
          {loading && (
            <p className="rounded-2xl border border-[#DDE7E8] bg-white p-6 text-center text-sm text-[#607583]">
              Loading team…
            </p>
          )}
          {error && (
            <div className="rounded-2xl border border-[#DDE7E8] bg-white p-6 text-center shadow-sm">
              <p className="text-sm text-[#607583]">{error.message}</p>
              <button
                type="button"
                onClick={() => reload()}
                className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B243A]"
              >
                Retry
              </button>
            </div>
          )}
          {!loading && !error && members && members.length === 0 && (
            <p className="rounded-2xl border border-[#DDE7E8] bg-white p-6 text-center text-sm text-[#607583]">
              No team members yet. Complete facility setup to add your owner membership.
            </p>
          )}
          {!loading && !error && members && members.length > 0 && (
            <ul className="space-y-3">
              {members.map(member => (
                <li
                  key={member.id}
                  className="overflow-hidden rounded-2xl border border-[#DDE7E8] bg-white p-4 shadow-sm"
                >
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[#13334F]">{member.name}</div>
                      <div className="mt-0.5 break-all text-sm text-[#607583]">{member.email}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {statusBadge(member)}
                        <span className="text-xs text-[#607583]">
                          {member.status === 'invited' && member.invitedAt
                            ? `Invited ${formatWhen(member.invitedAt)}`
                            : null}
                          {member.status === 'active' && member.lastActiveAt
                            ? `Last active ${formatWhen(member.lastActiveAt)}`
                            : null}
                          {member.status === 'disabled' ? 'Access removed' : null}
                        </span>
                      </div>
                    </div>
                    <div className="flex min-w-0 w-full flex-col gap-2 sm:w-auto sm:min-w-[10rem]">
                      <label className="block">
                        <span className="sr-only">Change role</span>
                        <select
                          value={member.role}
                          disabled={member.role === 'owner' || member.status === 'disabled'}
                          onChange={e =>
                            void onRoleChange(member.id, e.target.value as ProviderMemberRole)
                          }
                          className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-sm text-[#13334F] disabled:opacity-50"
                        >
                          {ALL_ROLES.map(r => (
                            <option key={r} value={r}>
                              {roleLabel(r)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {!supabaseMode && member.status === 'invited' ? (
                          <button
                            type="button"
                            onClick={() => void onResend(member.id)}
                            className="min-h-11 flex-1 rounded-lg border border-[#DDE7E8] bg-white px-3 py-2 text-sm font-medium text-[#13334F] transition-colors hover:bg-[#F7FAFA] sm:flex-none"
                          >
                            Resend invite
                          </button>
                        ) : null}
                        {member.role !== 'owner' && member.status !== 'disabled' ? (
                          <button
                            type="button"
                            onClick={() => void onDisable(member.id)}
                            className="min-h-11 flex-1 rounded-lg border border-[#FDEAEA] bg-[#FDEAEA]/40 px-3 py-2 text-sm font-medium text-[#A93636] transition-colors hover:bg-[#FDEAEA] sm:flex-none"
                          >
                            {supabaseMode ? 'Disable (coming soon)' : 'Disable access'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[#DDE7E8] bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-[#13334F]">Role guide</h2>
          <ul className="mt-3 space-y-3 text-sm text-[#607583]">
            {ROLE_GUIDE.map(row => (
              <li key={row.role}>
                <span className="font-semibold text-[#13334F]">{row.role}:</span> {row.text}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
