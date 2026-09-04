import type { ApiResult } from '../api/types';
import { getBackendMode } from '../lib/backendMode';
import {
  bookWorkerForShift as legacyBookWorkerForShift,
  inviteWorkerToShift as legacyInviteWorkerToShift,
} from './providerService';
import type { ProviderBookingPrepResult } from './types';

function unsupported(message: string): ApiResult<ProviderBookingPrepResult> {
  return {
    ok: false,
    error: {
      code: 'legacy_provider_action_disabled',
      message,
    },
  };
}

/**
 * Legacy worker-match booking exists only for the interactive mock catalog.
 * Production Supabase booking must start from a real shift_request and use the canonical booking RPC.
 */
export async function bookWorkerForShift(
  workerId: string,
  shiftId: string,
): Promise<ApiResult<ProviderBookingPrepResult>> {
  if (getBackendMode() === 'supabase') {
    return unsupported(
      'Direct booking from demo worker matches is disabled. Review real applicants on the shift and confirm coverage there.',
    );
  }
  return legacyBookWorkerForShift(workerId, shiftId);
}

/**
 * Legacy invite-without-a-specific-shift remains mock-only. Supabase invitations must use
 * inviteWorkerToOpenShift(workerId, shiftId), which persists a real provider_shift_invitations row.
 */
export async function inviteWorkerToShift(
  workerId: string,
  shiftId?: string,
): Promise<ApiResult<ProviderBookingPrepResult>> {
  if (getBackendMode() === 'supabase') {
    return unsupported(
      'Generic worker invitations are disabled in Supabase mode. Choose a real open shift from the worker profile.',
    );
  }
  return legacyInviteWorkerToShift(workerId, shiftId);
}
