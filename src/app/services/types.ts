/** Frontend-only DTOs for the service layer; future API responses can align here. */
import type { CareSite, Shift, SiteOperationalDetail } from '../data/types';

export type SafetyReportPayload = {
  issueType: string;
  details: string;
  urgent: boolean;
};

export type ProviderSupportRequestPayload = {
  topicId: string;
  message: string;
};

export type ProviderSupportTopicOption = {
  id: string;
  label: string;
  hint: string;
};

/** Bookings tab: mock snapshot built from catalog shifts without changing dataset rows. */
export type WorkerBookingCard = {
  shift: Shift;
  statusDisplay: string;
};

export type WorkerBookingsPayload = {
  upcoming: WorkerBookingCard[];
  completed: WorkerBookingCard[];
};

export type WorkerBookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled_by_worker'
  | 'cancelled_by_provider'
  | 'completed'
  | 'no_show'
  | 'disputed';

export type WorkerBookingRow = {
  bookingId: string;
  shiftId: string;
  status: WorkerBookingStatus;
  title: string;
  siteName: string;
  role: string;
  startsAt: string;
  endsAt: string;
  hourlyRate?: number;
  address?: string;
  isSupabaseBacked: boolean;
};

/** Active shift — scheduling vs unavailable (Supabase uses `phase` for clock state). */
export type WorkerActiveShiftStatus =
  | 'scheduled'
  | 'ready'
  | 'in_progress_staged'
  | 'completed_staged'
  | 'unavailable';

export type WorkerClockEventType = 'clock_in' | 'break_start' | 'break_end' | 'clock_out';

export type WorkerClockEvent = {
  id: string;
  bookingId: string;
  eventType: WorkerClockEventType;
  occurredAt: string;
  note?: string;
};

export type WorkerActiveShiftPhase =
  | 'scheduled'
  | 'clocked_in'
  | 'on_break'
  | 'clocked_out'
  | 'submitted';

export type WorkerActiveShiftSummary = {
  bookingId?: string;
  shiftId?: string;
  status: WorkerActiveShiftStatus;
  phase?: WorkerActiveShiftPhase;
  title?: string;
  siteName?: string;
  startsAt?: string;
  endsAt?: string;
  role?: string;
  /** @deprecated Use workerPayDisplay in Supabase mode */
  hourlyRate?: number;
  workerRateCentsSnapshot?: number;
  rateTypeSnapshot?: string;
  workerPayDisplay?: string;
  message: string;
  isSupabaseBacked: boolean;
  actionsEnabled: boolean;
  events?: WorkerClockEvent[];
  clockInAt?: string;
  clockOutAt?: string;
  timesheetId?: string;
  canClockIn?: boolean;
  canStartBreak?: boolean;
  canEndBreak?: boolean;
  canClockOut?: boolean;
  canSubmitTimesheet?: boolean;
};

export type WorkerTimesheetSubmitResult = {
  timesheetId: string;
  bookingId: string;
  status: string;
  message: string;
  submittedAt: string;
};

export type WorkerActiveShiftPayload = {
  previewShiftId?: string;
  shift?: Shift;
  summary: WorkerActiveShiftSummary;
};

export type WorkerMessageThreadPreview = {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
};

export type WorkerAccountPayload = {
  displayName: string;
  primaryRoleLabel: string;
  /** Supabase prep — profile loaded from user_profiles / worker_profiles. */
  onboardingComplete?: boolean;
  needsOnboarding?: boolean;
  isSupabaseBacked?: boolean;
  phone?: string;
  location?: string;
};

export type WorkerProfileDraft = {
  fullName: string;
  phone?: string;
  city?: string;
  state?: string;
  roles?: string[];
  experienceLevel?: string;
  availability?: string;
};

export type WorkerProfileSummary = {
  workerId: string;
  fullName: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  roles?: string[];
  experienceLevel?: string;
  onboardingComplete: boolean;
  isSupabaseBacked: boolean;
};

export type WorkerProfileSaveResult = {
  workerId: string;
  status: string;
  message: string;
  updatedAt: string;
};

export type WorkerCredentialReadinessStatus =
  | 'verified'
  | 'pending'
  | 'missing'
  | 'expired'
  | 'self_attested';

export type WorkerCredentialReadinessRow = {
  credentialId: string;
  name: string;
  category?: string;
  status: WorkerCredentialReadinessStatus;
  statusLabel: string;
  expiresAt?: string;
  isRequiredForOpenShift?: boolean;
};

export type WorkerCredentialSaveResult = {
  credentialId: string;
  status: string;
  message: string;
  updatedAt: string;
};

export type WorkerShiftReadiness = {
  isReady: boolean;
  missingCredentialNames: string[];
  matchedCredentialNames: string[];
  statusLabel: string;
};

/** Explicit worker pay fields on open-shift discovery (0024); see WORKER_PAY_RATE_DISPLAY_PLAN.md */
export type WorkerShiftPayFields = {
  workerRateCents?: number;
  currency?: string;
  rateType?: 'hourly' | 'flat' | string;
  workerPayDisplay?: string;
  workerRateCentsSnapshot?: number;
  currencySnapshot?: string;
  rateTypeSnapshot?: string;
};

export type WorkerShiftRequestStatus =
  | 'submitted'
  | 'already_submitted'
  | 'withdrawn'
  | 'simulated';

export type WorkerShiftRequestResult = {
  requestId?: string;
  shiftId: string;
  status: WorkerShiftRequestStatus;
  message: string;
  createdAt: string;
};

export type WorkerShiftRequestSummary = {
  requestId: string;
  shiftId: string;
  status: string;
  submittedAt?: string;
};

export type WorkerActionStatus =
  | 'claimed'
  | 'saved'
  | 'site_return_preference_saved'
  | 'question_sent'
  | 'calendar_added'
  | 'clocked_in'
  | 'break_started'
  | 'break_ended'
  | 'clocked_out'
  | 'timesheet_submitted'
  | 'submitted';

export type WorkerActionResult = {
  id: string;
  status: WorkerActionStatus;
  message: string;
  updatedAt: string;
};

/** Provider worker profile detail — assembled from mock workers, shifts, sites, credentials. */
export type ProviderWorkerCredential = {
  id: string;
  name: string;
  category: string;
  verified: boolean;
};

export type ProviderWorkerRecentShift = {
  shiftId: string;
  siteName: string;
  roleTitle: string;
  dateLabel: string;
  timeRange: string;
};

export type ProviderWorkerSiteFamiliarity = {
  siteId: string;
  siteName: string;
  shiftCount: number;
};

export type ProviderWorkerReliability = {
  completedShifts: number;
  onTimeRatePct: number;
  repeatRequests: number;
};

export type ProviderWorkerProfile = {
  id: string;
  name: string;
  roles: string[];
  location: string;
  initials: string;
  covreScore: number;
  isVerified: boolean;
  isPreferredBench: boolean;
  credentials: ProviderWorkerCredential[];
  reliability: ProviderWorkerReliability;
  siteFamiliarity: ProviderWorkerSiteFamiliarity[];
  recentShifts: ProviderWorkerRecentShift[];
  providerNotes: string;
};

export type ProviderActionStatus =
  | 'booked'
  | 'invited'
  | 'added_to_bench'
  | 'do_not_send'
  | 'approved'
  | 'disputed'
  | 'queued';

export type ProviderActionResult = {
  id: string;
  status: ProviderActionStatus;
  message: string;
  updatedAt: string;
};

export type TimesheetActionResult = {
  id: string;
  status: 'approved' | 'disputed';
  message: string;
  updatedAt: string;
};

export type ProviderTimesheetActionStatus = 'approved' | 'disputed' | 'unsupported';

export type ProviderTimesheetActionResult = {
  timesheetId: string;
  status: ProviderTimesheetActionStatus;
  message: string;
  updatedAt: string;
};

export type ProviderApprovedTimesheetBillingRow = {
  timesheetId: string;
  bookingId: string;
  shiftId: string;
  workerName: string;
  siteName: string;
  hours: number;
  hourlyRate?: number;
  estimatedAmount: number;
  approvedAt?: string;
  isSupabaseBacked: boolean;
};

/** Provider onboarding wizard (frontend mock; no persistence contract yet). */
export type ProviderOnboardingStep =
  | 'organization'
  | 'site'
  | 'staffing'
  | 'billing'
  | 'complete';

export type ProviderOnboardingDraft = {
  organizationName?: string;
  organizationType?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  siteName?: string;
  siteType?: string;
  siteAddress?: string;
  city?: string;
  state?: string;
  residentCount?: string;
  rolesNeeded?: string[];
  shiftTypes?: string[];
  billingEmail?: string;
};

export type ProviderOnboardingResult = {
  providerId: string;
  siteId: string;
  status: string;
  message: string;
  completedAt: string;
};

export type ProviderOnboardingStatusPayload = {
  onboardingComplete: boolean;
  suggestedStep: ProviderOnboardingStep;
  lastDraft: Partial<ProviderOnboardingDraft>;
};

/** Provider site detail page payload (Sites list + SiteDetail). */
export type ProviderSitePage = {
  site: CareSite;
  operational: SiteOperationalDetail;
  benchNames: string[];
};

export type ProviderSiteCreatePayload = {
  siteName: string;
  siteType?: string;
  address?: string;
  city?: string;
  state?: string;
  residentCount?: string;
  primaryContact?: string;
  contactPhone?: string;
  orientationNotes?: string;
};

export type ProviderSiteCreateResult = {
  siteId: string;
  site: CareSite;
};

/** Provider post-shift create (Supabase: shifts + optional shift_requirements). */
export type ProviderShiftCreatePayload = {
  siteId: string;
  title: string;
  role: string;
  startsAt: string;
  endsAt: string;
  hourlyRate: number;
  isUrgent?: boolean;
  requiredCredentialIds?: string[];
  notes?: string;
};

export type ProviderShiftCreateResult = {
  shiftId: string;
  status: string;
  message: string;
  createdAt: string;
};

export type ProviderShiftApplicantStatus =
  | 'requested'
  | 'withdrawn'
  | 'accepted'
  | 'rejected';

export type ProviderShiftApplicant = {
  requestId: string;
  shiftId: string;
  workerId: string;
  workerName: string;
  workerRole?: string;
  workerLocation?: string;
  status: ProviderShiftApplicantStatus;
  submittedAt?: string;
  isSupabaseBacked: boolean;
};

export type ProviderShiftApplicantsResult = {
  shiftId: string;
  applicants: ProviderShiftApplicant[];
  isReadOnly: boolean;
  message?: string;
};

export type ProviderBookingAcceptResult = {
  bookingId: string;
  shiftId: string;
  workerId: string;
  requestId: string;
  status: string;
  message: string;
  createdAt: string;
};

/** Result from book_worker_for_shift RPC (not yet wired to accept UI). */
export type ProviderBookWorkerRpcResult = {
  bookingId: string;
  shiftId: string;
  workerId: string;
  requestId: string | null;
  status: string;
  billRateCentsSnapshot: number | null;
  workerRateCentsSnapshot: number | null;
  currencySnapshot: string | null;
  rateTypeSnapshot: string | null;
  createdAt: string;
  idempotent: boolean;
  message: string;
};

/** Worker-match candidate card (demo workers until profiles/bookings adapter). */
export type ProviderWorkerMatchCandidate = {
  id: string;
  name: string;
  role: string;
  score: number;
  distance: string;
  onTime: number;
  credentials: string[];
  priorShifts: number;
  status: 'ready' | 'preferred';
};

/** Provider worker-match page payload (shift context + simulated candidates). */
export type ProviderWorkerMatchPage = {
  shift: Shift;
  candidates: ProviderWorkerMatchCandidate[];
  isSimulated: true;
  source: 'mock' | 'supabase_shift_mock_candidates';
};

/** Bench worker row (mock demo fields optional; Supabase omits scores). */
export type ProviderBenchWorker = {
  id: string;
  name: string;
  roleLabel?: string;
  credentialSummary?: string;
  completedShiftCount?: number;
  lastWorkedAt?: string;
  isSupabaseBacked: boolean;
  /** Mock-only display fields */
  score?: number;
  shifts?: number;
};

export type ProviderBenchSection = {
  title: string;
  workers: ProviderBenchWorker[];
};

/** Provider bench page payload. */
export type ProviderBenchPayload = {
  sections: ProviderBenchSection[];
  isSupabaseBacked: boolean;
  message?: string;
};

/** Provider booking prep (no real bookings row until worker/booking adapters). */
export type ProviderBookingPrepStatus = 'simulated' | 'queued' | 'unsupported';

export type ProviderBookingPrepResult = {
  shiftId: string;
  workerId: string;
  status: ProviderBookingPrepStatus;
  message: string;
  createdAt: string;
  source: 'mock' | 'supabase_shift_mock_worker';
};

/** Current provider org for signed-in user (Supabase: provider_members → provider_organizations). */
export type ProviderOrganizationSummary = {
  providerId: string;
  organizationName: string;
  organizationType?: string;
  status?: string;
  memberRole?: string;
};

/** Provider org team / invites (frontend mock; aligns with `provider_members` roles in SQL). */
export type ProviderMemberRole = 'owner' | 'admin' | 'scheduler' | 'billing' | 'viewer';

export type ProviderTeamMember = {
  id: string;
  name: string;
  email: string;
  role: ProviderMemberRole;
  status: 'active' | 'invited' | 'disabled';
  lastActiveAt?: string;
  invitedAt?: string;
};

export type ProviderInvitePayload = {
  email: string;
  role: ProviderMemberRole;
  message?: string;
};

export type ProviderInviteResult = {
  id: string;
  email: string;
  role: ProviderMemberRole;
  status: string;
  message: string;
  invitedAt: string;
};

export type ProviderMemberActionResult = {
  id: string;
  status: string;
  message: string;
  updatedAt: string;
};

/** Referral / affiliate program (frontend mock). */
export type ReferralTrack = 'worker_to_provider' | 'provider_to_provider';

export type ReferralStatus =
  | 'invited'
  | 'signed_up'
  | 'first_shift_completed'
  | 'qualified'
  | 'paid'
  | 'credited'
  | 'ineligible';

export type ReferralRewardType = 'cash' | 'shift_credit';

export type ReferralProgramTier = {
  id: string;
  facilityType: string;
  rewardAmount: number;
  rewardType: ReferralRewardType;
  description: string;
};

export type ReferralRecord = {
  id: string;
  track: ReferralTrack;
  referrerId: string;
  referrerName: string;
  referredOrganization: string;
  referredContact: string;
  facilityType: string;
  status: ReferralStatus;
  rewardAmount: number;
  rewardType: ReferralRewardType;
  referralLink: string;
  createdAt: string;
  qualifiedAt?: string;
};

export type ReferralDashboard = {
  referralLink: string;
  totalPending: number;
  totalEarned: number;
  referrals: ReferralRecord[];
  tiers: ReferralProgramTier[];
  programTerms: string[];
};

/** Admin users directory — one row per mock worker/provider/admin persona. */
export type AdminUserRole = 'worker' | 'provider' | 'admin';

export type AdminUserRow = {
  id: string;
  name: string;
  role: AdminUserRole;
  email: string;
  status: 'active' | 'review' | 'suspended';
  detail: string;
};

/** Admin marketplace shift row — derived from mock Shift catalog. */
export type AdminMarketplaceShiftRow = {
  id: string;
  title: string;
  siteName: string;
  providerName: string;
  dateTime: string;
  status: string;
  workerName: string | null;
  payDisplay: string;
};

export type ProviderBillingSummary = {
  currentBalance: string;
  upcomingInvoiceDate: string;
  paymentMethodLabel: string;
  autoPayEnabled: boolean;
  invoiceDeliveryEmail: string;
};

export type ProviderInvoiceRow = {
  id: string;
  invoiceNumber: string;
  periodLabel: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  dueAt?: string;
  paidAt?: string;
  lineItemCount: number;
  isSimulated: boolean;
};

export type ProviderInvoiceGenerationResult = {
  invoiceId: string;
  status: 'generated' | 'no_ready_timesheets';
  message: string;
  generatedAt: string;
};

export type ProviderPaymentMethodReadiness = {
  isReady: boolean;
  providerId?: string;
  displayLabel?: string;
  message: string;
};

export type ProviderTimesheetReadinessSummary = {
  total: number;
  approved: number;
  submitted: number;
  disputed: number;
  missing: number;
  estimatedApprovedAmount: number;
};

export type ProviderCompliancePacketRow = {
  id: string;
  shiftId: string;
  shiftTitle: string;
  siteId: string;
  siteName: string;
  shiftDate: string;
  bookingId?: string;
  timesheetId?: string;
  packetId?: string;
  status: string;
  statusLabel: string;
  missingItems?: string[];
  isSimulated: boolean;
  generatedAt?: string;
  hasFile?: boolean;
};

export type ProviderCompliancePacketGenerationResult = {
  packetId?: string;
  timesheetId: string;
  status: 'generated' | 'unsupported';
  message: string;
  generatedAt: string;
};

export type ProviderSettingsSummary = {
  organizationName: string;
  organizationType: string;
  primaryContactName: string;
  primaryContactEmail: string;
  billingEmail: string;
  paymentTerms: string;
  invoiceFrequency: string;
  autoPayEnabled: boolean;
  notifyShiftActivity: boolean;
  notifyTimesheetActivity: boolean;
  notifyComplianceActivity: boolean;
  isSupabaseBacked?: boolean;
};

export type ProviderSettingsActionResult = {
  status: string;
  message: string;
  updatedAt: string;
};

export type ProviderOrganizationSettingsUpdatePayload = {
  organizationName: string;
  organizationType?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
};
