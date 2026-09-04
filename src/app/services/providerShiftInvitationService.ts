import type { ApiResult } from '../api/types';
import { mockRequest } from '../api/mockApi';
import { shifts } from '../data/selectors';
import { getBackendMode } from '../lib/backendMode';
import {
  createProviderShiftInvitationInSupabase,
  listCurrentWorkerShiftInvitationsFromSupabase,
  listProviderInvitableShiftsFromSupabase,
  respondToWorkerShiftInvitationInSupabase,
  type ProviderInvitableShift,
  type ProviderShiftInvitation,
  type WorkerShiftInvitation,
  type WorkerShiftInvitationDecision,
  type WorkerShiftInvitationResponse,
} from '../repositories/providerShiftInvitationsRepository';

const MOCK_STORAGE_KEY = 'covre.provider-shift-invitations.v1';
const MOCK_CURRENT_WORKER_ID = 'worker-001';
const mockFallback: WorkerShiftInvitation[] = [];

function readMockInvitations(): WorkerShiftInvitation[] {
  if (typeof window === 'undefined') return [...mockFallback];
  try {
    const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
    if (!raw) return [...mockFallback];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WorkerShiftInvitation[]) : [...mockFallback];
  } catch {
    return [...mockFallback];
  }
}

function writeMockInvitations(invitations: WorkerShiftInvitation[]): void {
  mockFallback.splice(0, mockFallback.length, ...invitations);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(invitations));
  } catch {
    // In-memory fallback keeps demo interaction usable when storage is unavailable.
  }
}

function mockShiftInvitation(workerId: string, shiftId: string): WorkerShiftInvitation {
  const shift = shifts.find(row => row.id === shiftId);
  return {
    id: `invite-${Date.now()}-${workerId}`,
    providerId: shift?.providerOrgId ?? 'prov-001',
    shiftId,
    workerId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    shiftTitle: shift?.roleTitle ?? 'Open shift',
    role: shift?.workRole ?? 'Caregiver',
    siteName: shift?.siteName ?? 'Care site',
    startsAt: shift?.dateLabel ?? '',
    endsAt: shift?.timeRange ?? '',
  };
}

export async function listProviderInvitableShifts(): Promise<ApiResult<ProviderInvitableShift[]>> {
  if (getBackendMode() === 'supabase') {
    return listProviderInvitableShiftsFromSupabase();
  }

  return mockRequest(() =>
    shifts
      .filter(shift => shift.providerOrgId === 'prov-001' && shift.lifecycleStatus === 'Open')
      .map(shift => ({
        id: shift.id,
        title: shift.roleTitle,
        role: shift.workRole,
        siteName: shift.siteName,
        startsAt: shift.dateLabel,
        endsAt: shift.timeRange,
      })),
  );
}

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
    const invitations = readMockInvitations();
    const existing = invitations.find(
      invitation => invitation.workerId === workerId && invitation.shiftId === shiftId,
    );
    if (existing) return existing;

    const invitation = mockShiftInvitation(workerId, shiftId);
    writeMockInvitations([invitation, ...invitations]);
    return invitation;
  });
}

export async function listWorkerShiftInvitations(): Promise<ApiResult<WorkerShiftInvitation[]>> {
  if (getBackendMode() === 'supabase') {
    return listCurrentWorkerShiftInvitationsFromSupabase();
  }

  return mockRequest(() =>
    readMockInvitations().filter(
      invitation =>
        invitation.workerId === MOCK_CURRENT_WORKER_ID &&
        (invitation.status === 'pending' || invitation.status === 'viewed'),
    ),
  );
}

export async function respondToWorkerShiftInvitation(
  invitationId: string,
  decision: WorkerShiftInvitationDecision,
): Promise<ApiResult<WorkerShiftInvitationResponse>> {
  if (!invitationId.trim()) {
    return { ok: false, error: { code: 'validation', message: 'Invitation is required.' } };
  }

  if (getBackendMode() === 'supabase') {
    return respondToWorkerShiftInvitationInSupabase(invitationId, decision);
  }

  return mockRequest(() => {
    const invitations = readMockInvitations();
    const invitation = invitations.find(
      row => row.id === invitationId && row.workerId === MOCK_CURRENT_WORKER_ID,
    );
    if (!invitation) {
      throw new Error('Invitation not found.');
    }

    invitation.status = decision;
    writeMockInvitations(invitations);

    return {
      invitationId: invitation.id,
      shiftId: invitation.shiftId,
      workerId: invitation.workerId,
      status: decision,
      requestId: decision === 'accepted' ? `request-${invitation.id}` : undefined,
      bookingReady: decision === 'accepted',
    };
  });
}
