import type { ApiResult } from '../api/types';
import { getSupabaseClient } from '../lib/supabaseClient';

export type ProviderShiftInvitationStatus =
  | 'pending'
  | 'viewed'
  | 'accepted'
  | 'declined'
  | 'withdrawn';

export type ProviderShiftInvitation = {
  id: string;
  providerId: string;
  shiftId: string;
  workerId: string;
  status: ProviderShiftInvitationStatus;
  createdAt: string;
};

export type WorkerShiftInvitation = ProviderShiftInvitation & {
  shiftTitle: string;
  role: string;
  siteName: string;
  startsAt: string;
  endsAt: string;
};

export type WorkerShiftInvitationDecision = 'accepted' | 'declined';

export type WorkerShiftInvitationResponse = {
  invitationId: string;
  shiftId: string;
  workerId: string;
  status: WorkerShiftInvitationDecision;
  requestId?: string;
  bookingReady: boolean;
};

export type ProviderInvitableShift = {
  id: string;
  title: string;
  role: string;
  siteName: string;
  startsAt: string;
  endsAt: string;
};

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } };
}

function friendlyDbMessage(err: { message?: string; code?: string }, fallback: string): string {
  const raw = err.message ?? fallback;
  const token = raw.trim().toLowerCase();

  if (/provider_shift_invitations|relation .* does not exist/i.test(raw)) {
    return 'Shift invitations require the Covre provider shift invitation migration.';
  }
  if (/respond_to_provider_shift_invitation|function .* does not exist/i.test(raw)) {
    return 'Worker invitation responses require the Covre invitation-response migration.';
  }
  if (err.code === '23505' || /duplicate key|unique constraint/i.test(raw)) {
    return 'This worker has already been invited to that shift.';
  }
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return 'This shift invitation is blocked by database permissions (RLS).';
  }

  const responseMessages: Record<string, string> = {
    not_authenticated: 'Sign in before responding to a shift invitation.',
    invalid_decision: 'Choose Accept or Decline.',
    worker_profile_required: 'Complete your worker profile before responding to invitations.',
    invitation_not_found: 'This invitation is no longer available.',
    invitation_already_resolved: 'This invitation has already been resolved.',
    shift_not_found: 'The invited shift is no longer available.',
    shift_not_available: 'This shift is no longer open.',
    bill_rate_required: 'This shift is not ready for booking yet.',
    worker_rate_required: 'Worker pay must be set before this invitation can be accepted.',
    booking_conflict: 'This shift has already been covered.',
    request_not_eligible: 'This invitation cannot be moved into the booking workflow.',
  };
  if (responseMessages[token]) return responseMessages[token];

  return raw;
}

async function currentProviderId(): Promise<ApiResult<string>> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return fail('not_authenticated', 'Sign in before inviting a worker.');

  const { data, error } = await supabase
    .from('provider_members')
    .select('provider_id')
    .eq('user_id', session.user.id)
    .limit(1)
    .maybeSingle();

  if (error) return fail('provider_membership_load', friendlyDbMessage(error, 'Unable to load provider membership.'));
  if (!data?.provider_id) return fail('provider_required', 'Join or create a provider organization first.');
  return ok(data.provider_id as string);
}

export async function listProviderInvitableShiftsFromSupabase(): Promise<
  ApiResult<ProviderInvitableShift[]>
> {
  const provider = await currentProviderId();
  if (!provider.ok) return provider;

  const { data, error } = await getSupabaseClient()
    .from('shifts')
    .select('id, title, role, starts_at, ends_at, care_sites(name)')
    .eq('provider_id', provider.data)
    .eq('status', 'open')
    .gt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true });

  if (error) return fail('invitable_shifts_load', friendlyDbMessage(error, 'Unable to load open shifts.'));

  return ok(
    (data ?? []).map(row => {
      const site = Array.isArray(row.care_sites) ? row.care_sites[0] : row.care_sites;
      return {
        id: row.id as string,
        title: ((row.title as string | null) ?? (row.role as string | null) ?? 'Open shift').trim(),
        role: ((row.role as string | null) ?? 'Care worker').trim(),
        siteName: ((site as { name?: string } | null)?.name ?? 'Care site').trim(),
        startsAt: row.starts_at as string,
        endsAt: row.ends_at as string,
      };
    }),
  );
}

export async function createProviderShiftInvitationInSupabase(
  workerId: string,
  shiftId: string,
): Promise<ApiResult<ProviderShiftInvitation>> {
  const provider = await currentProviderId();
  if (!provider.ok) return provider;

  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data: shift, error: shiftError } = await supabase
    .from('shifts')
    .select('id, provider_id, status, starts_at')
    .eq('id', shiftId)
    .eq('provider_id', provider.data)
    .eq('status', 'open')
    .maybeSingle();

  if (shiftError) return fail('shift_load', friendlyDbMessage(shiftError, 'Unable to verify shift.'));
  if (!shift) return fail('shift_not_open', 'Choose an open shift from your organization.');
  if (Date.parse(shift.starts_at as string) <= Date.now()) {
    return fail('shift_started', 'Choose a future open shift.');
  }

  const { data: relationship, error: relationshipError } = await supabase
    .from('provider_worker_relationships')
    .select('state')
    .eq('provider_id', provider.data)
    .eq('worker_id', workerId)
    .maybeSingle();

  if (relationshipError) {
    return fail('relationship_load', friendlyDbMessage(relationshipError, 'Unable to verify provider relationship state.'));
  }
  if (relationship?.state === 'do_not_send') {
    return fail('do_not_send', 'Remove do-not-send before inviting this worker.');
  }

  const { data, error } = await supabase
    .from('provider_shift_invitations')
    .insert({
      provider_id: provider.data,
      shift_id: shiftId,
      worker_id: workerId,
      status: 'pending',
      created_by: session?.user.id ?? null,
    })
    .select('id, provider_id, shift_id, worker_id, status, created_at')
    .single();

  if (error) return fail('shift_invitation_create', friendlyDbMessage(error, 'Unable to invite worker.'));

  return ok({
    id: data.id as string,
    providerId: data.provider_id as string,
    shiftId: data.shift_id as string,
    workerId: data.worker_id as string,
    status: data.status as ProviderShiftInvitationStatus,
    createdAt: data.created_at as string,
  });
}

export async function listCurrentWorkerShiftInvitationsFromSupabase(): Promise<
  ApiResult<WorkerShiftInvitation[]>
> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return fail('not_authenticated', 'Sign in before loading shift invitations.');

  const { data: worker, error: workerError } = await supabase
    .from('worker_profiles')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (workerError) return fail('worker_profile_load', friendlyDbMessage(workerError, 'Unable to load worker profile.'));
  if (!worker?.id) return ok([]);

  const { data, error } = await supabase
    .from('provider_shift_invitations')
    .select(
      `
      id,
      provider_id,
      shift_id,
      worker_id,
      status,
      created_at,
      shifts!inner (
        id,
        title,
        role,
        starts_at,
        ends_at,
        care_sites ( name )
      )
    `,
    )
    .eq('worker_id', worker.id)
    .in('status', ['pending', 'viewed'])
    .gt('shifts.starts_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) return fail('shift_invitations_load', friendlyDbMessage(error, 'Unable to load shift invitations.'));

  return ok(
    (data ?? []).map(row => {
      const shift = Array.isArray(row.shifts) ? row.shifts[0] : row.shifts;
      const siteRaw = (shift as { care_sites?: unknown } | null)?.care_sites;
      const site = Array.isArray(siteRaw) ? siteRaw[0] : siteRaw;
      return {
        id: row.id as string,
        providerId: row.provider_id as string,
        shiftId: row.shift_id as string,
        workerId: row.worker_id as string,
        status: row.status as ProviderShiftInvitationStatus,
        createdAt: row.created_at as string,
        shiftTitle: (((shift as { title?: string | null } | null)?.title ?? (shift as { role?: string | null } | null)?.role) ?? 'Open shift').trim(),
        role: ((shift as { role?: string | null } | null)?.role ?? 'Care worker').trim(),
        siteName: ((site as { name?: string } | null)?.name ?? 'Care site').trim(),
        startsAt: (shift as { starts_at?: string } | null)?.starts_at ?? '',
        endsAt: (shift as { ends_at?: string } | null)?.ends_at ?? '',
      };
    }),
  );
}

export async function respondToWorkerShiftInvitationInSupabase(
  invitationId: string,
  decision: WorkerShiftInvitationDecision,
): Promise<ApiResult<WorkerShiftInvitationResponse>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('respond_to_provider_shift_invitation', {
    target_invitation_id: invitationId,
    target_decision: decision,
  });

  if (error) {
    return fail('shift_invitation_response', friendlyDbMessage(error, 'Unable to respond to this invitation.'));
  }

  const raw = Array.isArray(data) ? data[0] : data;
  if (!raw) return fail('shift_invitation_response', 'Unable to respond to this invitation.');

  return ok({
    invitationId: raw.invitation_id as string,
    shiftId: raw.shift_id as string,
    workerId: raw.worker_id as string,
    status: raw.invitation_status as WorkerShiftInvitationDecision,
    requestId: (raw.request_id as string | null) ?? undefined,
    bookingReady: raw.booking_ready === true,
  });
}
