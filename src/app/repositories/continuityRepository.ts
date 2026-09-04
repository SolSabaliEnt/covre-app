import type { ApiResult } from '../api/types';
import { getSupabaseClient } from '../lib/supabaseClient';

export type WorkerSiteContinuityReadModel = {
  workerId: string;
  siteId: string;
  providerId: string;
  siteName: string;
  approvedShiftCount: number;
  firstWorkedAt: string;
  lastWorkedAt: string;
  isRepeat: boolean;
};

export type WorkerProviderContinuityReadModel = {
  workerId: string;
  providerId: string;
  providerName: string;
  approvedShiftCount: number;
  distinctSiteCount: number;
  firstWorkedAt: string;
  lastWorkedAt: string;
  isRepeat: boolean;
};

type SiteRow = {
  worker_id: string;
  site_id: string;
  provider_id: string;
  site_name: string;
  approved_shift_count: number;
  first_worked_at: string;
  last_worked_at: string;
  is_repeat: boolean;
};

type ProviderRow = {
  worker_id: string;
  provider_id: string;
  provider_name: string;
  approved_shift_count: number;
  distinct_site_count: number;
  first_worked_at: string;
  last_worked_at: string;
  is_repeat: boolean;
};

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } };
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function friendlyDbMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback;
  if (/worker_site_continuity_v1|worker_provider_continuity_v1|relation .* does not exist/i.test(raw)) {
    return 'Continuity read models are not deployed to this Supabase project yet.';
  }
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return 'Continuity history is blocked by database permissions (RLS). The canonical views preserve the permissions of approved work history.';
  }
  return raw;
}

async function requireSession() {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { supabase, session: null as const };
  return { supabase, session };
}

async function resolveCurrentWorkerId(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
): Promise<ApiResult<string | null>> {
  const { data, error } = await supabase
    .from('worker_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return fail('worker_profile_load', friendlyDbMessage(error, 'Unable to load worker profile.'));
  return ok((data as { id: string } | null)?.id ?? null);
}

export async function listCurrentWorkerSiteContinuityFromSupabase(): Promise<
  ApiResult<WorkerSiteContinuityReadModel[]>
> {
  try {
    const { supabase, session } = await requireSession();
    if (!session) return fail('not_authenticated', 'Sign in before loading your work history.');

    const workerRes = await resolveCurrentWorkerId(supabase, session.user.id);
    if (!workerRes.ok) return workerRes;
    if (!workerRes.data) return ok([]);

    const { data, error } = await supabase
      .from('worker_site_continuity_v1')
      .select(
        'worker_id, site_id, provider_id, site_name, approved_shift_count, first_worked_at, last_worked_at, is_repeat',
      )
      .eq('worker_id', workerRes.data)
      .order('approved_shift_count', { ascending: false })
      .order('last_worked_at', { ascending: false });

    if (error) return fail('site_continuity_load', friendlyDbMessage(error, 'Unable to load site history.'));

    return ok(
      ((data ?? []) as SiteRow[]).map(row => ({
        workerId: row.worker_id,
        siteId: row.site_id,
        providerId: row.provider_id,
        siteName: row.site_name,
        approvedShiftCount: row.approved_shift_count,
        firstWorkedAt: row.first_worked_at,
        lastWorkedAt: row.last_worked_at,
        isRepeat: row.is_repeat,
      })),
    );
  } catch (error) {
    return fail('unexpected', error instanceof Error ? error.message : 'Request failed.');
  }
}

export async function listCurrentWorkerProviderContinuityFromSupabase(): Promise<
  ApiResult<WorkerProviderContinuityReadModel[]>
> {
  try {
    const { supabase, session } = await requireSession();
    if (!session) return fail('not_authenticated', 'Sign in before loading your work history.');

    const workerRes = await resolveCurrentWorkerId(supabase, session.user.id);
    if (!workerRes.ok) return workerRes;
    if (!workerRes.data) return ok([]);

    const { data, error } = await supabase
      .from('worker_provider_continuity_v1')
      .select(
        'worker_id, provider_id, provider_name, approved_shift_count, distinct_site_count, first_worked_at, last_worked_at, is_repeat',
      )
      .eq('worker_id', workerRes.data)
      .order('approved_shift_count', { ascending: false })
      .order('last_worked_at', { ascending: false });

    if (error) return fail('provider_continuity_load', friendlyDbMessage(error, 'Unable to load provider history.'));

    return ok(
      ((data ?? []) as ProviderRow[]).map(row => ({
        workerId: row.worker_id,
        providerId: row.provider_id,
        providerName: row.provider_name,
        approvedShiftCount: row.approved_shift_count,
        distinctSiteCount: row.distinct_site_count,
        firstWorkedAt: row.first_worked_at,
        lastWorkedAt: row.last_worked_at,
        isRepeat: row.is_repeat,
      })),
    );
  } catch (error) {
    return fail('unexpected', error instanceof Error ? error.message : 'Request failed.');
  }
}

export async function listProviderWorkerContinuityFromSupabase(
  providerId: string,
): Promise<ApiResult<WorkerProviderContinuityReadModel[]>> {
  try {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return fail('not_authenticated', 'Sign in before loading provider continuity.');

    const { data, error } = await supabase
      .from('worker_provider_continuity_v1')
      .select(
        'worker_id, provider_id, provider_name, approved_shift_count, distinct_site_count, first_worked_at, last_worked_at, is_repeat',
      )
      .eq('provider_id', providerId)
      .order('approved_shift_count', { ascending: false })
      .order('last_worked_at', { ascending: false });

    if (error) return fail('provider_worker_continuity_load', friendlyDbMessage(error, 'Unable to load repeat-worker history.'));

    return ok(
      ((data ?? []) as ProviderRow[]).map(row => ({
        workerId: row.worker_id,
        providerId: row.provider_id,
        providerName: row.provider_name,
        approvedShiftCount: row.approved_shift_count,
        distinctSiteCount: row.distinct_site_count,
        firstWorkedAt: row.first_worked_at,
        lastWorkedAt: row.last_worked_at,
        isRepeat: row.is_repeat,
      })),
    );
  } catch (error) {
    return fail('unexpected', error instanceof Error ? error.message : 'Request failed.');
  }
}
