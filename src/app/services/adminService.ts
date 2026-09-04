/**
 * Admin / operations data access.
 * TODO: replace mockRequest with real HTTP client + DTO mapping.
 */
import { DollarSign, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ApiResult } from '../api/types';
import { fail, mockRequest } from '../api/mockApi';
import { getBackendMode } from '../lib/backendMode';
import {
  listAdminCredentialReviewQueueFromSupabase,
  rejectAdminWorkerCredentialInSupabase,
  verifyAdminWorkerCredentialInSupabase,
} from '../repositories/adminCredentialsRepository';
import {
  listAdminSupportTicketsFromSupabase,
  updateAdminSupportTicketStatusInSupabase,
} from '../repositories/adminSupportRepository';
import { listAdminIncidentQueueFromSupabase } from '../repositories/adminIncidentsRepository';
import { getAdminMarketplaceDashboardFromSupabase } from '../repositories/adminMarketplaceRepository';
import {
  listAdminWorkerRateReviewQueueFromSupabase,
  lockAdminShiftRatesInSupabase,
  setAdminShiftWorkerRateInSupabase,
  unlockAdminShiftRatesInSupabase,
  updateAdminShiftBillRateInSupabase,
} from '../repositories/adminWorkerRatesRepository';
import {
  generateAdminWorkerEarningFromTimesheetInSupabase,
  listApprovedTimesheetsForEarningGenerationFromSupabase,
} from '../repositories/adminWorkerEarningsRepository';
import {
  createWorkerPayoutBatchInSupabase,
  listAdminWorkerPayoutBatchQueueFromSupabase,
} from '../repositories/adminWorkerPayoutsRepository';
import {
  issueProviderInvoiceInSupabase,
  listAdminInvoiceIssueQueueFromSupabase,
  listAdminProviderInvoiceCollectionQueueFromSupabase,
  startAdminProviderInvoiceCollectionInSupabase,
} from '../repositories/adminInvoicesRepository';
import { isProviderInvoiceCollectionUiEnabled } from '../lib/providerInvoiceCollectionEnabled';
import type {
  AdminCredentialReviewActionResult,
  AdminCredentialReviewPayload,
  AdminEarningGenerationQueue,
  AdminMarketplaceDashboardPayload,
  AdminSupportTicketActionResult,
  AdminSupportTicketPayload,
  AdminSupportTicketStatus,
  AdminIncidentQueuePayload,
  AdminIncidentRow,
  AdminIncidentSeverity,
  AdminIncidentStatus,
  AdminRateActionResult,
  AdminRateLockPayload,
  AdminSetWorkerRatePayload,
  AdminUpdateBillRatePayload,
  AdminInvoiceIssueQueue,
  AdminProviderInvoiceCollectionQueue,
  AdminPayoutBatchQueue,
  AdminWorkerRateReviewQueue,
  WorkerEarningGenerationResult,
  WorkerPayoutBatchResult,
  ProviderInvoiceCollectionStartResult,
  ProviderInvoiceIssueResult,
} from './types';
import type { AdminShiftOperations, Incident, IncidentDetail, Shift } from '../data/types';
import {
  adminMetrics,
  adminShiftOperations,
  getIncidentDetailById,
  getShiftById,
  getWorkerById as selectWorker,
  getUrgentMarketplaceShifts,
  incidents,
  paymentMetricCards,
  paymentRecords,
  supportTickets,
  workers,
} from '../data/selectors';

function fallbackAdminOps(shift: Shift): AdminShiftOperations {
  const num = shift.id.replace(/\D/g, '').padStart(3, '0').slice(-3);
  return {
    displayShiftCode: `SH-48${num}`,
    paymentStatus: 'pending',
    invoiceStatus: 'open',
    credentialEligibility:
      shift.requiredCredentialsDisplayed.length > 0
        ? shift.requiredCredentialsDisplayed.join(', ')
        : 'See posted requirements',
    riskScoreLabel: '—',
    timeline: [
      `${shift.dateLabel} — ${shift.roleTitle} · ${shift.siteName}`,
      `Lifecycle: ${shift.lifecycleStatus}`,
    ],
    messagesPlaceholder: 'No messages yet.',
    adminNotes: '',
  };
}

export type AdminOverviewMetric = {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
};

export type AdminShiftPage = {
  shift: Shift;
  operations: AdminShiftOperations;
  workerLabel: string;
};

// TODO(api): GET /admin/credentials/review-queue
export async function listAdminCredentialReviewQueue(): Promise<
  ApiResult<AdminCredentialReviewPayload>
> {
  if (getBackendMode() === 'supabase') {
    return listAdminCredentialReviewQueueFromSupabase();
  }
  return mockRequest(() => ({
    rows: [
      {
        id: 'mock-1',
        workerId: 'w-mock-1',
        workerName: 'Sarah Johnson',
        credentialId: 'c-mock-1',
        credentialName: 'CNA License',
        status: 'pending',
        submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        expiresAt: '2027-12-01',
        isSupabaseBacked: false,
      },
      {
        id: 'mock-2',
        workerId: 'w-mock-2',
        workerName: 'Mike Chen',
        credentialId: 'c-mock-2',
        credentialName: 'Background Check',
        status: 'pending',
        submittedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        isSupabaseBacked: false,
      },
      {
        id: 'mock-3',
        workerId: 'w-mock-3',
        workerName: 'Jessica Martinez',
        credentialId: 'c-mock-3',
        credentialName: 'CPR/BLS',
        status: 'pending',
        submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: '2026-06-01',
        isSupabaseBacked: false,
      },
    ],
    pendingCount: 3,
    verifiedCount: 0,
    rejectedCount: 0,
    expiredCount: 0,
    isSupabaseBacked: false,
  }));
}

// TODO(api): POST /admin/credentials/:id/verify
export async function verifyAdminWorkerCredential(
  credentialId: string,
  note?: string,
): Promise<ApiResult<AdminCredentialReviewActionResult>> {
  if (getBackendMode() === 'supabase') {
    return verifyAdminWorkerCredentialInSupabase(credentialId, note);
  }
  return mockRequest(() => ({
    credentialId,
    status: 'verified',
    message: 'Credential verified (demo)',
    updatedAt: new Date().toISOString(),
  }));
}

// TODO(api): POST /admin/credentials/:id/reject
export async function rejectAdminWorkerCredential(
  credentialId: string,
  reason: string,
): Promise<ApiResult<AdminCredentialReviewActionResult>> {
  if (getBackendMode() === 'supabase') {
    return rejectAdminWorkerCredentialInSupabase(credentialId, reason);
  }
  return mockRequest(() => ({
    credentialId,
    status: 'rejected',
    message: 'Credential rejected (demo)',
    updatedAt: new Date().toISOString(),
  }));
}

// TODO(api): GET /admin/marketplace/dashboard
export async function getAdminMarketplaceDashboard(): Promise<
  ApiResult<AdminMarketplaceDashboardPayload>
> {
  if (getBackendMode() === 'supabase') {
    return getAdminMarketplaceDashboardFromSupabase();
  }
  return mockRequest(() => ({
    summary: {
      providerCount: 87,
      workerCount: 1247,
      openShiftCount: 23,
      bookedShiftCount: 156,
      bookingCount: 412,
      submittedTimesheetCount: 18,
      approvedTimesheetCount: 94,
      invoiceDraftCount: 12,
      compliancePacketCount: 31,
      supportTicketCount: 8,
      credentialReviewCount: 12,
    },
    activity: [],
    isSupabaseBacked: false,
  }));
}

// TODO(api): GET /admin/dashboard/metrics
export async function getAdminDashboard() {
  return mockRequest(() => {
    const metrics: AdminOverviewMetric[] = [
      { label: 'GMV', value: '$487,320', change: '+12.3% vs last month', icon: DollarSign },
      { label: 'Revenue', value: '$73,098', change: '+12.3% vs last month', icon: DollarSign },
      { label: 'Fill Rate', value: '94.2%', change: '+2.1% vs last month', icon: TrendingUp },
      { label: 'Active Workers', value: '1,247', change: '+43 this week', icon: Users },
      { label: 'Active Providers', value: '87', change: '+5 this week', icon: Users },
      { label: 'Open Urgent Shifts', value: '23', change: 'Across 12 facilities', icon: AlertTriangle },
    ];
    return { metrics };
  });
}

// TODO(api): GET /admin/marketplace/urgent
export async function listAdminMarketplaceShifts() {
  return mockRequest(() => getUrgentMarketplaceShifts());
}

// TODO(api): GET /admin/marketplace/overview — dashboard tiles + urgent + availability list
export async function getAdminMarketplaceView() {
  return mockRequest(() => ({
    metrics: adminMetrics,
    urgentShifts: getUrgentMarketplaceShifts(),
    workers,
  }));
}

// TODO(api): GET /admin/shifts/:id/operations
export async function getAdminShift(id: string): Promise<ApiResult<AdminShiftPage | null>> {
  return mockRequest(() => {
    const shift = getShiftById(id);
    if (!shift) return null;
    const operations = adminShiftOperations[shift.id] ?? fallbackAdminOps(shift);
    const workerLabel = shift.assignedWorkerId
      ? selectWorker(shift.assignedWorkerId)?.name ?? 'Unknown worker'
      : 'Unfilled';
    return { shift, operations, workerLabel };
  });
}

// TODO(api): GET /admin/incidents
export async function listAdminIncidents(): Promise<ApiResult<Incident[]>> {
  return mockRequest(() => incidents);
}

function mockSeverityToAdmin(severity: string): AdminIncidentSeverity {
  switch (severity.toLowerCase()) {
    case 'high':
      return 'high';
    case 'low':
      return 'low';
    case 'critical':
      return 'critical';
    default:
      return 'medium';
  }
}

function mockStatusToAdmin(status: string): AdminIncidentStatus {
  switch (status) {
    case 'under-review':
      return 'under_review';
    case 'pending':
      return 'open';
    case 'resolved':
      return 'resolved';
    default:
      return 'open';
  }
}

function mockIncidentsToQueueRows(): AdminIncidentRow[] {
  return incidents.map(row => ({
    id: row.id,
    source: row.type === 'Safety Report' ? ('safety_report' as const) : ('incident' as const),
    title: row.type,
    summary: row.shiftSummary,
    severity: mockSeverityToAdmin(row.severity),
    status: mockStatusToAdmin(row.status),
    incidentType: row.type,
    workerLabel: row.workerName,
    providerLabel: row.providerName,
    shiftLabel: row.shiftSummary,
    isSupabaseBacked: false,
  }));
}

function buildMockIncidentQueuePayload(): AdminIncidentQueuePayload {
  const rows = mockIncidentsToQueueRows();
  return {
    rows,
    openCount: rows.filter(r => r.status === 'open').length,
    criticalCount: rows.filter(r => r.severity === 'critical' || r.severity === 'high').length,
    escalatedCount: rows.filter(r => r.status === 'escalated').length,
    isSupabaseBacked: false,
  };
}

// TODO(api): GET /admin/incidents/queue
export async function listAdminIncidentQueue(): Promise<ApiResult<AdminIncidentQueuePayload>> {
  if (getBackendMode() === 'supabase') {
    return listAdminIncidentQueueFromSupabase();
  }
  return mockRequest(() => buildMockIncidentQueuePayload());
}

function buildMockWorkerRateReviewQueue(): AdminWorkerRateReviewQueue {
  return {
    rows: [
      {
        id: 'mock-rate-shift-1',
        shiftId: 'mock-rate-shift-1',
        providerName: 'Demo facility (prep)',
        siteName: 'North Campus',
        role: 'CNA',
        status: 'missing_worker_rate',
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        billRateCents: 3200,
        currency: 'usd',
        rateType: 'hourly',
        shiftStatus: 'open',
        isUrgent: false,
        isSupabaseBacked: false,
      },
      {
        id: 'mock-rate-shift-2',
        shiftId: 'mock-rate-shift-2',
        providerName: 'Demo facility (prep)',
        siteName: 'East Wing',
        role: 'DSP',
        status: 'missing_bill_rate',
        startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        currency: 'usd',
        rateType: 'hourly',
        shiftStatus: 'draft',
        isSupabaseBacked: false,
      },
    ],
    summary: {
      missingWorkerRate: 1,
      missingBillRate: 1,
      ready: 0,
      locked: 0,
    },
    isSupabaseBacked: false,
    message:
      'Demo prep rows only — not live payroll data. Use Supabase mode after migration 0024 for real shift rates.',
  };
}

// TODO(api): GET /admin/worker-rates/review-queue
export async function listAdminWorkerRateReviewQueue(): Promise<
  ApiResult<AdminWorkerRateReviewQueue>
> {
  if (getBackendMode() === 'supabase') {
    return listAdminWorkerRateReviewQueueFromSupabase();
  }
  return mockRequest(() => buildMockWorkerRateReviewQueue());
}

function mockAdminRateAction(
  shiftId: string,
  message: string,
  overrides?: Partial<AdminRateActionResult>,
): AdminRateActionResult {
  return {
    shiftId,
    message,
    ...overrides,
  };
}

// TODO(api): POST /admin/worker-rates/set-worker-rate
export async function setAdminShiftWorkerRate(
  payload: AdminSetWorkerRatePayload,
): Promise<ApiResult<AdminRateActionResult>> {
  if (getBackendMode() === 'supabase') {
    return setAdminShiftWorkerRateInSupabase(
      payload.shiftId,
      payload.workerRateCents,
      payload.reason,
    );
  }
  return mockRequest(() =>
    mockAdminRateAction(payload.shiftId, 'Worker rate updated (mock prep).', {
      workerRateCents: payload.workerRateCents,
    }),
  );
}

// TODO(api): POST /admin/worker-rates/update-bill-rate
export async function updateAdminShiftBillRate(
  payload: AdminUpdateBillRatePayload,
): Promise<ApiResult<AdminRateActionResult>> {
  if (getBackendMode() === 'supabase') {
    return updateAdminShiftBillRateInSupabase(
      payload.shiftId,
      payload.billRateCents,
      payload.reason,
    );
  }
  return mockRequest(() =>
    mockAdminRateAction(payload.shiftId, 'Bill rate updated (mock prep).', {
      billRateCents: payload.billRateCents,
    }),
  );
}

// TODO(api): POST /admin/worker-rates/lock
export async function lockAdminShiftRates(
  payload: AdminRateLockPayload,
): Promise<ApiResult<AdminRateActionResult>> {
  if (getBackendMode() === 'supabase') {
    return lockAdminShiftRatesInSupabase(payload.shiftId, payload.reason);
  }
  return mockRequest(() =>
    mockAdminRateAction(payload.shiftId, 'Shift rates locked (mock prep).', {
      ratesLockedAt: new Date().toISOString(),
    }),
  );
}

// TODO(api): POST /admin/worker-rates/unlock
export async function unlockAdminShiftRates(
  payload: AdminRateLockPayload,
): Promise<ApiResult<AdminRateActionResult>> {
  if (getBackendMode() === 'supabase') {
    return unlockAdminShiftRatesInSupabase(payload.shiftId, payload.reason);
  }
  return mockRequest(() =>
    mockAdminRateAction(payload.shiftId, 'Shift rates unlocked (mock prep).'),
  );
}

// TODO(api): GET /admin/incidents/:id
export async function getAdminIncident(id: string): Promise<ApiResult<IncidentDetail | undefined>> {
  return mockRequest(() => getIncidentDetailById(id));
}

// TODO(api): GET /admin/trust-safety/signals
export async function listTrustSafetyFlags() {
  return mockRequest(() => ({
    metrics: [
      { label: 'Flagged accounts', value: '14', tone: 'danger' as const },
      { label: 'Credential fraud risks', value: '3', tone: 'warn' as const },
      { label: 'Unsafe facility reports', value: '2', tone: 'danger' as const },
      { label: 'Repeated cancellations', value: '28', tone: 'neutral' as const },
    ],
    flaggedWorkers: [
      {
        id: 'w1',
        name: 'Jordan Ellis',
        role: 'CNA',
        issue: 'Multiple no-shows in 14 days',
        severity: 'high' as const,
        lastActivity: '2h ago',
      },
      {
        id: 'w2',
        name: 'Alex Morgan',
        role: 'DSP',
        issue: 'Credential image mismatch flagged by vendor',
        severity: 'medium' as const,
        lastActivity: 'Yesterday',
      },
    ],
    flaggedProviders: [
      {
        id: 'p1',
        name: 'Harbor Memory Care',
        type: 'Skilled nursing group',
        issue: 'Staffing ratio complaints from workers',
        severity: 'high' as const,
        lastActivity: '4h ago',
      },
      {
        id: 'p2',
        name: 'Northside Assisted Living',
        type: 'Residential',
        issue: 'Late timesheet approvals (>72h)',
        severity: 'medium' as const,
        lastActivity: 'May 14',
      },
    ],
    riskSignals: [
      {
        id: 'r1',
        name: 'Unusual bid clustering',
        type: 'Marketplace',
        issue: 'Same device fingerprint on 6 bids',
        severity: 'high' as const,
        lastActivity: '1h ago',
      },
      {
        id: 'r2',
        name: 'Document batch upload',
        type: 'Credentialing',
        issue: '12 worker uploads from same IP in 3 min',
        severity: 'medium' as const,
        lastActivity: 'May 15',
      },
    ],
  }));
}

// TODO(api): GET /admin/payments/summary
export async function listPaymentOperations() {
  return mockRequest(() => ({
    paymentMetricCards,
    records: paymentRecords,
  }));
}

function buildMockEarningGenerationQueue(): AdminEarningGenerationQueue {
  const rows: AdminEarningGenerationQueue['rows'] = [
    {
      timesheetId: 'mock-ts-1',
      bookingId: 'mock-bk-1',
      workerName: 'Sarah Johnson',
      providerName: 'Sunrise Care',
      siteName: 'North Campus',
      shiftStartsAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      timesheetStatus: 'approved',
      workerPayDisplay: '$28.00/hr',
      hasWorkerRateSnapshot: true,
      canGenerate: true,
    },
    {
      timesheetId: 'mock-ts-2',
      bookingId: 'mock-bk-2',
      workerName: 'Mike Chen',
      providerName: 'Harbor Memory Care',
      siteName: 'Main Floor',
      shiftStartsAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      timesheetStatus: 'approved',
      hasWorkerRateSnapshot: false,
      canGenerate: false,
      blockerReason: 'Worker pay snapshot is missing.',
    },
    {
      timesheetId: 'mock-ts-3',
      bookingId: 'mock-bk-3',
      workerName: 'Alex Rivera',
      providerName: 'Sunrise Care',
      siteName: 'South Campus',
      shiftStartsAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      timesheetStatus: 'approved',
      workerPayDisplay: '$32.50/hr',
      hasWorkerRateSnapshot: true,
      earningId: 'mock-earn-1',
      earningStatus: 'approved',
      canGenerate: false,
      blockerReason: 'Earning already generated.',
    },
  ];

  return {
    rows,
    summary: {
      approvedTimesheets: rows.length,
      readyToGenerate: rows.filter(r => r.canGenerate).length,
      alreadyGenerated: rows.filter(r => r.earningId).length,
      missingRateSnapshot: rows.filter(r => !r.hasWorkerRateSnapshot).length,
    },
    isSupabaseBacked: false,
    message: 'Demo queue — earning generation requires Supabase backend and admin RPC.',
  };
}

// TODO(api): GET /admin/earnings/generation-queue
export async function listAdminEarningGenerationQueue(): Promise<
  ApiResult<AdminEarningGenerationQueue>
> {
  if (getBackendMode() === 'supabase') {
    return listApprovedTimesheetsForEarningGenerationFromSupabase();
  }
  return mockRequest(() => buildMockEarningGenerationQueue());
}

// TODO(api): POST /admin/earnings/generate-from-timesheet
export async function generateAdminWorkerEarningFromTimesheet(
  timesheetId: string,
): Promise<ApiResult<WorkerEarningGenerationResult>> {
  if (getBackendMode() === 'supabase') {
    return generateAdminWorkerEarningFromTimesheetInSupabase(timesheetId);
  }
  return mockRequest(() => ({
    earningId: `mock-earn-${timesheetId}`,
    timesheetId,
    status: 'approved',
    netEarningsCents: 22400,
    currency: 'usd',
    idempotent: false,
    message: 'Worker earning generated (demo only — not persisted).',
  }));
}

const DEFAULT_ADMIN_INVOICE_ISSUE_REASON = 'Issued from admin payments';

function buildMockInvoiceIssueQueue(): AdminInvoiceIssueQueue {
  return {
    rows: [
      {
        invoiceId: 'mock-inv-ready',
        providerName: 'Sunrise Care Group',
        invoiceNumber: undefined,
        status: 'draft',
        paymentStatus: 'not_started',
        totalCents: 184500,
        totalDisplay: '$1,845.00',
        lineCount: 3,
        lineTotalCents: 184500,
        generatedAt: new Date(Date.now() - 86400000).toISOString(),
        dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        canIssue: true,
      },
      {
        invoiceId: 'mock-inv-blocked',
        providerName: 'Harbor Health',
        status: 'draft',
        paymentStatus: 'not_started',
        totalCents: 0,
        totalDisplay: '$0.00',
        lineCount: 0,
        lineTotalCents: 0,
        generatedAt: new Date(Date.now() - 172800000).toISOString(),
        canIssue: false,
        blockerReason: 'Invoice has no lines.',
      },
    ],
    summary: {
      draftInvoices: 2,
      readyToIssue: 1,
      blocked: 1,
      openInvoices: 2,
    },
    isSupabaseBacked: false,
    message:
      'Demo invoice issue queue — issue actions are not persisted. Use Supabase backend and migration 0030 for live issuing.',
  };
}

export async function listAdminInvoiceIssueQueue(): Promise<ApiResult<AdminInvoiceIssueQueue>> {
  if (getBackendMode() === 'supabase') {
    return listAdminInvoiceIssueQueueFromSupabase();
  }
  return mockRequest(() => buildMockInvoiceIssueQueue());
}

function buildMockProviderInvoiceCollectionQueue(): AdminProviderInvoiceCollectionQueue {
  const collectionUiEnabled = isProviderInvoiceCollectionUiEnabled();
  return {
    rows: [
      {
        invoiceId: 'mock-collect-open',
        providerId: 'mock-provider-1',
        providerName: 'Riverside Care',
        invoiceNumber: 'COVRE-DEMO-OPEN',
        status: 'open',
        paymentStatus: 'not_started',
        totalCents: 184500,
        totalDisplay: '$1,845.00',
        currency: 'usd',
        lockedAt: new Date(Date.now() - 86400000).toISOString(),
        issuedAt: new Date(Date.now() - 86400000).toISOString(),
        hasActivePaymentMethod: true,
        methodBrand: 'visa',
        methodLast4: '4242',
        canCollect: false,
        blockerReason: collectionUiEnabled
          ? 'Payment collection is not connected in demo mode.'
          : 'Payment collection is not enabled.',
      },
      {
        invoiceId: 'mock-collect-paid',
        providerId: 'mock-provider-2',
        providerName: 'Harbor Health',
        invoiceNumber: 'COVRE-DEMO-PAID',
        status: 'paid',
        paymentStatus: 'paid',
        totalCents: 95000,
        totalDisplay: '$950.00',
        currency: 'usd',
        paidAt: new Date(Date.now() - 3600000).toISOString(),
        hasActivePaymentMethod: true,
        methodBrand: 'visa',
        methodLast4: '4242',
        latestPaymentStatus: 'succeeded',
        canCollect: false,
        blockerReason: 'Already paid.',
      },
    ],
    summary: {
      openInvoices: 1,
      readyToCollect: 0,
      missingPaymentMethod: 0,
      processing: 0,
      paid: 1,
    },
    isSupabaseBacked: false,
    collectionUiEnabled,
    message:
      'Demo collection queue — Start collection is disabled in mock mode. Use Supabase backend for live queue reads.',
  };
}

export async function listAdminProviderInvoiceCollectionQueue(): Promise<
  ApiResult<AdminProviderInvoiceCollectionQueue>
> {
  if (getBackendMode() === 'supabase') {
    return listAdminProviderInvoiceCollectionQueueFromSupabase();
  }
  return mockRequest(() => buildMockProviderInvoiceCollectionQueue());
}

export async function startAdminProviderInvoiceCollection(
  invoiceId: string,
): Promise<ApiResult<ProviderInvoiceCollectionStartResult>> {
  if (getBackendMode() === 'supabase') {
    return startAdminProviderInvoiceCollectionInSupabase(invoiceId);
  }
  return fail('not_connected', 'Payment collection is not connected in demo mode.');
}

export async function issueProviderInvoice(
  invoiceId: string,
  reason?: string,
): Promise<ApiResult<ProviderInvoiceIssueResult>> {
  const issueReason =
    reason?.trim() && reason.trim().length > 0
      ? reason.trim()
      : DEFAULT_ADMIN_INVOICE_ISSUE_REASON;

  if (getBackendMode() === 'supabase') {
    return issueProviderInvoiceInSupabase(invoiceId, issueReason);
  }
  return mockRequest(() => ({
    invoiceId,
    invoiceNumber: `COVRE-DEMO-${invoiceId.slice(0, 8).toUpperCase()}`,
    status: 'open',
    paymentStatus: 'not_started',
    totalCents: 184500,
    message: 'Demo issue only — not persisted. No payment has been collected.',
  }));
}

function buildMockPayoutBatchQueue(): AdminPayoutBatchQueue {
  return {
    groupedByWorker: [
      {
        workerId: 'w-mock-1',
        workerName: 'Sarah Johnson',
        earningCount: 2,
        amountCents: 44800,
        currency: 'usd',
        earningIds: ['mock-earn-1', 'mock-earn-2'],
      },
      {
        workerId: 'w-mock-2',
        workerName: 'Mike Chen',
        earningCount: 1,
        amountCents: 18500,
        currency: 'usd',
        earningIds: ['mock-earn-3'],
      },
    ],
    summary: {
      readyEarnings: 3,
      workerCount: 2,
      totalEligibleCents: 63300,
      createdPayouts: 1,
      queuedEarnings: 2,
    },
    isSupabaseBacked: false,
    message:
      'Demo queue — payout batch actions require Supabase backend and migration 0028.',
  };
}

// TODO(api): GET /admin/payouts/batch-queue
export async function listAdminWorkerPayoutBatchQueue(): Promise<
  ApiResult<AdminPayoutBatchQueue>
> {
  if (getBackendMode() === 'supabase') {
    return listAdminWorkerPayoutBatchQueueFromSupabase();
  }
  return mockRequest(() => buildMockPayoutBatchQueue());
}

// TODO(api): POST /admin/payouts/create-batch
export async function createAdminWorkerPayoutBatch(
  targetWorkerId?: string,
): Promise<ApiResult<WorkerPayoutBatchResult>> {
  if (getBackendMode() === 'supabase') {
    return createWorkerPayoutBatchInSupabase(targetWorkerId);
  }
  return mockRequest(() => ({
    ok: true,
    payoutCount: 0,
    earningCount: 0,
    workerCount: 0,
    totalAmountCents: 0,
    payoutIds: [],
    message: 'Payout batching is demo-only — requires Supabase backend and migration 0028.',
  }));
}

// TODO(api): GET /admin/support/tickets
export async function listSupportTickets() {
  return mockRequest(() => supportTickets);
}

export async function listAdminSupportTickets(): Promise<ApiResult<AdminSupportTicketPayload>> {
  if (getBackendMode() === 'supabase') {
    return listAdminSupportTicketsFromSupabase();
  }
  const rows = supportTickets.map(t => ({
    id: t.id,
    requesterUserId: t.requesterId,
    requesterType: t.tags.includes('worker')
      ? ('worker' as const)
      : t.tags.includes('provider')
        ? ('provider' as const)
        : ('provider' as const),
    requesterLabel: t.requesterLabel,
    ticketType: t.type,
    subject: t.type,
    priority: t.priority === 'urgent' ? ('urgent' as const) : ('normal' as const),
    status:
      t.status === 'open'
        ? ('open' as const)
        : t.status === 'pending'
          ? ('assigned' as const)
          : ('resolved' as const),
    relatedLine: t.relatedLine,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isSupabaseBacked: false,
  }));
  return mockRequest(() => ({
    rows,
    openCount: rows.filter(r => r.status === 'open').length,
    assignedCount: rows.filter(r => r.status === 'assigned').length,
    resolvedCount: rows.filter(r => r.status === 'resolved').length,
    closedCount: 0,
    urgentCount: rows.filter(r => r.priority === 'urgent').length,
    isSupabaseBacked: false,
  }));
}

export async function updateAdminSupportTicketStatus(
  ticketId: string,
  nextStatus: AdminSupportTicketStatus,
  note?: string,
): Promise<ApiResult<AdminSupportTicketActionResult>> {
  if (getBackendMode() === 'supabase') {
    return updateAdminSupportTicketStatusInSupabase(ticketId, nextStatus, note);
  }
  return mockRequest(() => ({
    ticketId,
    status: nextStatus,
    message: `Support ticket ${nextStatus} (demo)`,
    updatedAt: new Date().toISOString(),
  }));
}

type UserRow = {
  id: string;
  name: string;
  accountType: string;
  status: 'active' | 'suspended' | 'review';
  role: string;
  location: string;
  lastActive: string;
};

// TODO(api): GET /admin/users?segment=workers|providers|admins
export async function listUsersAndProviders(): Promise<ApiResult<{
  workers: UserRow[];
  providers: UserRow[];
  admins: UserRow[];
}>> {
  return mockRequest(() => ({
    workers: [
      {
        id: 'w1',
        name: 'Sarah Johnson',
        accountType: 'Worker',
        status: 'active',
        role: 'CNA',
        location: 'Portland metro',
        lastActive: '15 min ago',
      },
      {
        id: 'w2',
        name: 'Mike Chen',
        accountType: 'Worker',
        status: 'active',
        role: 'DSP',
        location: 'Vancouver, WA',
        lastActive: '2h ago',
      },
    ],
    providers: [
      {
        id: 'p1',
        name: 'Sunrise Care',
        accountType: 'Provider org',
        status: 'active',
        role: 'Admin + 4 coordinators',
        location: '5 sites OR / WA',
        lastActive: 'Today',
      },
      {
        id: 'p2',
        name: 'Harbor Memory Care',
        accountType: 'Facility',
        status: 'review',
        role: 'Facility admin',
        location: 'Hillsboro',
        lastActive: 'May 14',
      },
    ],
    admins: [
      {
        id: 'a1',
        name: 'Taylor Brooks',
        accountType: 'Covre ops',
        status: 'active',
        role: 'L2 Support',
        location: 'Remote — PST',
        lastActive: 'Now',
      },
    ],
  }));
}
