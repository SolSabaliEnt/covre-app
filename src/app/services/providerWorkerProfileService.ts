import type { ApiResult } from '../api/types';
import { getBackendMode } from '../lib/backendMode';
import { getCurrentProviderOrganizationFromSupabase } from '../repositories/providerOrganizationRepository';
import {
  getProviderWorkerProfileFromSupabase,
  type ProviderWorkerProfileView,
} from '../repositories/providerWorkerProfileRepository';
import { getProviderWorkerProfile } from './providerService';
import { getProviderWorkerRelationship } from './providerWorkerRelationshipService';

/**
 * Canonical provider worker-profile entry point.
 *
 * Supabase mode uses real worker metadata plus approved-work continuity scoped to the current
 * provider organization. Provider-owned bench / do-not-send state remains separate from worker
 * continuity and from the worker's private willingness-to-return preference.
 */
export async function getCanonicalProviderWorkerProfile(
  workerId: string,
): Promise<ApiResult<ProviderWorkerProfileView | null>> {
  if (getBackendMode() !== 'supabase') {
    const result = await getProviderWorkerProfile(workerId);
    if (!result.ok || !result.data) return result;

    const relationship = await getProviderWorkerRelationship(workerId);
    return {
      ok: true,
      data: {
        ...result.data,
        isSupabaseBacked: false,
        distinctSiteCount: result.data.siteFamiliarity.length,
        isPreferredBench:
          relationship.ok && relationship.data
            ? relationship.data.state === 'bench'
            : result.data.isPreferredBench,
      },
    };
  }

  const organization = await getCurrentProviderOrganizationFromSupabase();
  if (!organization.ok) return organization;
  if (!organization.data) {
    return {
      ok: false,
      error: {
        code: 'provider_required',
        message: 'Join or create a provider organization before loading worker profiles.',
      },
    };
  }

  const profile = await getProviderWorkerProfileFromSupabase(organization.data.providerId, workerId);
  if (!profile.ok || !profile.data) return profile;

  const relationship = await getProviderWorkerRelationship(workerId);
  if (!relationship.ok) return relationship;

  return {
    ok: true,
    data: {
      ...profile.data,
      isPreferredBench: relationship.data?.state === 'bench',
    },
  };
}
