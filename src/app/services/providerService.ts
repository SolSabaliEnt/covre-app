/**
 * Provider-facing data access.
 * TODO: replace mockRequest with real HTTP client + DTO mapping.
 */
import type { ApiResult } from '../api/types';
import { mockRequest } from '../api/mockApi';
import { getBackendMode } from '../lib/backendMode';
import {
  completeProviderOnboardingInSupabase,
  getProviderOnboardingStatusFromSupabase,
  saveProviderOnboardingDraftToSupabase,
} from '../repositories/providerOnboardingRepository';
import { getCurrentProviderOrganizationFromSupabase } from '../repositories/providerOrganizationRepository';
import {
  createProviderSiteInSupabase,
  getProviderSiteFromSupabase,
  listProviderSitesFromSupabase,
} from '../repositories/providerSitesRepository';
import {
  generateProviderCompliancePacketFromApprovedTimesheetInSupabase,
  listProviderCompliancePacketsFromSupabase,
} from '../repositories/providerComplianceRepository';
import { getProviderBillingReadinessFromSupabase } from '../repositories/providerBillingRepository';
import {
  generateProviderInvoiceFromApprovedTimesheetsInSupabase,
  listProviderInvoicesFromSupabase,
} from '../repositories/providerInvoicesRepository';
import {
  getProviderSettingsSummaryFromSupabase,
  updateProviderBillingSettingsInSupabase,
  updateProviderNotificationSettingsInSupabase,
  updateProviderOrganizationSettingsInSupabase,
} from '../repositories/providerSettingsRepository';
import {
  listProviderSupportTopicsFromSupabase,
  submitProviderSupportRequestToSupabase,
} from '../repositories/providerSupportRepository';
import {
  approveProviderTimesheetInSupabase,
  disputeProviderTimesheetInSupabase,
  getProviderTimesheetReadinessFromSupabase,
} from '../repositories/providerTimesheetsRepository';
import {
  disableProviderMemberInSupabase,
  inviteProviderMemberInSupabase,
  listProviderTeamMembersFromSupabase,
  resendProviderInviteInSupabase,
  updateProviderMemberRoleInSupabase,
} from '../repositories/providerTeamRepository';
import {
  createProviderShiftInSupabase,
  getProviderShiftFromSupabase,
  listProviderShiftsFromSupabase,
} from '../repositories/providerShiftsRepository';
import { listProviderShiftApplicantsFromSupabase } from '../repositories/providerApplicantsRepository';
import { acceptProviderShiftApplicantInSupabase } from '../repositories/providerBookingRepository';
import { listProviderBenchFromSupabase } from '../repositories/providerBenchRepository';
import { listProviderPaymentMethodsFromSupabase } from '../repositories/providerPaymentMethodsRepository';
import type {
  CareSite,
  CompliancePacket,
  Role,
  Shift,
  SiteOperationalDetail,
} from '../data/types';
import {
  compliancePackets,
  getProviderSites,
  getShiftById,
  getShiftsByWorker,
  getSiteById,
  getWorkerById as selectWorker,
  providerOrganizations,
  shifts,
  siteOperationalDetails,
} from '../data/selectors';
import { credentials as credentialCatalog } from '../data/mockData';
import type {
  ProviderInvitePayload,
  ProviderInviteResult,
  ProviderMemberActionResult,
  ProviderMemberRole,
  ProviderOnboardingDraft,
  ProviderOnboardingResult,
  ProviderOnboardingStatusPayload,
  ProviderOnboardingStep,
  ProviderOrganizationSummary,
  ProviderShiftCreatePayload,
  ProviderShiftCreateResult,
  ProviderShiftApplicantsResult,
  ProviderSiteCreatePayload,
  ProviderSiteCreateResult,
  ProviderSitePage,
  ProviderBenchPayload,
  ProviderWorkerMatchCandidate,
  ProviderWorkerMatchPage,
  ProviderSupportRequestPayload,
  ProviderSupportTopicOption,
  ProviderTeamMember,
  ProviderActionResult,
  ProviderBillingSummary,
  ProviderInvoiceGenerationResult,
  ProviderInvoiceRow,
  ProviderPaymentMethodReadiness,
  ProviderTimesheetReadinessSummary,
  ProviderSettingsSummary,
  ProviderSettingsActionResult,
  ProviderOrganizationSettingsUpdatePayload,
  ProviderBookingPrepResult,
  ProviderCompliancePacketGenerationResult,
  ProviderCompliancePacketRow,
  ProviderWorkerCredential,
  ProviderWorkerProfile,
  ProviderWorkerRecentShift,
  ProviderWorkerSiteFamiliarity,
  TimesheetActionResult,
} from './types';

const DEFAULT_PROVIDER_ORG_ID = 'prov-001';

const COVERAGE_SHIFT_IDS = ['shift-002', 'shift-005', 'shift-003'] as const;

function nowIso(): string {
  return new Date().toISOString();
}

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3);
}

function credentialsForRole(primaryRole: string): ProviderWorkerCredential[] {
  const byCategory = (names: string[]) =>
    credentialCatalog
      .filter(c => names.includes(c.name))
      .map(c => ({ id: c.id, name: c.name, category: c.category, verified: true }));
  switch (primaryRole) {
    case 'DSP':
      return byCategory(['DSP Certification', 'CPR & First Aid']);
    case 'CNA':
      return byCategory(['Oregon CNA', 'CPR & First Aid']);
    case 'Medication Aide':
      return byCategory(['Medication Aide (OR)', 'Oregon CNA']);
    case 'LPN':
    case 'RN':
      return byCategory(['LPN License', 'CPR & First Aid']);
    default:
      return byCategory(['CPR & First Aid']);
  }
}

function isOnAnyPreferredBench(workerId: string): boolean {
  return Object.values(siteOperationalDetails).some(detail =>
    detail.preferredBenchWorkerIds.includes(workerId),
  );
}

function providerNotesForWorker(workerId: string, name: string): string {
  const lines: Record<string, string> = {
    'worker-001':
      'Strong overnight handoffs; families request Maya by name. Keep on Evergreen overnight bench.',
    'worker-002':
      'Reliable DSP; prefers group-home settings. Coordinate parking code updates before first shift.',
    'worker-003':
      'Top CNA for memory-care pods. Excellent documentation; use for high-acuity days.',
    'worker-004':
      'Med pass competency current. Pair with nursing for narcotics until site orientation is complete.',
    'worker-005':
      'Good for fill-in coverage; confirm availability 24h ahead for best response.',
  };
  return lines[workerId] ?? `${name} is approved for Evergreen network sites. Add site-specific notes here.`;
}

// TODO(api): GET /provider/workers/:id/profile
export async function getProviderWorkerProfile(
  workerId: string,
): Promise<ApiResult<ProviderWorkerProfile | null>> {
  return mockRequest(() => {
    const w = selectWorker(workerId);
    if (!w) return null;

    const assigned = getShiftsByWorker(workerId);
    const recent: ProviderWorkerRecentShift[] = [...assigned]
      .reverse()
      .slice(0, 5)
      .map(s => ({
        shiftId: s.id,
        siteName: s.siteName,
        roleTitle: s.roleTitle,
        dateLabel: s.dateLabel,
        timeRange: s.timeRange,
      }));

    const siteCounts = new Map<string, { siteName: string; count: number }>();
    for (const s of assigned) {
      const cur = siteCounts.get(s.siteId);
      if (cur) cur.count += 1;
      else siteCounts.set(s.siteId, { siteName: s.siteName, count: 1 });
    }
    const siteFamiliarity: ProviderWorkerSiteFamiliarity[] = [...siteCounts.entries()].map(
      ([siteId, { siteName, count }]) => ({
        siteId,
        siteName,
        shiftCount: count,
      }),
    );
    siteFamiliarity.sort((a, b) => b.shiftCount - a.shiftCount);

    const primarySiteName = assigned[0]?.siteName;
    const location = primarySiteName ? `Portland metro · frequent at ${primarySiteName}` : 'Portland metro';

    const isPreferredBench = w.preferredByFacilities >= 12 || isOnAnyPreferredBench(workerId);

    const profile: ProviderWorkerProfile = {
      id: w.id,
      name: w.name,
      roles: [w.primaryRole],
      location,
      initials: initialsFromName(w.name),
      covreScore: w.covreScore,
      isVerified: w.covreScore >= 90,
      isPreferredBench,
      credentials: credentialsForRole(w.primaryRole),
      reliability: {
        completedShifts: w.completedShifts,
        onTimeRatePct: w.onTimeRatePct,
        repeatRequests: w.repeatRequests,
      },
      siteFamiliarity,
      recentShifts: recent,
      providerNotes: providerNotesForWorker(workerId, w.name),
    };

    return profile;
  });
}

function supabaseSimulatedBookingPrep(
  workerId: string,
  shiftId: string,
  message: string,
): ProviderBookingPrepResult {
  return {
    shiftId,
    workerId,
    status: 'simulated',
    message,
    createdAt: nowIso(),
    source: 'supabase_shift_mock_worker',
  };
}

// TODO(api): POST /provider/shifts/:shiftId/book
export async function bookWorkerForShift(
  workerId: string,
  shiftId: string,
): Promise<ApiResult<ProviderBookingPrepResult>> {
  const trimmedWorkerId = workerId?.trim();
  const trimmedShiftId = shiftId?.trim();
  if (!trimmedWorkerId || !trimmedShiftId) {
    return {
      ok: false,
      error: { code: 'validation', message: 'Worker and shift are required to book.' },
    };
  }

  if (getBackendMode() === 'supabase') {
    return {
      ok: true,
      data: supabaseSimulatedBookingPrep(
        trimmedWorkerId,
        trimmedShiftId,
        'Booking simulated. Worker booking will be connected after worker profiles and bookings are wired.',
      ),
    };
  }

  return mockRequest(() => ({
    shiftId: trimmedShiftId,
    workerId: trimmedWorkerId,
    status: 'simulated' as const,
    message: 'Worker booked for shift',
    createdAt: nowIso(),
    source: 'mock' as const,
  }));
}

// TODO(api): POST /provider/workers/:workerId/invite
export async function inviteWorkerToShift(
  workerId: string,
  shiftId?: string,
): Promise<ApiResult<ProviderBookingPrepResult>> {
  const trimmedWorkerId = workerId?.trim();
  if (!trimmedWorkerId) {
    return { ok: false, error: { code: 'validation', message: 'Worker is required to invite.' } };
  }
  const trimmedShiftId = shiftId?.trim() ?? trimmedWorkerId;

  if (getBackendMode() === 'supabase') {
    return {
      ok: true,
      data: supabaseSimulatedBookingPrep(
        trimmedWorkerId,
        trimmedShiftId,
        'Invite simulated. Worker messaging will be connected in a later Supabase pass.',
      ),
    };
  }

  return mockRequest(() => ({
    shiftId: trimmedShiftId,
    workerId: trimmedWorkerId,
    status: 'simulated' as const,
    message: 'Worker invited to shift',
    createdAt: nowIso(),
    source: 'mock' as const,
  }));
}

const MOCK_PROVIDER_BENCH_PAYLOAD: ProviderBenchPayload = {
  isSupabaseBacked: false,
  sections: [
    {
      title: 'Preferred Workers',
      workers: [
        {
          id: 'worker-003',
          name: 'Sarah Johnson',
          roleLabel: 'CNA',
          score: 96,
          shifts: 24,
          isSupabaseBacked: false,
        },
        {
          id: 'worker-002',
          name: 'Mike Chen',
          roleLabel: 'DSP',
          score: 94,
          shifts: 18,
          isSupabaseBacked: false,
        },
        {
          id: 'worker-004',
          name: 'Jessica Martinez',
          roleLabel: 'Med Aide',
          score: 92,
          shifts: 15,
          isSupabaseBacked: false,
        },
      ],
    },
    {
      title: 'Approved for Med Pass',
      workers: [
        {
          id: 'worker-004',
          name: 'Jessica Martinez',
          roleLabel: 'Med Aide',
          score: 92,
          shifts: 15,
          isSupabaseBacked: false,
        },
        {
          id: 'worker-005',
          name: 'Alex Thompson',
          roleLabel: 'CNA',
          score: 88,
          shifts: 12,
          isSupabaseBacked: false,
        },
      ],
    },
    {
      title: 'Approved for Overnight',
      workers: [
        {
          id: 'worker-002',
          name: 'Mike Chen',
          roleLabel: 'DSP',
          score: 94,
          shifts: 18,
          isSupabaseBacked: false,
        },
        {
          id: 'worker-001',
          name: 'Maya Johnson',
          roleLabel: 'DSP',
          score: 94,
          shifts: 22,
          isSupabaseBacked: false,
        },
      ],
    },
  ],
};

// TODO(api): GET /provider/bench
export async function getProviderBench(): Promise<ApiResult<ProviderBenchPayload>> {
  if (getBackendMode() === 'supabase') {
    return listProviderBenchFromSupabase();
  }
  return mockRequest(() => MOCK_PROVIDER_BENCH_PAYLOAD);
}

// TODO(api): POST /provider/bench
export async function addWorkerToBench(
  workerId: string,
): Promise<ApiResult<ProviderBookingPrepResult>> {
  const trimmedWorkerId = workerId?.trim();
  if (!trimmedWorkerId) {
    return { ok: false, error: { code: 'validation', message: 'Worker is required.' } };
  }

  if (getBackendMode() === 'supabase') {
    return {
      ok: true,
      data: supabaseSimulatedBookingPrep(
        trimmedWorkerId,
        trimmedWorkerId,
        'Bench action simulated. Provider bench will be connected in a later Supabase pass.',
      ),
    };
  }

  return mockRequest(() => ({
    shiftId: trimmedWorkerId,
    workerId: trimmedWorkerId,
    status: 'simulated' as const,
    message: 'Worker added to bench',
    createdAt: nowIso(),
    source: 'mock' as const,
  }));
}

// TODO(api): POST /provider/workers/:workerId/do-not-send
export async function markWorkerDoNotSend(workerId: string): Promise<ApiResult<ProviderActionResult>> {
  return mockRequest(() => ({
    id: workerId,
    status: 'do_not_send' as const,
    message: 'Worker marked as do not send',
    updatedAt: nowIso(),
  }));
}

// TODO(api): POST /provider/timesheets/:id/approve
export async function approveTimesheet(timesheetId: string): Promise<ApiResult<TimesheetActionResult>> {
  if (getBackendMode() === 'supabase') {
    const res = await approveProviderTimesheetInSupabase(timesheetId);
    if (!res.ok) return res;
    if (res.data.status === 'unsupported') {
      return {
        ok: false,
        error: { code: 'timesheet_approval_unsupported', message: res.data.message },
      };
    }
    return {
      ok: true,
      data: {
        id: res.data.timesheetId,
        status: 'approved',
        message: res.data.message,
        updatedAt: res.data.updatedAt,
      },
    };
  }
  return mockRequest(() => ({
    id: timesheetId,
    status: 'approved' as const,
    message: 'Timesheet approved',
    updatedAt: nowIso(),
  }));
}

// TODO(api): POST /provider/timesheets/:id/dispute
export async function disputeTimesheet(
  timesheetId: string,
  reason?: string,
): Promise<ApiResult<TimesheetActionResult>> {
  if (getBackendMode() === 'supabase') {
    const res = await disputeProviderTimesheetInSupabase(timesheetId, reason);
    if (!res.ok) return res;
    if (res.data.status === 'unsupported') {
      return {
        ok: false,
        error: { code: 'timesheet_dispute_unsupported', message: res.data.message },
      };
    }
    return {
      ok: true,
      data: {
        id: res.data.timesheetId,
        status: 'disputed',
        message: res.data.message,
        updatedAt: res.data.updatedAt,
      },
    };
  }
  return mockRequest(() => ({
    id: timesheetId,
    status: 'disputed' as const,
    message: reason ? `Timesheet disputed: ${reason}` : 'Timesheet disputed',
    updatedAt: nowIso(),
  }));
}

export type CompliancePacketRow = CompliancePacket & {
  workerName: string;
  isSimulated?: boolean;
  statusLabel?: string;
  missingItems?: string[];
  timesheetId?: string;
  packetId?: string;
  canGenerateSnapshot?: boolean;
  hasGeneratedSnapshot?: boolean;
  filePending?: boolean;
};

function mapProviderCompliancePacketRow(row: ProviderCompliancePacketRow): CompliancePacketRow {
  const missing = row.missingItems ?? [];
  const missingSummary =
    missing.length > 0 ? `Waiting on: ${missing.slice(0, 2).join(', ')}${missing.length > 2 ? '…' : ''}` : '—';
  const workerLabel = row.shiftTitle.includes(' · ')
    ? row.shiftTitle.split(' · ')[0]?.trim() || 'Booked worker'
    : 'Booked worker';

  return {
    id: row.id,
    shiftRoleTitle: row.shiftTitle,
    siteId: row.siteId,
    siteName: row.siteName,
    workerId: 'pending',
    shiftWhen: row.shiftDate,
    credentialsAtShift:
      row.status === 'packet_generated'
        ? 'Credential snapshot pending'
        : row.status === 'ready_for_packet'
          ? 'Not snapshotted yet'
          : 'Unavailable until worker is booked',
    clockSummary:
      row.status === 'packet_generated' || row.status === 'ready_for_packet'
        ? 'Approved timesheet on file'
        : 'Unavailable until timesheet approval',
    approvalLine: row.isSimulated
      ? `${row.statusLabel} · ${missingSummary}`
      : row.status === 'packet_generated'
        ? `Snapshot generated${row.generatedAt ? ` · ${new Date(row.generatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}`
        : row.status === 'ready_for_packet'
          ? 'Timesheet approved'
          : row.status === 'pending_timesheet'
            ? 'Pending timesheet approval'
            : 'Pending worker booking',
    incidentNotes: 'Recorded after shift completion',
    packetStatus:
      row.status === 'packet_generated'
        ? 'ready'
        : row.status === 'ready' || row.status === 'ready_for_packet'
          ? 'ready'
          : 'review',
    workerName: row.isSimulated ? 'Not assigned' : workerLabel,
    isSimulated: row.isSimulated,
    statusLabel: row.statusLabel,
    missingItems: missing,
    timesheetId: row.timesheetId,
    packetId: row.packetId,
    canGenerateSnapshot: row.status === 'ready_for_packet' && Boolean(row.timesheetId),
    hasGeneratedSnapshot: row.status === 'packet_generated',
    filePending: row.status === 'packet_generated' && !row.hasFile,
  };
}

export type ProviderShiftRow = Shift & { assignedWorkerName: string | null };

// TODO(api): GET /provider/dashboard
export async function getProviderDashboard() {
  return mockRequest(() => {
    const prov = providerOrganizations[0];

    const todaysCoverage = COVERAGE_SHIFT_IDS.map(id => shifts.find(s => s.id === id))
      .filter((s): s is Shift => Boolean(s))
      .map(shift => {
        const w = shift.assignedWorkerId ? selectWorker(shift.assignedWorkerId) : undefined;
        return {
          site: shift.siteName,
          shift: shift.roleTitle,
          worker: w?.name ?? 'TBD',
          time: shift.timeRange,
          status: 'covered' as const,
        };
      });

    const urgentShifts = shifts
      .filter(s => s.providerBoardStatus === 'urgent')
      .slice(0, 2)
      .map(s => ({
        site: s.siteName,
        shift: s.roleTitle,
        time: `${s.dateLabel} · ${s.timeRange}`,
        pay: s.hourlyPayDisplay,
        status: 'urgent' as const,
      }));

    const workersOnShift = [
      { shiftId: 'shift-005', clockedIn: '3:05 PM' },
      { shiftId: 'shift-002', clockedIn: 'Scheduled' },
    ]
      .map(({ shiftId, clockedIn }) => {
        const shift = shifts.find(s => s.id === shiftId);
        const w = shift?.assignedWorkerId ? selectWorker(shift.assignedWorkerId) : undefined;
        return {
          name: w?.name ?? '—',
          site: shift?.siteName ?? '',
          role: (shift?.workRole ?? '') as Role,
          clockedIn,
          status: 'active' as const,
        };
      })
      .filter(row => row.name !== '—');

    const firstUrgentShiftId = shifts.find(s => s.providerBoardStatus === 'urgent')?.id ?? 'shift-001';

    return {
      prov,
      todaysCoverage,
      urgentShifts,
      workersOnShift,
      firstUrgentShiftId,
    };
  });
}

// TODO(api): POST /provider/shifts
export async function createProviderShift(
  payload: ProviderShiftCreatePayload,
): Promise<ApiResult<ProviderShiftCreateResult>> {
  if (getBackendMode() === 'supabase') {
    return createProviderShiftInSupabase(payload);
  }
  return mockRequest(() => ({
    shiftId: 'shift-demo-created',
    status: 'open',
    message: 'Shift posted',
    createdAt: nowIso(),
  }));
}

// TODO(api): GET /provider/shifts
export async function listProviderShifts(): Promise<ApiResult<ProviderShiftRow[]>> {
  if (getBackendMode() === 'supabase') {
    return listProviderShiftsFromSupabase();
  }
  return mockRequest(() =>
    shifts.map(shift => ({
      ...shift,
      assignedWorkerName: shift.assignedWorkerId
        ? selectWorker(shift.assignedWorkerId)?.name ?? null
        : null,
    })),
  );
}

// TODO(api): GET /provider/shifts/:id
export async function getProviderShift(id: string): Promise<ApiResult<Shift | undefined>> {
  if (getBackendMode() === 'supabase') {
    const result = await getProviderShiftFromSupabase(id);
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: result.data ?? undefined };
  }
  return mockRequest(() => getShiftById(id));
}

export async function listProviderShiftApplicants(
  shiftId: string,
): Promise<ApiResult<ProviderShiftApplicantsResult>> {
  if (getBackendMode() === 'supabase') {
    return listProviderShiftApplicantsFromSupabase(shiftId);
  }
  return mockRequest(() => ({
    shiftId,
    applicants: [],
    isReadOnly: true,
  }));
}

export async function acceptProviderShiftApplicant(
  requestId: string,
): Promise<ApiResult<import('./types').ProviderBookingAcceptResult>> {
  if (getBackendMode() === 'supabase') {
    return acceptProviderShiftApplicantInSupabase(requestId);
  }
  return mockRequest(() => ({
    bookingId: `bk-mock-${requestId}`,
    shiftId: 'shift-mock',
    workerId: 'worker-mock',
    requestId,
    status: 'simulated',
    message: 'Worker booked for shift',
    createdAt: nowIso(),
  }));
}

const MOCK_WORKER_MATCH_CANDIDATES: ProviderWorkerMatchCandidate[] = [
  {
    id: 'worker-003',
    name: 'Sarah Johnson',
    role: 'CNA',
    score: 96,
    distance: '2.3 mi',
    onTime: 98,
    credentials: ['CNA License', 'CPR/BLS', 'Med Training'],
    priorShifts: 12,
    status: 'ready',
  },
  {
    id: 'worker-002',
    name: 'Mike Chen',
    role: 'DSP',
    score: 94,
    distance: '3.1 mi',
    onTime: 100,
    credentials: ['DSP Cert', 'Background Check'],
    priorShifts: 8,
    status: 'ready',
  },
  {
    id: 'worker-004',
    name: 'Jessica Martinez',
    role: 'Med Aide',
    score: 92,
    distance: '4.5 mi',
    onTime: 95,
    credentials: ['CNA License', 'Med Cert'],
    priorShifts: 5,
    status: 'preferred',
  },
];

// TODO(api): GET /provider/worker-match/:shiftId
export async function getProviderWorkerMatchPage(
  shiftId: string,
): Promise<ApiResult<ProviderWorkerMatchPage | null>> {
  const trimmed = shiftId?.trim();
  if (!trimmed) {
    return { ok: false, error: { code: 'validation', message: 'Shift ID is required.' } };
  }

  if (getBackendMode() === 'supabase') {
    const shiftResult = await getProviderShift(trimmed);
    if (!shiftResult.ok) {
      return shiftResult;
    }
    if (!shiftResult.data) {
      return { ok: true, data: null };
    }
    return {
      ok: true,
      data: {
        shift: shiftResult.data,
        candidates: MOCK_WORKER_MATCH_CANDIDATES,
        isSimulated: true,
        source: 'supabase_shift_mock_candidates',
      },
    };
  }

  return mockRequest(() => {
    const shift = getShiftById(trimmed) ?? getShiftById('shift-001');
    if (!shift) {
      return null;
    }
    return {
      shift,
      candidates: MOCK_WORKER_MATCH_CANDIDATES,
      isSimulated: true,
      source: 'mock' as const,
    };
  });
}

// TODO(api): GET /provider/sites
export async function listProviderSites(
  providerOrgId: string = DEFAULT_PROVIDER_ORG_ID,
): Promise<ApiResult<CareSite[]>> {
  if (getBackendMode() === 'supabase') {
    return listProviderSitesFromSupabase();
  }
  return mockRequest(() => getProviderSites(providerOrgId));
}

// TODO(api): GET /provider/sites/:id
export async function getProviderSite(id: string): Promise<ApiResult<ProviderSitePage | null>> {
  if (getBackendMode() === 'supabase') {
    return getProviderSiteFromSupabase(id);
  }
  return mockRequest(() => {
    const site = getSiteById(id);
    const operational = siteOperationalDetails[id];
    if (!site || !operational) return null;
    const benchNames = operational.preferredBenchWorkerIds
      .map(wid => selectWorker(wid)?.name)
      .filter((n): n is string => Boolean(n));
    return { site, operational, benchNames };
  });
}

// TODO(api): POST /provider/sites
export async function createProviderSite(
  payload: ProviderSiteCreatePayload,
): Promise<ApiResult<ProviderSiteCreateResult>> {
  if (getBackendMode() === 'supabase') {
    return createProviderSiteInSupabase(payload);
  }
  return mockRequest(() => {
    const siteId = `site-${Date.now()}`;
    const site: CareSite = {
      id: siteId,
      name: payload.siteName.trim(),
      facilityType: payload.siteType?.trim() || 'Care site',
      providerOrgId: DEFAULT_PROVIDER_ORG_ID,
      address: [payload.address, payload.city, payload.state].filter(Boolean).join(', ') || '—',
      residents: Number.parseInt(String(payload.residentCount ?? ''), 10) || 0,
      preferredWorkerSlots: 0,
      operationalStatus: 'needs_review',
    };
    return { siteId, site };
  });
}

export type { ProviderSitePage } from './types';

// TODO(api): GET /provider/compliance/packets
export async function listCompliancePackets(): Promise<ApiResult<CompliancePacketRow[]>> {
  if (getBackendMode() === 'supabase') {
    const res = await listProviderCompliancePacketsFromSupabase();
    if (!res.ok) return res;
    return { ok: true, data: res.data.map(mapProviderCompliancePacketRow) };
  }
  return mockRequest(() =>
    compliancePackets.map(packet => ({
      ...packet,
      workerName: selectWorker(packet.workerId)?.name ?? '—',
    })),
  );
}

// TODO(api): GET /provider/compliance/packets/:id
export async function getCompliancePacket(id: string): Promise<ApiResult<CompliancePacket | undefined>> {
  return mockRequest(() => compliancePackets.find(p => p.id === id));
}

export async function generateProviderCompliancePacketFromApprovedTimesheet(
  timesheetId: string,
): Promise<ApiResult<ProviderCompliancePacketGenerationResult>> {
  if (getBackendMode() === 'supabase') {
    return generateProviderCompliancePacketFromApprovedTimesheetInSupabase(timesheetId);
  }
  return mockRequest(() => ({
    packetId: 'packet-mock',
    bookingId: 'booking-mock',
    timesheetId,
    status: 'ready',
    message: 'Compliance packet download queued (demo mode).',
    generatedAt: nowIso(),
  }));
}

// TODO(api): GET /provider/support/topics — static catalog for now
export async function listProviderSupportOptions(): Promise<ApiResult<ProviderSupportTopicOption[]>> {
  if (getBackendMode() === 'supabase') {
    return listProviderSupportTopicsFromSupabase();
  }
  return mockRequest(() => [
    { id: 'shift', label: 'Shift issue', hint: 'Scheduling or coverage disputes' },
    { id: 'noshow', label: 'Worker no-show', hint: 'Immediate escalation options' },
    { id: 'payment', label: 'Payment question', hint: 'Rates, invoices, and payouts' },
    {
      id: 'credential',
      label: 'Credential / compliance issue',
      hint: 'Med pass, training, or documentation',
    },
    { id: 'safety', label: 'Safety or incident report', hint: 'Workplace safety and serious events' },
  ]);
}

// TODO(api): POST /provider/support/requests
export async function submitProviderSupportRequest(
  payload: ProviderSupportRequestPayload,
): Promise<ApiResult<{ id: string; status: 'queued' }>> {
  if (getBackendMode() === 'supabase') {
    return submitProviderSupportRequestToSupabase(payload);
  }
  return mockRequest(() => ({
    id: `cov-${Date.now()}`,
    status: 'queued' as const,
  }));
}

let mockOnboardingDraft: Partial<ProviderOnboardingDraft> = {};
let mockOnboardingComplete = false;

function mergeDraft(next: Partial<ProviderOnboardingDraft>): Partial<ProviderOnboardingDraft> {
  mockOnboardingDraft = { ...mockOnboardingDraft, ...next };
  return mockOnboardingDraft;
}

function suggestedOnboardingStep(): ProviderOnboardingStep {
  if (mockOnboardingComplete) return 'complete';
  const d = mockOnboardingDraft;
  if (!d.organizationName?.trim()) return 'organization';
  if (!d.siteName?.trim()) return 'site';
  if (!d.rolesNeeded?.length) return 'staffing';
  if (!d.billingEmail?.trim()) return 'billing';
  return 'complete';
}

// TODO(api): GET /provider/organization/current
export async function getCurrentProviderOrganization(): Promise<
  ApiResult<ProviderOrganizationSummary | null>
> {
  if (getBackendMode() === 'supabase') {
    return getCurrentProviderOrganizationFromSupabase();
  }
  return { ok: true, data: null };
}

// TODO(api): GET /provider/onboarding/status
export async function getProviderOnboardingStatus(
  providerId?: string,
): Promise<ApiResult<ProviderOnboardingStatusPayload>> {
  void providerId;
  if (getBackendMode() === 'supabase') {
    return getProviderOnboardingStatusFromSupabase();
  }
  return mockRequest(() => ({
    onboardingComplete: mockOnboardingComplete,
    suggestedStep: suggestedOnboardingStep(),
    lastDraft: { ...mockOnboardingDraft },
  }));
}

// TODO(api): PATCH /provider/onboarding/draft
export async function saveProviderOnboardingDraft(
  draft: Partial<ProviderOnboardingDraft>,
): Promise<ApiResult<{ saved: true }>> {
  if (getBackendMode() === 'supabase') {
    return saveProviderOnboardingDraftToSupabase(draft);
  }
  return mockRequest(() => {
    mergeDraft(draft);
    return { saved: true as const };
  });
}

// TODO(api): POST /provider/onboarding/complete
export async function completeProviderOnboarding(
  draft: ProviderOnboardingDraft,
): Promise<ApiResult<ProviderOnboardingResult>> {
  if (getBackendMode() === 'supabase') {
    return completeProviderOnboardingInSupabase(draft);
  }
  return mockRequest(() => {
    mergeDraft(draft);
    mockOnboardingComplete = true;
    const completedAt = nowIso();
    return {
      providerId: 'provider-001',
      siteId: 'site-001',
      status: 'complete',
      message: 'Provider workspace created',
      completedAt,
    };
  });
}

const INITIAL_PROVIDER_TEAM: ProviderTeamMember[] = [
  {
    id: 'pm-owner-001',
    name: 'Evergreen Residential Care Owner',
    email: 'owner@evergreen.demo',
    role: 'owner',
    status: 'active',
    lastActiveAt: '2025-05-10T14:22:00.000Z',
  },
  {
    id: 'pm-002',
    name: 'Jordan Lee',
    email: 'jordan.lee@evergreen.demo',
    role: 'scheduler',
    status: 'active',
    lastActiveAt: '2025-05-14T09:15:00.000Z',
  },
  {
    id: 'pm-003',
    name: 'Priya Shah',
    email: 'priya.shah@evergreen.demo',
    role: 'billing',
    status: 'active',
    lastActiveAt: '2025-05-13T16:40:00.000Z',
  },
  {
    id: 'pm-004',
    name: 'Taylor Morgan',
    email: 'taylor.morgan@evergreen.demo',
    role: 'viewer',
    status: 'invited',
    invitedAt: '2025-05-14T18:00:00.000Z',
  },
];

let mockProviderTeamMembers: ProviderTeamMember[] = INITIAL_PROVIDER_TEAM.map(m => ({ ...m }));

function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0]?.replace(/[._+-]/g, ' ').trim() ?? 'Invited user';
  return local.replace(/\b\w/g, c => c.toUpperCase());
}

function cloneProviderTeam(): ProviderTeamMember[] {
  return mockProviderTeamMembers.map(m => ({ ...m }));
}

// TODO(api): GET /provider/team/members
export async function listProviderTeamMembers(
  providerId?: string,
): Promise<ApiResult<ProviderTeamMember[]>> {
  void providerId;
  if (getBackendMode() === 'supabase') {
    return listProviderTeamMembersFromSupabase();
  }
  return mockRequest(() => cloneProviderTeam());
}

// TODO(api): POST /provider/team/invites
export async function inviteProviderMember(
  payload: ProviderInvitePayload,
): Promise<ApiResult<ProviderInviteResult>> {
  if (getBackendMode() === 'supabase') {
    return inviteProviderMemberInSupabase(payload);
  }
  return mockRequest(() => {
    const email = payload.email.trim().toLowerCase();
    const dup = mockProviderTeamMembers.some(m => m.email.toLowerCase() === email);
    if (dup) {
      throw new Error('That email already has access or a pending invite.');
    }
    if (payload.role === 'owner') {
      throw new Error('Cannot invite additional owners from this screen.');
    }
    const id = `pm-inv-${Date.now()}`;
    const invitedAt = nowIso();
    const member: ProviderTeamMember = {
      id,
      name: displayNameFromEmail(email),
      email,
      role: payload.role,
      status: 'invited',
      invitedAt,
    };
    mockProviderTeamMembers.push(member);
    void payload.message;
    return {
      id,
      email,
      role: payload.role,
      status: 'invited',
      message: `Invite queued for ${email} (demo — no email sent).`,
      invitedAt,
    };
  });
}

// TODO(api): PATCH /provider/team/members/:id/role
export async function updateProviderMemberRole(
  memberId: string,
  role: ProviderMemberRole,
): Promise<ApiResult<ProviderMemberActionResult>> {
  if (getBackendMode() === 'supabase') {
    return updateProviderMemberRoleInSupabase(memberId, role);
  }
  return mockRequest(() => {
    const m = mockProviderTeamMembers.find(x => x.id === memberId);
    if (!m) throw new Error('Member not found');
    if (m.role === 'owner') throw new Error('Owner role cannot be changed here.');
    if (m.status === 'disabled') throw new Error('Re-enable this member before changing their role.');
    m.role = role;
    return {
      id: memberId,
      status: 'role_updated',
      message: `Role updated to ${role}.`,
      updatedAt: nowIso(),
    };
  });
}

// TODO(api): POST /provider/team/members/:id/disable
export async function disableProviderMember(memberId: string): Promise<ApiResult<ProviderMemberActionResult>> {
  if (getBackendMode() === 'supabase') {
    return disableProviderMemberInSupabase(memberId);
  }
  return mockRequest(() => {
    const m = mockProviderTeamMembers.find(x => x.id === memberId);
    if (!m) throw new Error('Member not found');
    if (m.role === 'owner') throw new Error('Cannot disable the organization owner.');
    m.status = 'disabled';
    return {
      id: memberId,
      status: 'disabled',
      message: 'Access disabled for this member.',
      updatedAt: nowIso(),
    };
  });
}

// TODO(api): POST /provider/team/invites/:id/resend
export async function resendProviderInvite(memberId: string): Promise<ApiResult<ProviderMemberActionResult>> {
  if (getBackendMode() === 'supabase') {
    return resendProviderInviteInSupabase(memberId);
  }
  return mockRequest(() => {
    const m = mockProviderTeamMembers.find(x => x.id === memberId);
    if (!m) throw new Error('Member not found');
    if (m.status !== 'invited') throw new Error('Only pending invites can be resent.');
    m.invitedAt = nowIso();
    return {
      id: memberId,
      status: 'invite_resent',
      message: `Invite resent to ${m.email} (demo — no email sent).`,
      updatedAt: nowIso(),
    };
  });
}

// TODO(api): GET /provider/billing/readiness
export async function getProviderPaymentMethodReadiness(): Promise<
  ApiResult<ProviderPaymentMethodReadiness>
> {
  if (getBackendMode() === 'supabase') {
    return listProviderPaymentMethodsFromSupabase();
  }
  return mockRequest(() => ({
    methods: [],
    hasActiveMethod: false,
    isSupabaseBacked: false,
    message: 'Payment method readout is available in Supabase mode after ledger migration 0023.',
  }));
}

export async function getProviderBillingReadiness(): Promise<ApiResult<ProviderBillingSummary>> {
  if (getBackendMode() === 'supabase') {
    return getProviderBillingReadinessFromSupabase();
  }
  return mockRequest(() => ({
    estimatedOpenValue: 13480,
    readyToInvoiceValue: 7648,
    simulatedInvoiceValue: 13480,
    rows: [],
  }));
}

export async function listProviderInvoices(): Promise<ApiResult<ProviderInvoiceRow[]>> {
  if (getBackendMode() === 'supabase') {
    return listProviderInvoicesFromSupabase();
  }
  return mockRequest(() => []);
}

export async function generateProviderInvoiceFromApprovedTimesheets(): Promise<
  ApiResult<ProviderInvoiceGenerationResult>
> {
  if (getBackendMode() === 'supabase') {
    return generateProviderInvoiceFromApprovedTimesheetsInSupabase();
  }
  return mockRequest(() => ({
    invoiceId: 'inv-mock',
    status: 'generated',
    message: 'Invoice generated (demo mode).',
    totalAmount: 0,
    generatedAt: nowIso(),
  }));
}

// TODO(api): GET /provider/timesheets/readiness
export async function getProviderTimesheetReadiness(): Promise<
  ApiResult<ProviderTimesheetReadinessSummary>
> {
  if (getBackendMode() === 'supabase') {
    return getProviderTimesheetReadinessFromSupabase();
  }
  return mockRequest(() => ({
    pendingCount: 0,
    readyToApproveCount: 0,
    simulatedCount: 0,
    rows: [],
    submittedRows: [],
    approvedRows: [],
    disputedRows: [],
  }));
}

// TODO(api): GET /provider/settings/summary
export async function getProviderSettingsSummary(): Promise<ApiResult<ProviderSettingsSummary>> {
  if (getBackendMode() === 'supabase') {
    return getProviderSettingsSummaryFromSupabase();
  }
  return mockRequest(() => ({
    organizationName: 'Oak Memory Care Group',
    organizationType: 'Memory care',
    organizationStatus: 'active',
    memberRole: 'owner',
    accountEmail: 'demo@covre.com',
    accountName: 'Demo Facility Admin',
    setupStatus: 'complete' as const,
    isSupabaseBacked: false,
  }));
}

// TODO(api): PATCH /provider/settings/organization
export async function updateProviderOrganizationSettings(
  payload: ProviderOrganizationSettingsUpdatePayload,
): Promise<ApiResult<ProviderSettingsActionResult>> {
  if (getBackendMode() === 'supabase') {
    return updateProviderOrganizationSettingsInSupabase(payload);
  }
  return mockRequest(() => ({
    status: 'updated',
    message: 'Organization settings updated (demo).',
    updatedAt: nowIso(),
  }));
}

// TODO(api): PATCH /provider/settings/notifications
export async function updateProviderNotificationSettings(): Promise<
  ApiResult<ProviderSettingsActionResult>
> {
  if (getBackendMode() === 'supabase') {
    return updateProviderNotificationSettingsInSupabase();
  }
  return mockRequest(() => ({
    status: 'simulated',
    message: 'Notification preferences saved (demo).',
    updatedAt: nowIso(),
  }));
}

// TODO(api): PATCH /provider/settings/billing
export async function updateProviderBillingSettings(): Promise<
  ApiResult<ProviderSettingsActionResult>
> {
  if (getBackendMode() === 'supabase') {
    return updateProviderBillingSettingsInSupabase();
  }
  return mockRequest(() => ({
    status: 'simulated',
    message: 'Billing preferences saved (demo).',
    updatedAt: nowIso(),
  }));
}
