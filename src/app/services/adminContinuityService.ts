import type { ApiResult } from '../api/types';
import { mockRequest } from '../api/mockApi';
import { getBackendMode } from '../lib/backendMode';
import {
  getAdminContinuitySummaryFromSupabase,
  type AdminContinuitySummary,
} from '../repositories/adminContinuityRepository';

export type { AdminContinuitySummary } from '../repositories/adminContinuityRepository';

export async function getAdminContinuitySummary(): Promise<ApiResult<AdminContinuitySummary>> {
  if (getBackendMode() === 'supabase') {
    return getAdminContinuitySummaryFromSupabase();
  }

  return mockRequest(() => ({
    approvedWorkEvents: 284,
    workersWithHistory: 96,
    repeatSiteWorkers: 61,
    familiarWorkerSiteTies: 88,
    repeatProviderWorkerTies: 72,
    returningWorkSharePct: 46,
    sampled: false,
  }));
}
