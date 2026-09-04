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
  totalQualified: number;
  totalPaidOrCredited: number;
  tiers: ReferralProgramTier[];
  records: ReferralRecord[];
  /** Supabase prep — org-aware link; credits/tracker may be simulated. */
  providerId?: string;
  organizationName?: string;
  setupStatus?: 'complete' | 'incomplete';
  isSupabaseBacked?: boolean;
  isSimulated?: boolean;
};

export type ReferralActionResult = {
  id: string;
  status: string;
  message: string;
  updatedAt: string;
};

export type ReferralInvitePayload = {
  track: ReferralTrack;
  referredOrganization: string;
  referredContact: string;
  facilityType: string;
};

/** Provider compliance prep — readiness rows from real shifts until packets are generated. */
export type ProviderCompliancePacketStatus =
  | 'ready'
  | 'ready_for_packet'
  | 'packet_generated'
  | 'pending_worker'
  | 'pending_timesheet'
  | 'simulated';

export type ProviderCompliancePacketRow = {
  id: string;
  shiftId: string;
  siteId: string;
  shiftTitle: string;
  siteName: string;
  shiftDate: string;
  status: ProviderCompliancePacketStatus;
  statusLabel: string;
  packetType: string;
  generatedAt?: string;
  isSimulated: boolean;
  missingItems?: string[];
  timesheetId?: string;
  packetId?: string;
  bookingId?: string;
  hasFile?: boolean;
  isSupabaseBacked?: boolean;
};

export type ProviderCompliancePacketGenerationResult = {
  packetId: string;
  bookingId: string;
  timesheetId?: string;
  status: string;
  message: string;
  generatedAt: string;
  limitations?: string[];
};

export type ProviderGeneratedCompliancePacketRow = {
  packetId: string;
  bookingId: string;
  timesheetId?: string;
  shiftId: string;
  workerName: string;
  siteName: string;
  shiftDate: string;
  status: string;
  generatedAt?: string;
  hasFile: boolean;
  isSupabaseBacked: boolean;
};

/** Provider billing prep — readiness from real shifts until invoices/payments are wired. */
export type ProviderBillingReadinessStatus =
  | 'ready'
  | 'pending_booking'
  | 'pending_timesheet'
  | 'simulated';

export type ProviderBillingReadinessRow = {
  id: string;
  shiftId: string;
  shiftTitle: string;
  siteName: string;
  shiftDate: string;
  estimatedAmount: number;
  status: ProviderBillingReadinessStatus;
  statusLabel: string;
  isSimulated: boolean;
  missingItems?: string[];
};

export type ProviderBillingSummary = {
  estimatedOpenValue: number;
  readyToInvoiceValue: number;
  simulatedInvoiceValue: number;
  rows: ProviderBillingReadinessRow[];
  approvedTimesheetRows?: ProviderApprovedTimesheetBillingRow[];
};

export type ProviderInvoiceStatus = 'draft' | 'generated' | 'void';

/** Collection sub-state on `invoices.payment_status` (0029+). Not used in UI until issue/collect RPCs ship. */
export type ProviderInvoicePaymentStatus =
  | 'not_started'
  | 'requires_payment_method'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'past_due'
  | 'void'
  | 'refunded'
  | 'disputed';

export type ProviderInvoiceLineRow = {
  id: string;
  timesheetId: string;
  bookingId: string;
  shiftId: string;
  workerName: string;
  siteName: string;
  description: string;
  hours: number;
  rate?: number;
  amount: number;
};

export type ProviderInvoiceRow = {
  invoiceId: string;
  providerId: string;
  status: ProviderInvoiceStatus;
  totalAmount: number;
  generatedAt?: string;
  lineCount: number;
  lines?: ProviderInvoiceLineRow[];
  isSupabaseBacked: boolean;
  /** Optional lifecycle fields (0029+); populated when repositories select them. */
  invoiceNumber?: string;
  issuedAt?: string;
  lockedAt?: string;
  paidAt?: string;
  voidedAt?: string;
  paymentStatus?: ProviderInvoicePaymentStatus;
  totalCents?: number;
  currency?: string;
};

export type ProviderInvoiceGenerationResult = {
  invoiceId: string;
  status: ProviderInvoiceStatus;
  message: string;
  totalAmount: number;
  generatedAt: string;
};

/** Admin invoice issue queue row (`/admin/payments`). */
export type AdminInvoiceIssueRow = {
  invoiceId: string;
  providerName?: string;
  invoiceNumber?: string;
  status: string;
  paymentStatus?: ProviderInvoicePaymentStatus;
  totalCents?: number;
  totalDisplay: string;
  lineCount: number;
  lineTotalCents: number;
  generatedAt?: string;
  dueAt?: string;
  canIssue: boolean;
  blockerReason?: string;
};

export type AdminInvoiceIssueQueue = {
  rows: AdminInvoiceIssueRow[];
  summary: {
    draftInvoices: number;
    readyToIssue: number;
    blocked: number;
    openInvoices: number;
  };
  isSupabaseBacked: boolean;
  message?: string;
};

/** Admin provider invoice collection queue row (`/admin/payments`). */
export type AdminProviderInvoiceCollectionRow = {
  invoiceId: string;
  providerId: string;
  providerName?: string;
  invoiceNumber?: string;
  status: string;
  paymentStatus?: ProviderInvoicePaymentStatus;
  totalCents?: number;
  totalDisplay: string;
  currency: string;
  lockedAt?: string;
  issuedAt?: string;
  dueAt?: string;
  collectionStartedAt?: string;
  lastPaymentAttemptAt?: string;
  paidAt?: string;
  hasActivePaymentMethod: boolean;
  methodBrand?: string;
  methodLast4?: string;
  latestPaymentStatus?: string;
  latestProcessorPaymentStatus?: string;
  latestProviderPaymentId?: string;
  canCollect: boolean;
  blockerReason?: string;
};

export type AdminProviderInvoiceCollectionQueue = {
  rows: AdminProviderInvoiceCollectionRow[];
  summary: {
    openInvoices: number;
    readyToCollect: number;
    missingPaymentMethod: number;
    processing: number;
    paid: number;
  };
  isSupabaseBacked: boolean;
  collectionUiEnabled: boolean;
  message?: string;
};

/** Edge result from create-provider-invoice-payment-intent (safe fields only). */
export type ProviderInvoiceCollectionStartResult = {
  providerPaymentId: string;
  invoiceId: string;
  processorPaymentIntentId: string;
  processorPaymentStatus: string;
  status: string;
  amountCents: number;
  currency: string;
  duplicate?: boolean;
  message: string;
};

/** Admin issue RPC result (0030+). */
export type ProviderInvoiceIssueResult = {
  invoiceId: string;
  invoiceNumber?: string;
  status: string;
  paymentStatus?: ProviderInvoicePaymentStatus;
  totalCents: number;
  issuedAt?: string;
  lockedAt?: string;
  message: string;
};

export type ProviderPaymentMethodStatus =
  | 'pending'
  | 'active'
  | 'inactive'
  | 'failed'
  | 'removed';

export type ProviderPaymentMethodSummary = {
  id: string;
  processor: string;
  status: ProviderPaymentMethodStatus;
  brand?: string;
  last4?: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
  isSupabaseBacked: boolean;
};

export type ProviderPaymentMethodReadiness = {
  methods: ProviderPaymentMethodSummary[];
  defaultMethod?: ProviderPaymentMethodSummary;
  hasActiveMethod: boolean;
  isSupabaseBacked: boolean;
  message?: string;
};

export type WorkerEarningStatus =
  | 'pending'
  | 'approved'
  | 'held'
  | 'queued'
  | 'paid'
  | 'failed'
  | 'cancelled';

export type WorkerPayoutStatus =
  | 'created'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled';

export type WorkerEarningRow = {
  id: string;
  status: WorkerEarningStatus;
  grossEarningsCents: number;
  adjustmentsCents: number;
  netEarningsCents: number;
  currency: string;
  approvedAt?: string;
  availableForPayoutAt?: string;
  createdAt?: string;
  shiftId?: string;
  bookingId?: string;
  timesheetId?: string;
  providerName?: string;
  shiftRole?: string;
};

export type WorkerPayoutRow = {
  id: string;
  status: WorkerPayoutStatus;
  amountCents: number;
  currency: string;
  paidAt?: string;
  createdAt?: string;
  lineCount?: number;
};

export type WorkerPayTotals = {
  pendingCents: number;
  approvedCents: number;
  queuedCents: number;
  paidCents: number;
  heldCents: number;
};

/** Earnings grouped by ledger status for Worker Pay sections. */
export type WorkerPayEarningsGroups = {
  approved: WorkerEarningRow[];
  queued: WorkerEarningRow[];
  held: WorkerEarningRow[];
  paid: WorkerEarningRow[];
  pending: WorkerEarningRow[];
  failed: WorkerEarningRow[];
  cancelled: WorkerEarningRow[];
};

/** Payout batches grouped by status — `created` displays as Prepared in UI. */
export type WorkerPayPayoutGroups = {
  prepared: WorkerPayoutRow[];
  processing: WorkerPayoutRow[];
  paid: WorkerPayoutRow[];
  failed: WorkerPayoutRow[];
  cancelled: WorkerPayoutRow[];
};

/** Ledger status on `worker_payout_methods` (`0023`). */
export type WorkerPayoutMethodStatus =
  | 'pending'
  | 'active'
  | 'failed'
  | 'inactive'
  | 'removed';

/** Worker Pay payout-method readiness (UI state, not processor execution). */
export type WorkerPayoutMethodReadinessUiStatus =
  | 'setup_not_connected'
  | 'no_method'
  | 'pending'
  | 'active'
  | 'failed'
  | 'inactive'
  | 'unknown';

export type WorkerPayoutMethodReadiness = {
  status: WorkerPayoutMethodReadinessUiStatus;
  methodStatus?: WorkerPayoutMethodStatus;
  processor?: string;
  message: string;
  actionLabel?: string;
  actionDisabled: boolean;
  isSetupConnected: boolean;
  hasActiveMethod: boolean;
};

export type WorkerPayReadiness = {
  earnings: WorkerEarningRow[];
  payouts: WorkerPayoutRow[];
  earningsByStatus: WorkerPayEarningsGroups;
  payoutsByStatus: WorkerPayPayoutGroups;
  totals: WorkerPayTotals;
  payoutMethodReadiness: WorkerPayoutMethodReadiness;
  isSupabaseBacked: boolean;
  message?: string;
};

/** Admin queue row for approved timesheet earning generation. */
export type AdminEarningGenerationRow = {
  timesheetId: string;
  bookingId?: string;
  workerName?: string;
  providerName?: string;
  siteName?: string;
  shiftStartsAt?: string;
  timesheetStatus: string;
  workerPayDisplay?: string;
  hasWorkerRateSnapshot: boolean;
  earningId?: string;
  earningStatus?: WorkerEarningStatus;
  canGenerate: boolean;
  blockerReason?: string;
};

export type AdminEarningGenerationQueue = {
  rows: AdminEarningGenerationRow[];
  summary: {
    approvedTimesheets: number;
    readyToGenerate: number;
    alreadyGenerated: number;
    missingRateSnapshot: number;
  };
  isSupabaseBacked: boolean;
  message?: string;
};

/** Result from generate_worker_earning_from_timesheet RPC (admin-only; wired to `/admin/payments`). */
export type WorkerEarningGenerationResult = {
  earningId: string;
  timesheetId: string;
  bookingId?: string;
  shiftId?: string;
  workerId?: string;
  status: string;
  grossEarningsCents?: number;
  adjustmentsCents?: number;
  netEarningsCents: number;
  currency: string;
  approvedMinutes?: number;
  workerRateCentsSnapshot?: number;
  idempotent?: boolean;
  message: string;
};

/** Worker group eligible for payout batching (admin queue). */
export type AdminPayoutBatchGroup = {
  workerId: string;
  workerName?: string;
  earningCount: number;
  amountCents: number;
  currency: string;
  earningIds: string[];
};

export type AdminPayoutBatchQueue = {
  groupedByWorker: AdminPayoutBatchGroup[];
  summary: {
    readyEarnings: number;
    workerCount: number;
    totalEligibleCents: number;
    createdPayouts: number;
    queuedEarnings: number;
  };
  isSupabaseBacked: boolean;
  message?: string;
};

/** Result from create_worker_payout_batch RPC (admin-only; wired to `/admin/payments`). */
export type WorkerPayoutBatchResult = {
  ok: boolean;
  payoutCount: number;
  earningCount: number;
  workerCount: number;
  totalAmountCents: number;
  payoutIds: string[];
  message: string;
};

/** Provider timesheets prep — booking-based readiness until timesheet rows are wired. */
export type ProviderTimesheetReadinessStatus =
  | 'pending_booking'
  | 'pending_clock_events'
  | 'pending_timesheet'
  | 'pending_approval'
  | 'simulated';

/** Booking-backed timesheet readiness row (Supabase prep). */
export type ProviderTimesheetBookingReadinessRow = {
  bookingId: string;
  shiftId: string;
  workerId: string;
  workerName: string;
  shiftTitle: string;
  siteName: string;
  shiftDate: string;
  status: ProviderTimesheetReadinessStatus;
  statusLabel: string;
  hours?: number;
  missingItems: string[];
  isSimulated: boolean;
};

export type ProviderTimesheetReadinessRow = {
  id: string;
  shiftId: string;
  bookingId?: string;
  workerId?: string;
  shiftTitle: string;
  siteName: string;
  shiftDate: string;
  workerName?: string;
  hours?: number;
  status: ProviderTimesheetReadinessStatus;
  statusLabel: string;
  isSimulated: boolean;
  missingItems?: string[];
};

export type ProviderTimesheetReviewRow = {
  timesheetId: string;
  bookingId: string;
  shiftId: string;
  workerId: string;
  workerName: string;
  shiftTitle: string;
  siteName: string;
  shiftDate: string;
  hours: number;
  status: string;
  submittedAt?: string;
  approvedAt?: string;
  isSupabaseBacked: boolean;
};

export type ProviderTimesheetReadinessSummary = {
  pendingCount: number;
  readyToApproveCount: number;
  simulatedCount: number;
  rows: ProviderTimesheetReadinessRow[];
  submittedRows: ProviderTimesheetReviewRow[];
  approvedRows: ProviderTimesheetReviewRow[];
  disputedRows: ProviderTimesheetReviewRow[];
};

/** Provider settings — org/account context in Supabase mode; sensitive controls staged. */
export type ProviderSettingsSummary = {
  organizationName?: string;
  organizationType?: string;
  organizationStatus?: string;
  memberRole?: string;
  accountEmail?: string;
  accountName?: string;
  setupStatus: 'complete' | 'incomplete' | 'unknown';
  isSupabaseBacked: boolean;
};

export type ProviderSettingsActionResult = {
  status: string;
  message: string;
  updatedAt: string;
};

export type ProviderOrganizationSettingsUpdatePayload = {
  organizationName?: string;
  organizationType?: string;
};

/** Admin read-only marketplace dashboard (Supabase). */
export type AdminMarketplaceSummary = {
  providerCount: number;
  workerCount: number;
  openShiftCount: number;
  bookedShiftCount: number;
  bookingCount: number;
  submittedTimesheetCount: number;
  approvedTimesheetCount: number;
  invoiceDraftCount: number;
  compliancePacketCount: number;
  supportTicketCount: number;
  credentialReviewCount: number;
};

export type AdminMarketplaceActivityRow = {
  id: string;
  type: string;
  label: string;
  status: string;
  createdAt?: string;
  href?: string;
};

export type AdminMarketplaceDashboardPayload = {
  summary: AdminMarketplaceSummary;
  activity: AdminMarketplaceActivityRow[];
  isSupabaseBacked: boolean;
};

export type AdminCredentialReviewStatus =
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'expired'
  | 'expiring_soon'
  | 'missing';

export type AdminCredentialReviewRow = {
  id: string;
  workerId: string;
  workerName: string;
  workerEmail?: string;
  credentialId: string;
  credentialName: string;
  status: AdminCredentialReviewStatus;
  expiresAt?: string;
  submittedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  workerHeadline?: string;
  workerLocation?: string;
  isSupabaseBacked: boolean;
};

export type AdminCredentialReviewPayload = {
  rows: AdminCredentialReviewRow[];
  pendingCount: number;
  verifiedCount: number;
  rejectedCount: number;
  expiredCount: number;
  isSupabaseBacked: boolean;
};

export type AdminCredentialReviewActionResult = {
  credentialId: string;
  status: string;
  message: string;
  updatedAt?: string;
};

export type AdminSupportTicketStatus = 'open' | 'assigned' | 'resolved' | 'closed';

export type AdminSupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export type AdminSupportTicketRow = {
  id: string;
  requesterUserId: string;
  requesterType: 'worker' | 'provider' | 'admin';
  requesterLabel: string;
  ticketType?: string;
  subject?: string;
  description?: string;
  priority: AdminSupportTicketPriority;
  status: AdminSupportTicketStatus;
  relatedShiftId?: string;
  relatedLine?: string;
  createdAt: string;
  updatedAt: string;
  isSupabaseBacked: boolean;
};

export type AdminSupportTicketPayload = {
  rows: AdminSupportTicketRow[];
  openCount: number;
  assignedCount: number;
  resolvedCount: number;
  closedCount: number;
  urgentCount: number;
  isSupabaseBacked: boolean;
};

export type AdminSupportTicketActionResult = {
  ticketId: string;
  status: string;
  message: string;
  updatedAt?: string;
};

export type AdminIncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AdminIncidentStatus =
  | 'open'
  | 'under_review'
  | 'awaiting_statement'
  | 'resolved'
  | 'escalated';

export type AdminIncidentRow = {
  id: string;
  source: 'incident' | 'safety_report';
  title: string;
  summary?: string;
  severity: AdminIncidentSeverity;
  status: AdminIncidentStatus;
  incidentType?: string;
  workerId?: string;
  providerId?: string;
  siteId?: string;
  shiftId?: string;
  createdAt?: string;
  updatedAt?: string;
  isSupabaseBacked: boolean;
  /** Display-only when joins succeed */
  workerLabel?: string;
  providerLabel?: string;
  shiftLabel?: string;
};

export type AdminIncidentQueuePayload = {
  rows: AdminIncidentRow[];
  openCount: number;
  criticalCount: number;
  escalatedCount: number;
  isSupabaseBacked: boolean;
};

/** Admin worker/bill rate review queue (read-only; Supabase). */
export type AdminWorkerRateReviewStatus =
  | 'missing_worker_rate'
  | 'missing_bill_rate'
  | 'rate_ready'
  | 'locked';

export type AdminWorkerRateReviewRow = {
  id: string;
  shiftId: string;
  providerId?: string;
  providerName?: string;
  siteName?: string;
  role: string;
  status: AdminWorkerRateReviewStatus;
  startsAt?: string;
  billRateCents?: number;
  workerRateCents?: number;
  currency: string;
  rateType: string;
  shiftStatus?: string;
  isUrgent?: boolean;
  createdAt?: string;
  ratesLockedAt?: string;
  ratesUpdatedAt?: string;
  isSupabaseBacked: boolean;
};

export type AdminWorkerRateReviewQueue = {
  rows: AdminWorkerRateReviewRow[];
  summary: {
    missingWorkerRate: number;
    missingBillRate: number;
    ready: number;
    locked: number;
  };
  isSupabaseBacked: boolean;
  message?: string;
};

/** Result from audited admin rate RPCs (Supabase). */
export type AdminRateActionResult = {
  shiftId: string;
  billRateCents?: number;
  workerRateCents?: number;
  ratesLockedAt?: string;
  ratesUpdatedAt?: string;
  message: string;
};

export type AdminSetWorkerRatePayload = {
  shiftId: string;
  workerRateCents: number;
  reason: string;
};

export type AdminUpdateBillRatePayload = {
  shiftId: string;
  billRateCents: number;
  reason: string;
};

export type AdminRateLockPayload = {
  shiftId: string;
  reason: string;
};
