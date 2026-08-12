/** Job / shift role (care workforce) — distinct from auth account role. */
export type Role = 'DSP' | 'CNA' | 'Medication Aide' | 'LPN' | 'RN' | 'Caregiver';

export type RiskLevel = 'Low' | 'Medium' | 'High';

export type ShiftLifecycleStatus =
  | 'Open'
  | 'Requested'
  | 'Booked'
  | 'Clocked In'
  | 'Pending Approval'
  | 'Approved'
  | 'Invoiced';

export interface Worker {
  id: string;
  name: string;
  primaryRole: Role;
  email?: string;
  /** Display score 0–100 */
  covreScore: number;
  completedShifts: number;
  onTimeRatePct: number;
  repeatRequests: number;
  preferredByFacilities: number;
  /** For marketplace availability rows */
  availabilityNote?: string;
  openShiftsWilling?: number;
}

export interface ProviderOrganization {
  id: string;
  name: string;
}

export type SiteOperationalStatus = 'active' | 'needs_review';

export interface CareSite {
  id: string;
  name: string;
  facilityType: string;
  providerOrgId: string;
  address: string;
  residents: number;
  preferredWorkerSlots: number;
  operationalStatus: SiteOperationalStatus;
}

/** Extended site content for provider Site Detail. */
export interface SiteOperationalDetail {
  overview: string;
  contacts: { role: string; name: string; phone: string }[];
  orientation: string[];
  credentialRequirements: string[];
  houseRules: string[];
  emergency: string[];
  preferredBenchWorkerIds: string[];
}

export type WorkerFeedCardStatus = 'ready' | 'preferred';

export interface Shift {
  id: string;
  roleTitle: string;
  workRole: Role;
  siteId: string;
  /** Denormalized for tables/cards */
  siteName: string;
  providerOrgId: string;
  providerName: string;
  dateLabel: string;
  timeRange: string;
  /** Demo / mock pay label (e.g. "$28/hr") */
  hourlyPayDisplay: string;
  /** Supabase worker pay from worker_rate_cents or booking snapshot */
  workerRateCents?: number;
  currency?: string;
  rateType?: string;
  workerPayDisplay?: string;
  /** Booked shift — frozen at accept time */
  workerRateCentsSnapshot?: number;
  currencySnapshot?: string;
  rateTypeSnapshot?: string;
  estimatedTotalDisplay: string;
  distanceMiles: string;
  credentialTags: string[];
  workerFeedCardStatus: WorkerFeedCardStatus;
  /** Provider shift board: covered | urgent | pending */
  providerBoardStatus: 'covered' | 'urgent' | 'pending';
  assignedWorkerId: string | null;
  lifecycleStatus: ShiftLifecycleStatus;
  /** Worker marketplace list */
  showOnWorkerFeed: boolean;
  /** Mock map / discovery: WGS84 (optional for feed rows) */
  latitude?: number;
  longitude?: number;
  /** Numeric miles for sorting and pay vs. travel tradeoffs (display string remains distanceMiles) */
  distanceNumericMiles?: number;
  isUrgent?: boolean;
  isPreferred?: boolean;
  isReadyMatch?: boolean;
  /** Detail page copy */
  facilitySettingLabel: string;
  streetAddress: string;
  duties: string[];
  requiredCredentialsDisplayed: string[];
  soloShiftNote?: string;
  medicationNote?: string;
  parkingNote?: string;
  cancellationNote?: string;
  /** Active shift screen: supervisor */
  sitePhone?: string;
  supervisorName?: string;
  /** Supabase open-shift discovery: credential readiness */
  workerShiftReadiness?: {
    isReady: boolean;
    missingCredentialNames: string[];
    matchedCredentialNames: string[];
    statusLabel: string;
  };
  /** True when row comes from Supabase discovery (not mock catalog) */
  isSupabaseDiscovery?: boolean;
}

export interface Credential {
  id: string;
  name: string;
  category: string;
}

export type IncidentSeverity = 'High' | 'Medium' | 'Low';

export type IncidentWorkflowStatus = 'under-review' | 'pending' | 'resolved';

export interface Incident {
  id: string;
  type: string;
  severity: IncidentSeverity;
  workerName: string;
  providerName: string;
  siteName: string;
  shiftSummary: string;
  status: IncidentWorkflowStatus;
  submittedRelative: string;
}

export interface IncidentDetail extends Incident {
  reportedAt: string;
  workerStatement: string;
  providerResponse: string;
  internalNotes: string;
}

export type SupportPriority = 'urgent' | 'normal';

export type SupportTicketStatus = 'open' | 'pending' | 'resolved';

export interface SupportTicket {
  id: string;
  requesterId: string;
  requesterLabel: string;
  type: string;
  priority: SupportPriority;
  relatedLine: string;
  status: SupportTicketStatus;
  lastUpdate: string;
  tags: ('worker' | 'provider' | 'pay' | 'safety' | 'compliance')[];
}

export type CompliancePacketState = 'ready' | 'review' | 'signature';

export interface CompliancePacket {
  id: string;
  shiftRoleTitle: string;
  siteId: string;
  siteName: string;
  workerId: string;
  shiftWhen: string;
  credentialsAtShift: string;
  clockSummary: string;
  approvalLine: string;
  incidentNotes: string;
  packetStatus: CompliancePacketState;
}

export type PaymentRowStatus = 'pending' | 'failed' | 'open' | 'paid' | 'hold';

export interface PaymentRecord {
  id: string;
  kind: 'worker_payout' | 'provider_invoice' | 'hold';
  partyLabel: string;
  amount: string;
  status: PaymentRowStatus;
  dateLabel: string;
  method: string;
  subjectLine?: string;
}

export interface Metric {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'bad' | 'warn';
}

/** Admin-only operational overlay for shift detail / at-risk rows */
export interface AdminShiftOperations {
  displayShiftCode: string;
  paymentStatus: 'released' | 'hold' | 'pending';
  invoiceStatus: 'open' | 'paid';
  credentialEligibility: string;
  riskScoreLabel: string;
  timeline: string[];
  messagesPlaceholder: string;
  adminNotes: string;
}
