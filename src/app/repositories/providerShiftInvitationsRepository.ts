import type { ApiResult } from '../api/types';
import { getSupabaseClient } from '../lib/supabaseClient';

export type ProviderShiftInvitation = {
  id: string;
  providerId: string;
  shiftId: string;
  workerId: string;
  status: 'pending' | 'viewed' | 'accepted' | 'declined' | 'withdrawn';
  createdAt: string;
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
  if (/provider_shift_invitations|relation .* does not exist/i.test(raw)) {
    return 'Shift invitations require the Covre provider shift invitation migration.';
  }
  if (err.code === '23505' || /duplicate key|unique constraint/i.test(raw)) {
    return 'This worker has already been invited to that shift.';
  }
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return 'This shift invitation is blocked by database permissions (RLS).';
  }
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
    status: data.status as ProviderShiftInvitation['status'],
    createdAt: data.created_at as string,
  });
}

export async function listCurrentWorkerShiftInvitationsFromSupabase(): Promise<
  ApiResult<ProviderShiftInvitation[]>
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
    .select('id, provider_id, shift_id, worker_id, status, created_at')
    .eq('worker_id', worker.id)
    .in('status', ['pending', 'viewed'])
    .order('created_at', { ascending: false });

  if (error) return fail('shift_invitations_load', friendlyDbMessage(error, 'Unable to load shift invitations.'));

  return ok(
    (data ?? []).map(row => ({
      id: row.id as string,
      providerId: row.provider_id as string,
      shiftId: row.shift_id as string,
      workerId: row.worker_id as string,
      status: row.status as ProviderShiftInvitation['status'],
      createdAt: row.created_at as string,
    })),
  );
}
