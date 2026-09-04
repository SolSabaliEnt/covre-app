import type { ApiResult } from '../api/types';
import { getSupabaseClient } from '../lib/supabaseClient';
import type { WorkerActionResult } from '../services/types';

type WorkerProfileRow = { id: string };
type ReturnPreferenceRow = {
  worker_id: string;
  site_id: string;
  willing_to_return: boolean;
  updated_at: string;
};

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } };
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function friendlyDbMessage(err: { message?: string; code?: string }, fallback: string): string {
  const raw = err.message ?? fallback;
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return 'Return preferences are blocked by database permissions (RLS). Apply the worker_site_return_preferences migration on the Covre Supabase project.';
  }
  if (/relation .*worker_site_return_preferences.* does not exist|42P01/i.test(raw)) {
    return 'Return preferences are not deployed in Supabase yet. Apply the worker_site_return_preferences migration on the Covre project.';
  }
  return raw;
}

async function requireWorkerProfileId(): Promise<
  ApiResult<{ supabase: ReturnType<typeof getSupabaseClient>; workerId: string }>
> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return fail('not_authenticated', 'Sign in with Supabase before saving return preferences.');
  }

  const { data, error } = await supabase
    .from('worker_profiles')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) {
    return fail('worker_profile_load', friendlyDbMessage(error, 'Unable to load worker profile.'));
  }

  const workerId = (data as WorkerProfileRow | null)?.id;
  if (!workerId) {
    return fail('worker_profile_required', 'Complete your worker profile before saving return preferences.');
  }

  return ok({ supabase, workerId });
}

export async function listWorkerSiteReturnPreferencesFromSupabase(): Promise<ApiResult<string[]>> {
  try {
    const profile = await requireWorkerProfileId();
    if (!profile.ok) {
      if (profile.error.code === 'worker_profile_required') return ok([]);
      return profile;
    }

    const { supabase, workerId } = profile.data;
    const { data, error } = await supabase
      .from('worker_site_return_preferences')
      .select('site_id, willing_to_return')
      .eq('worker_id', workerId)
      .eq('willing_to_return', true);

    if (error) {
      return fail('return_preferences_load', friendlyDbMessage(error, 'Unable to load return preferences.'));
    }

    return ok(
      ((data ?? []) as Pick<ReturnPreferenceRow, 'site_id' | 'willing_to_return'>[])
        .filter(row => row.willing_to_return)
        .map(row => row.site_id),
    );
  } catch (error) {
    return fail('unexpected', error instanceof Error ? error.message : 'Request failed.');
  }
}

export async function saveWorkerSiteReturnPreferenceToSupabase(
  siteId: string,
): Promise<ApiResult<WorkerActionResult>> {
  const trimmed = siteId.trim();
  if (!trimmed) return fail('validation', 'A care site is required.');

  try {
    const profile = await requireWorkerProfileId();
    if (!profile.ok) return profile;
    const { supabase, workerId } = profile.data;

    const { data, error } = await supabase
      .from('worker_site_return_preferences')
      .upsert(
        {
          worker_id: workerId,
          site_id: trimmed,
          willing_to_return: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'worker_id,site_id' },
      )
      .select('worker_id, site_id, willing_to_return, updated_at')
      .single();

    if (error || !data) {
      return fail(
        'return_preference_save',
        friendlyDbMessage(error ?? { message: 'Unable to save return preference.' }, 'Unable to save return preference.'),
      );
    }

    const row = data as ReturnPreferenceRow;
    return ok({
      id: row.site_id,
      status: 'site_return_preference_saved',
      message: 'Saved privately. Covre can use this to remember places you would return to.',
      updatedAt: row.updated_at,
    });
  } catch (error) {
    return fail('unexpected', error instanceof Error ? error.message : 'Request failed.');
  }
}
