import type { ApiResult } from '../api/types';
import { getSupabaseClient } from '../lib/supabaseClient';
import type { ProviderBenchPayload, ProviderBenchSection, ProviderBenchWorker } from '../services/types';

type ProviderMembership = { providerId: string };

type RelationshipRow = {
  worker_id: string;
  state: 'bench' | 'do_not_send';
  updated_at: string;
};

type ContinuityRow = {
  worker_id: string;
  approved_shift_count: number;
  distinct_site_count: number;
  last_worked_at: string | null;
};

type WorkerProfileRow = {
  id: string;
  user_id: string;
  headline: string | null;
};

type UserProfileRow = {
  id: string;
  display_name: string | null;
};

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } };
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function friendlyDbMessage(err: { message?: string; code?: string }, fallback: string): string {
  const raw = err.message ?? fallback;
  if (/provider_worker_relationships|worker_provider_continuity_v1|relation .* does not exist/i.test(raw)) {
    return 'Covre Bench requires the provider relationship and continuity migrations.';
  }
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return 'Loading Covre Bench is blocked by database permissions (RLS).';
  }
  return raw;
}

async function loadProviderMembership(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<ApiResult<ProviderMembership | null>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return fail('not_authenticated', 'Sign in with Supabase before loading your bench.');
  }

  const { data: rows, error } = await supabase
    .from('provider_members')
    .select('provider_id')
    .eq('user_id', session.user.id)
    .limit(1);

  if (error) {
    return fail(
      'provider_membership_load',
      friendlyDbMessage(error, 'Unable to load provider membership.'),
    );
  }

  const row = rows?.[0] as { provider_id: string } | undefined;
  if (!row?.provider_id) return ok(null);
  return ok({ providerId: row.provider_id });
}

function formatLastWorkedAt(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildWorker(
  workerId: string,
  continuity: ContinuityRow | undefined,
  profiles: Map<string, WorkerProfileRow>,
  names: Map<string, string>,
): ProviderBenchWorker {
  const profile = profiles.get(workerId);
  const name = profile?.user_id ? names.get(profile.user_id) : undefined;

  return {
    id: workerId,
    name: name?.trim() || profile?.headline?.trim() || 'Care worker',
    roleLabel: profile?.headline?.trim() || undefined,
    completedShiftCount: continuity?.approved_shift_count ?? 0,
    lastWorkedAt: formatLastWorkedAt(continuity?.last_worked_at),
    isSupabaseBacked: true,
  };
}

/**
 * Canonical provider bench.
 *
 * Explicit provider state and historical familiarity are intentionally separate:
 * - `bench` means the provider deliberately saved the worker.
 * - approved-work continuity means the organization knows the worker through verified work.
 * - `do_not_send` removes the worker from both bench-facing buckets without deleting history.
 */
export async function listProviderBenchFromSupabase(): Promise<ApiResult<ProviderBenchPayload>> {
  try {
    const supabase = getSupabaseClient();
    const membershipRes = await loadProviderMembership(supabase);
    if (!membershipRes.ok) return membershipRes;

    if (!membershipRes.data) {
      return ok({
        sections: [],
        isSupabaseBacked: true,
        message: 'Complete provider workspace setup before your Covre Bench can load.',
      });
    }

    const { providerId } = membershipRes.data;

    const [relationshipsRes, continuityRes] = await Promise.all([
      supabase
        .from('provider_worker_relationships')
        .select('worker_id, state, updated_at')
        .eq('provider_id', providerId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('worker_provider_continuity_v1')
        .select('worker_id, approved_shift_count, distinct_site_count, last_worked_at')
        .eq('provider_id', providerId)
        .order('approved_shift_count', { ascending: false }),
    ]);

    if (relationshipsRes.error) {
      return fail(
        'provider_relationships_load',
        friendlyDbMessage(relationshipsRes.error, 'Unable to load provider bench state.'),
      );
    }
    if (continuityRes.error) {
      return fail(
        'provider_continuity_load',
        friendlyDbMessage(continuityRes.error, 'Unable to load approved-work continuity.'),
      );
    }

    const relationships = (relationshipsRes.data ?? []) as RelationshipRow[];
    const continuityRows = (continuityRes.data ?? []) as ContinuityRow[];
    const continuityByWorker = new Map(continuityRows.map(row => [row.worker_id, row]));

    const doNotSend = new Set(
      relationships.filter(row => row.state === 'do_not_send').map(row => row.worker_id),
    );
    const benchIds = relationships
      .filter(row => row.state === 'bench' && !doNotSend.has(row.worker_id))
      .map(row => row.worker_id);
    const knownIds = continuityRows
      .filter(row => !doNotSend.has(row.worker_id) && !benchIds.includes(row.worker_id))
      .map(row => row.worker_id);

    const workerIds = [...new Set([...benchIds, ...knownIds])];
    if (workerIds.length === 0) {
      return ok({
        sections: [],
        isSupabaseBacked: true,
        message:
          'No workers are on your bench yet. Approved work will appear as known history, and you can deliberately save workers you want to keep close.',
      });
    }

    const { data: workerProfilesData, error: workerProfilesError } = await supabase
      .from('worker_profiles')
      .select('id, user_id, headline')
      .in('id', workerIds);

    if (workerProfilesError) {
      return fail(
        'bench_worker_profiles_load',
        friendlyDbMessage(workerProfilesError, 'Unable to load worker details for Covre Bench.'),
      );
    }

    const workerProfiles = (workerProfilesData ?? []) as WorkerProfileRow[];
    const profilesById = new Map(workerProfiles.map(row => [row.id, row]));
    const userIds = [...new Set(workerProfiles.map(row => row.user_id).filter(Boolean))];
    const namesByUserId = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: userProfilesData } = await supabase
        .from('user_profiles')
        .select('id, display_name')
        .in('id', userIds);

      for (const row of (userProfilesData ?? []) as UserProfileRow[]) {
        if (row.display_name?.trim()) namesByUserId.set(row.id, row.display_name.trim());
      }
    }

    const explicitBenchWorkers = benchIds.map(workerId =>
      buildWorker(workerId, continuityByWorker.get(workerId), profilesById, namesByUserId),
    );
    const knownWorkers = knownIds.map(workerId =>
      buildWorker(workerId, continuityByWorker.get(workerId), profilesById, namesByUserId),
    );

    const sections: ProviderBenchSection[] = [];
    if (explicitBenchWorkers.length > 0) {
      sections.push({ title: 'Saved to your Bench', workers: explicitBenchWorkers });
    }
    if (knownWorkers.length > 0) {
      sections.push({ title: 'Known from approved work', workers: knownWorkers });
    }

    return ok({
      sections,
      isSupabaseBacked: true,
      message:
        'Bench is provider-owned. Approved work history remains visible separately and does not imply preference.',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Request failed.';
    return fail('unexpected', message);
  }
}
