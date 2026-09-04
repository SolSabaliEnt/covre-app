import type { ApiResult } from '../api/types';
import { mockRequest } from '../api/mockApi';
import { getBackendMode } from '../lib/backendMode';
import { getWorkerById } from '../data/selectors';
import { listProviderShiftApplicantReviewFromSupabase } from '../repositories/providerApplicantsRepository';
import { listMockProviderShiftInvitationsForReview } from './providerShiftInvitationService';
import type {
  ProviderShiftApplicantReview,
  ProviderShiftApplicantReviewResult,
} from './providerApplicantReviewTypes';

export async function listProviderShiftApplicantReview(
  shiftId: string,
): Promise<ApiResult<ProviderShiftApplicantReviewResult>> {
  const trimmed = shiftId.trim();
  if (!trimmed) {
    return { ok: false, error: { code: 'validation', message: 'Shift is required.' } };
  }

  if (getBackendMode() === 'supabase') {
    return listProviderShiftApplicantReviewFromSupabase(trimmed);
  }

  const invitations = await listMockProviderShiftInvitationsForReview(trimmed);
  if (!invitations.ok) return invitations;

  return mockRequest(() => {
    const applicants: ProviderShiftApplicantReview[] = invitations.data.map(invitation => {
      const worker = getWorkerById(invitation.workerId);
      const accepted = invitation.status === 'accepted';
      const declined = invitation.status === 'declined';

      return {
        requestId: accepted ? `request-${invitation.id}` : undefined,
        shiftId: invitation.shiftId,
        workerId: invitation.workerId,
        workerName: worker?.name ?? 'Care worker',
        workerRole: worker?.primaryRole,
        invitation: {
          invitationId: invitation.id,
          status: invitation.status,
          invitedAt: invitation.createdAt,
        },
        reviewState: accepted ? 'invited_accepted' : declined ? 'declined' : 'invited',
        isSupabaseBacked: false,
      };
    });

    return {
      shiftId: trimmed,
      applicants,
      canConfirmBookings: true,
      message:
        applicants.length > 0
          ? 'Invitation activity is shown alongside the provider booking confirmation step.'
          : undefined,
    };
  });
}
