/**
 * @fileoverview Application service layer — the boundary between UI and data.
 *
 * - **Today:** implementations read from `src/app/data` (mock data + selectors), wrapped in mock API responses.
 * - **Tomorrow:** swap mockRequest for HTTP/fetch + mapping while keeping Promise<ApiResult<…>> exports stable.
 *
 * **Convention:** route components and feature pages should import from `src/app/services`
 * instead of reaching into `mockData` directly.
 */

export type { ApiResult, ApiError, ApiListResult, ApiStatus } from '../api/types';

export * from './types';
export * from './workerService';
export * from './workerContinuityPreferenceService';
export * from './continuityService';
export * from './continuityTelemetryService';
export * from './providerService';
export * from './providerWorkerProfileService';
export * from './providerWorkerRelationshipService';
export * from './providerShiftInvitationService';
export * from './providerApplicantReviewService';
export * from './providerApplicantReviewTypes';
export {
  saveWorkerToProviderBench as addWorkerToBench,
  saveWorkerDoNotSend as markWorkerDoNotSend,
} from './providerWorkerRelationshipService';
export * from './adminService';
export * from './adminContinuityService';
export * from './adminContinuityReadinessService';
export * from './referralService';
