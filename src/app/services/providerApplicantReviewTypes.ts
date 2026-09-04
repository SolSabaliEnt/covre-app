import type { ProviderShiftApplicantStatus } from './types';
import type { ProviderShiftInvitationStatus } from '../repositories/providerShiftInvitationsRepository';

export type ProviderApplicantReviewState =
  | 'applied'
  | 'invited'
  | 'invited_accepted'
  | 'booked'
  | 'withdrawn'
  | 'declined';

export type ProviderApplicantInvitationContext = {
  invitationId: string;
  status: ProviderShiftInvitationStatus;
  invitedAt: string;
  updatedAt?: string;
};

export type ProviderShiftApplicantReview = {
  requestId?: string;
  shiftId: string;
  workerId: string;
  workerName: string;
  workerRole?: string;
  workerLocation?: string;
  requestStatus?: ProviderShiftApplicantStatus;
  submittedAt?: string;
  invitation?: ProviderApplicantInvitationContext;
  reviewState: ProviderApplicantReviewState;
  isSupabaseBacked: boolean;
};

export type ProviderShiftApplicantReviewResult = {
  shiftId: string;
  applicants: ProviderShiftApplicantReview[];
  canConfirmBookings: boolean;
  message?: string;
};
