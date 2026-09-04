import { CalendarCheck, Mail } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  listWorkerShiftInvitations,
  respondToWorkerShiftInvitation,
} from '../services';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { useWorkerAction } from '../hooks/useWorkerAction';

function formatWhen(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [startsAt, endsAt].filter(Boolean).join(' · ') || 'Shift time on invitation';
  }
  const date = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${date} · ${start.toLocaleTimeString(undefined, timeOptions)} – ${end.toLocaleTimeString(undefined, timeOptions)}`;
}

export function WorkerShiftInvitations() {
  const { data: invitations, error, loading, reload } = useAsyncResource(
    () => listWorkerShiftInvitations(),
    [],
  );
  const { run, isPending } = useWorkerAction();

  if (loading) {
    return (
      <section className="rounded-2xl border border-[#DDE7E8] bg-white p-5 shadow-sm">
        <p className="text-sm text-[#607583]">Checking shift invitations…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-[#DDE7E8] bg-white p-5 shadow-sm">
        <p className="text-sm text-[#A93636]">{error.message}</p>
        <button type="button" onClick={reload} className="mt-3 text-sm font-semibold text-[#53B59F] hover:underline">
          Retry
        </button>
      </section>
    );
  }

  if (!invitations?.length) return null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#257665]">Invited back</p>
          <h2 className="mt-1 text-lg font-semibold text-[#13334F]">Shifts waiting on you</h2>
        </div>
        <span className="rounded-full bg-[#E6F6F2] px-2.5 py-1 text-xs font-semibold text-[#257665]">
          {invitations.length}
        </span>
      </div>

      <div className="space-y-3">
        {invitations.map(invitation => {
          const acceptKey = `invite-accept-${invitation.id}`;
          const declineKey = `invite-decline-${invitation.id}`;
          const pending = isPending(acceptKey) || isPending(declineKey);

          return (
            <article key={invitation.id} className="rounded-2xl border border-[#BFDCD5] bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E6F6F2] text-[#257665]">
                  <Mail className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#257665]">Provider invitation</p>
                  <h3 className="mt-1 break-words text-base font-semibold text-[#13334F]">{invitation.shiftTitle}</h3>
                  <p className="mt-1 text-sm text-[#607583]">{invitation.siteName} · {invitation.role}</p>
                  <p className="mt-2 text-xs text-[#607583]">{formatWhen(invitation.startsAt, invitation.endsAt)}</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-[#F7FAFA] p-3 text-xs leading-5 text-[#607583]">
                Accepting tells the provider you want this shift and moves your response into Covre&apos;s normal booking workflow. You are not booked until the booking is confirmed.
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Link
                  to={`/worker/shift/${invitation.shiftId}`}
                  className="flex min-h-11 items-center justify-center rounded-xl border border-[#DDE7E8] bg-white px-3 py-2 text-sm font-semibold text-[#13334F] no-underline hover:bg-[#F7FAFA]"
                >
                  Review shift
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  onClick={async () => {
                    const result = await run(acceptKey, () =>
                      respondToWorkerShiftInvitation(invitation.id, 'accepted'),
                    );
                    if (!result.ok) {
                      toast.error(result.error.message);
                      return;
                    }
                    toast.success('Accepted. Your response is with the provider for booking confirmation.');
                    reload();
                  }}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#53B59F] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2F8E7A] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CalendarCheck className="h-4 w-4" aria-hidden />
                  Accept
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={async () => {
                    const result = await run(declineKey, () =>
                      respondToWorkerShiftInvitation(invitation.id, 'declined'),
                    );
                    if (!result.ok) {
                      toast.error(result.error.message);
                      return;
                    }
                    toast.success('Invitation declined');
                    reload();
                  }}
                  className="min-h-11 rounded-xl border border-[#DDE7E8] bg-white px-3 py-2 text-sm font-semibold text-[#607583] hover:bg-[#F7FAFA] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Decline
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
