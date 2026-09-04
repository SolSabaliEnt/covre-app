import type { ApiResult } from '../api/types';
import { getSupabaseClient } from '../lib/supabaseClient';
import type { ProviderActionResult } from '../services/types';

export type ProviderWorkerRelationshipState = 'bench' | 'do_not_send';

export type ProviderWorkerRelationship = {
  providerId: string;
  workerId: string;
  state: ProviderWorkerRelationshipState;
  updatedAt: string;
};

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } };
}

function friendlyDbMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback;
  if (/provider_worker_relationships|relation .* does not exist/i.test(raw)) {
    return 'Provider relationship actions require the Covre provider-worker relationship migration.';
  }
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return 'This provider relationship action is blocked by database permissions (RLS).';
  }
  return raw;
}

async function currentProviderId(): Promise<ApiResult<string>> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return fail('not_authenticated', 'Sign in before changing provider relationships.');

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

function mapRelationship(data: {
  provider_id: unknown;
  worker_id: unknown;
  state: unknown;
  updated_at: unknown;
}): ProviderWorkerRelationship {
  return {
    providerId: data.provider_id as string,
    workerId: data.worker_id as string,
    state: data.state as ProviderWorkerRelationshipState,
    updatedAt: data.updated_at as string,
  };
}

export async function listProviderWorkerRelationshipsFromSupabase(): Promise<
  ApiResult<ProviderWorkerRelationship[]>
> {
  const provider = await currentProviderId();
  if (!provider.ok) return provider;

  const { data, error } = await getSupabaseClient()
    .from('provider_worker_relationships')
    .select('provider_id, worker_id, state, updated_at')
    .eq('provider_id', provider.data)
    .order('updated_at', { ascending: false });

  if (error) {
    return fail(
      'provider_worker_relationships_load',
      friendlyDbMessage(error, 'Unable to load provider relationship states.'),
    );
  }

  return ok((data ?? []).map(row => mapRelationship(row)));
}

export async function getProviderWorkerRelationshipFromSupabase(
  workerId: string,
): Promise<ApiResult<ProviderWorkerRelationship | null>> {
  const provider = await currentProviderId();
  if (!provider.ok) return provider;

  const { data, error } = await getSupabaseClient()
    .from('provider_worker_relationships')
    .select('provider_id, worker_id, state, updated_at')
    .eq('provider_id', provider.data)
    .eq('worker_id', workerId)
    .maybeSingle();

  if (error) return fail('provider_worker_relationship_load', friendlyDbMessage(error, 'Unable to load provider relationship state.'));
  if (!data) return ok(null);

  return ok(mapRelationship(data));
}

async function setRelationship(
  workerId: string,
  state: ProviderWorkerRelationshipState,
): Promise<ApiResult<ProviderActionResult>> {
  const provider = await currentProviderId();
  if (!provider.ok) return provider;

  const now = new Date().toISOString();
  const session = (await getSupabaseClient().auth.getSession()).data.session;
  const { error } = await getSupabaseClient()
    .from('provider_worker_relationships')
    .upsert(
      {
        provider_id: provider.data,
        worker_id: workerId,
        state,
        updated_by: session?.user.id ?? null,
        updated_at: now,
      },
      { onConflict: 'provider_id,worker_id' },
    );

  if (error) return fail('provider_worker_relationship_save', friendlyDbMessage(error, 'Unable to save provider relationship state.'));

  return ok({
    id: workerId,
    status: state === 'bench' ? 'added_to_bench' : 'do_not_send',
    message: state === 'bench' ? 'Worker saved to your Covre Bench.' : 'Worker marked do not send for your organization.',
    updatedAt: now,
  });
}

export function addWorkerToProviderBenchInSupabase(workerId: string) {
  return setRelationship(workerId, 'bench');
}

export function markWorkerDoNotSendInSupabase(workerId: string) {
  return setRelationship(workerId, 'do_not_send');
}
