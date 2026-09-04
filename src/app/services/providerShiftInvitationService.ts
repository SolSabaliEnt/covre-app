import type { ApiResult } from '../api/types';
import { mockRequest } from '../api/mockApi';
import { getBackendMode } from '../lib/backendMode';
import {
  createProviderShiftInvitationInSupabase,
  listCurrentWorkerShiftInvitationsFromSupabase,
  type ProviderShiftInvitation,
} from '../repositories/providerShiftInvitationsRepository';

const mockInvitations: ProviderShiftInvitation[] = [];

export async function inviteWorkerToOpenShift(
  workerId: string,
  shiftId: string,
): Promise<ApiResult<ProviderShiftInvitation>> {
  if (!workerId.trim() || !shiftId.trim()) {
    return { ok: false, error: { code: 'validation', message: 'Choose a worker and open shift.' } };
  }

  if (getBackendMode() === 'supabase') {
    return createProviderShiftInvitationInSupabase(workerId, shiftId);
  }

  return mockRequest(() => {
    const existing = mockInvitations.find(
      invitation => invitation.workerId === workerId && invitation.shiftId === shiftId,
    );
    if (existing) return existing;

    const invitation: ProviderShiftInvitation = {
      id: `invite-${Date.now()}-${workerId}`,
      providerId: 'prov-001',
      shiftId,
      workerId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    mockInvitations.unshift(invitation);
    return invitation;
  });
}

export async function listWorkerShiftInvitations(): Promise<ApiResult<ProviderShiftInvitation[]>> {
  if (getBackendMode() === 'supabase') {
    return listCurrentWorkerShiftInvitationsFromSupabase();
  }

  return mockRequest(() => [...mockInvitations]);
}
