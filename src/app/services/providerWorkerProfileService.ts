import type { ApiResult } from '../api/types';
import { getBackendMode } from '../lib/backendMode';
import { getCurrentProviderOrganizationFromSupabase } from '../repositories/providerOrganizationRepository';
import { getProviderWorkerProfileFromSupabase } from '../repositories/providerWorkerProfileRepository';
import type { ProviderWorkerProfile } from './types';
import { getProviderWorkerProfile } from './providerService';

/**
 * Canonical provider worker-profile entry point.
 *
 * Supabase mode uses real worker metadata plus approved-work continuity scoped to the current
 * provider organization. Mock mode preserves the existing preview assembler.
 */
export async function getCanonicalProviderWorkerProfile(
  workerId: string,
): Promise<ApiResult<ProviderWorkerProfile | null>> {
  if (getBackendMode() !== 'supabase') {
    return getProviderWorkerProfile(workerId);
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
