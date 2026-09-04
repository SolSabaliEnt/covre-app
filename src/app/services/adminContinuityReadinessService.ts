import type { ApiResult } from '../api/types';
import { getBackendMode } from '../lib/backendMode';
import {
  getAdminContinuityReadinessFromSupabase,
  type AdminContinuityReadiness,
} from '../repositories/adminContinuityReadinessRepository';

const MOCK_ITEMS: AdminContinuityReadiness['items'] = [
  ['worker_return_preferences', 'Private worker return preferences', 'table', '20260904104500_worker_site_return_preferences.sql'],
  ['worker_site_continuity', 'Worker ↔ site continuity read model', 'view', '20260904113000_continuity_read_models.sql'],
  ['worker_provider_continuity', 'Worker ↔ provider continuity read model', 'view', '20260904113000_continuity_read_models.sql'],
  ['provider_worker_relationships', 'Provider-owned relationship state', 'table', '20260904123000_provider_worker_relationships.sql'],
  ['provider_shift_invitations', 'Provider shift invitations', 'table', '20260904131500_provider_shift_invitations.sql'],
  ['worker_invitation_response', 'Worker invitation response transaction', 'rpc', '20260904140000_worker_shift_invitation_responses.sql'],
  ['coverage_reconciliation', 'Coverage terminal-state reconciliation', 'trigger', '20260904144500_reconcile_coverage_terminal_state.sql'],
].map(([key, label, kind, migration]) => ({ key, label, kind, migration, ready: false }));

export type { AdminContinuityReadiness, AdminContinuityReadinessItem } from '../repositories/adminContinuityReadinessRepository';

export async function getAdminContinuityReadiness(): Promise<ApiResult<AdminContinuityReadiness>> {
  if (getBackendMode() === 'supabase') {
    return getAdminContinuityReadinessFromSupabase();
  }

  return {
    ok: true,
    data: {
      checkedAt: new Date().toISOString(),
      readyCount: 0,
      totalCount: MOCK_ITEMS.length,
      items: MOCK_ITEMS,
      diagnosticAvailable: false,
    },
  };
}
