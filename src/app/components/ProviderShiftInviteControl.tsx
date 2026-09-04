import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  inviteWorkerToOpenShift,
  listProviderInvitableShifts,
  trackContinuityEvent,
} from '../services';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { useProviderAction } from '../hooks/useProviderAction';

function formatShiftOption(startsAt: string, title: string, siteName: string): string {
  const date = new Date(startsAt);
  const when = Number.isNaN(date.getTime())
    ? startsAt
    : date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
  return `${title} · ${siteName} · ${when}`;
}

export function ProviderShiftInviteControl({
  workerId,
  hasPriorHistory,
}: {
  workerId: string;
  hasPriorHistory: boolean;
}) {
  const { data: shifts, error, loading } = useAsyncResource(() => listProviderInvitableShifts(), []);
  const { run, isPending } = useProviderAction();
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [invitedShiftId, setInvitedShiftId] = useState('');

  const availableShifts = shifts ?? [];
  const selectedShift = useMemo(
    () => availableShifts.find(shift => shift.id === selectedShiftId),
    [availableShifts, selectedShiftId],
  );

  useEffect(() => {
    setSelectedShiftId(current => {
      if (current && availableShifts.some(shift => shift.id === current)) return current;
      return availableShifts[0]?.id ?? '';
    });
  }, [availableShifts]);

  useEffect(() => {
    setInvitedShiftId('');
  }, [workerId]);

  if (loading) {
    return <p className="text-xs text-[#607583]">Loading open shifts…</p>;
  }

  if (error) {
    return <p className="text-xs text-[#A93636]">{error.message}</p>;
  }

  if (availableShifts.length === 0) {
    return (
      <div className="rounded-xl border border-[#DDE7E8] bg-[#F7FAFA] p-4">
        <p className="text-sm font-semibold text-[#13334F]">No future open shifts to invite to.</p>
        <p className="mt-1 text-xs text-[#607583]">Post an open shift first, then invite this worker to review it.</p>
      </div>
    );
  }

  const pendingKey = `provider-shift-invite-${workerId}-${selectedShiftId}`;
  const alreadyInvited = Boolean(invitedShiftId && invitedShiftId === selectedShiftId);

  return (
    <div className="rounded-xl border border-[#DDE7E8] bg-white p-4">
      <div className="flex items-start gap-3">
        <CalendarPlus className="mt-0.5 h-5 w-5 shrink-0 text-[#53B59F]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#13334F]">
            {hasPriorHistory ? 'Invite back to an open shift' : 'Invite to an open shift'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#607583]">
            The worker receives an invitation to review this specific shift. This does not book them or imply acceptance.
          </p>
        </div>
      </div>

      <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#607583]" htmlFor={`invite-shift-${workerId}`}>
        Open shift
      </label>
      <select
        id={`invite-shift-${workerId}`}
        value={selectedShiftId}
        onChange={event => {
          setSelectedShiftId(event.target.value);
          setInvitedShiftId('');
        }}
        className="mt-2 min-h-11 w-full rounded-xl border border-[#DDE7E8] bg-white px-3 py-2 text-sm text-[#13334F] outline-none focus:border-[#53B59F]"
      >
        {availableShifts.map(shift => (
          <option key={shift.id} value={shift.id}>
            {formatShiftOption(shift.startsAt, shift.title, shift.siteName)}
          </option>
        ))}
      </select>

      {selectedShift ? (
        <p className="mt-2 text-xs text-[#607583]">{selectedShift.role} · {selectedShift.siteName}</p>
      ) : null}

      <button
        type="button"
        disabled={!selectedShiftId || alreadyInvited || isPending(pendingKey)}
        onClick={async () => {
          if (!selectedShiftId) return;
          const result = await run(pendingKey, () => inviteWorkerToOpenShift(workerId, selectedShiftId));
          if (!result.ok) {
            toast.error(result.error.message);
            return;
          }

          setInvitedShiftId(selectedShiftId);
          toast.success('Shift invitation sent');
          trackContinuityEvent('provider_return_intent', {
            actor: 'provider',
            workerId,
            shiftId: selectedShiftId,
            source: hasPriorHistory ? 'worker_profile_invite_back' : 'worker_profile_invite',
          });
        }}
        className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B243A] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {alreadyInvited ? 'Invitation sent' : hasPriorHistory ? 'Invite back' : 'Send invitation'}
      </button>
    </div>
  );
}
