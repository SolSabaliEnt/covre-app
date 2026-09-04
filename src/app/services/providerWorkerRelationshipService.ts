import type { ApiResult } from '../api/types';
import { mockRequest } from '../api/mockApi';
import { getBackendMode } from '../lib/backendMode';
import {
  addWorkerToProviderBenchInSupabase,
  getProviderWorkerRelationshipFromSupabase,
  markWorkerDoNotSendInSupabase,
  type ProviderWorkerRelationship,
} from '../repositories/providerWorkerRelationshipRepository';
import type { ProviderActionResult } from './types';

const mockRelationships = new Map<string, ProviderWorkerRelationship['state']>();

export async function getProviderWorkerRelationship(
  workerId: string,
): Promise<ApiResult<ProviderWorkerRelationship | null>> {
  if (getBackendMode() === 'supabase') {
    return getProviderWorkerRelationshipFromSupabase(workerId);
  }

  return mockRequest(() => {
    const state = mockRelationships.get(workerId);
    return state
      ? {
          providerId: 'prov-001',
          workerId,
          state,
          updatedAt: new Date().toISOString(),
        }
      : null;
  });
}

export async function saveWorkerToProviderBench(
  workerId: string,
): Promise<ApiResult<ProviderActionResult>> {
  if (getBackendMode() === 'supabase') {
    return addWorkerToProviderBenchInSupabase(workerId);
  }

  return mockRequest(() => {
    mockRelationships.set(workerId, 'bench');
    return {
      id: workerId,
      status: 'added_to_bench' as const,
      message: 'Worker saved to your Covre Bench.',
      updatedAt: new Date().toISOString(),
    };
  });
}

export async function saveWorkerDoNotSend(
  workerId: string,
): Promise<ApiResult<ProviderActionResult>> {
  if (getBackendMode() === 'supabase') {
    return markWorkerDoNotSendInSupabase(workerId);
  }

  return mockRequest(() => {
    mockRelationships.set(workerId, 'do_not_send');
    return {
      id: workerId,
      status: 'do_not_send' as const,
      message: 'Worker marked do not send for your organization.',
      updatedAt: new Date().toISOString(),
    };
  });
}
