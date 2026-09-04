import type { ApiResult } from '../api/types';
import { getBackendMode } from '../lib/backendMode';
import { getCurrentProviderOrganizationFromSupabase } from '../repositories/providerOrganizationRepository';
import {
  getProviderWorkerProfileFromSupabase,
  type ProviderWorkerProfileView,
} from '../repositories/providerWorkerProfileRepository';
import { getProviderWorkerProfile } from './providerService';

/**
 * Canonical provider worker-profile entry point.
 *
 * Supabase mode uses real worker metadata plus approved-work continuity scoped to the current
 * provider organization. Mock mode preserves the existing preview assembler while normalizing it
 * into the same view type.
 */
export async function getCanonicalProviderWorkerProfile(
  workerId: string,
): Promise<ApiResult<ProviderWorkerProfileView | null>> {
  if (getBackendMode() !== 'supabase') {
    const result = await getProviderWorkerProfile(workerId);
    if (!result.ok || !result.data) return result;

    return {
      ok: true,
      data: {
        ...result.data,
        isSupabaseBacked: false,
        distinctSiteCount: result.data.siteFamiliarity.length,
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

  return getProviderWorkerProfileFromSupabase(organization.data.providerId, workerId);
}
