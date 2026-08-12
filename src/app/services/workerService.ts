/**
 * Worker-facing data access.
 * TODO: replace mockRequest with real HTTP client + DTO mapping.
 */
import type { ApiResult } from '../api/types';
import { mockRequest } from '../api/mockApi';
import { getBackendMode } from '../lib/backendMode';
import {
  listWorkerCredentialReadinessFromSupabase,
  selfAttestWorkerCredentialInSupabase,
} from '../repositories/workerCredentialsRepository';
import {
  completeWorkerProfileOnboardingInSupabase,
  getCurrentWorkerProfileFromSupabase,
  saveCurrentWorkerProfileToSupabase,
} from '../repositories/workerProfileRepository';
import {
  getWorkerShiftFromSupabase,
  listWorkerShiftsFromSupabase,
} from '../repositories/workerShiftsRepository';
import {
  listCurrentWorkerShiftRequestsFromSupabase,
  submitWorkerShiftRequestToSupabase,
} from '../repositories/workerShiftRequestsRepository';
import {
  getWorkerBookingForShiftFromSupabase,
  listWorkerBookingsFromSupabase,
} from '../repositories/workerBookingsRepository';
import { getWorkerPayReadinessFromSupabase } from '../repositories/workerEarningsRepository';
import {
  clockInBookingInSupabase,
  clockOutBookingInSupabase,
  endBreakInSupabase,
  getWorkerActiveShiftFromSupabase,
  resolveBookingIdForShiftInSupabase,
  startBreakInSupabase,
  submitWorkerTimesheetFromSupabase,
} from '../repositories/workerActiveShiftRepository';
import type { CareSite, Credential, Shift, Worker } from '../data/types';
import { credentials } from '../data/mockData';
import {
  ACTIVE_PREVIEW_SHIFT_ID,
  getShiftById,
  getSiteById,
  getWorkerById as selectWorker,
  getWorkerFeedShifts,
} from '../data/selectors';
import type {
  SafetyReportPayload,
  WorkerActionResult,
  WorkerBookingsPayload,
  WorkerMessageThreadPreview,
  WorkerAccountPayload,
  WorkerProfileDraft,
  WorkerProfileSaveResult,
  WorkerProfileSummary,
  WorkerCredentialReadinessRow,
  WorkerCredentialSaveResult,
  WorkerShiftRequestResult,
  WorkerShiftRequestSummary,
  WorkerActiveShiftPayload,
  WorkerPayReadiness,
} from './types';

const SUPABASE_ACTION_DEFERRED =
  'Applications and bookings will be connected in a later Supabase pass.';

function nowIso(): string {
  return new Date().toISOString();
}

export async function listWorkerShifts(): Promise<ApiResult<Shift[]>> {
  if (getBackendMode() === 'supabase') {
    return listWorkerShiftsFromSupabase();
  }
  return mockRequest(() => getWorkerFeedShifts());
}

export async function getWorkerShift(id: string): Promise<ApiResult<Shift | undefined>> {
  if (getBackendMode() === 'supabase') {
    const res = await getWorkerShiftFromSupabase(id);
    if (!res.ok) return res;
    return { ok: true, data: res.data?.shift };
  }
  return mockRequest(() => getShiftById(id));
}

/** Single round-trip for shift detail page (shift + site). */
export async function getWorkerShiftPage(
  shiftId: string,
): Promise<ApiResult<{ shift: Shift; site: CareSite | undefined } | null>> {
  if (getBackendMode() === 'supabase') {
    return getWorkerShiftFromSupabase(shiftId);
  }
  return mockRequest(() => {
    const shift = getShiftById(shiftId);
    if (!shift) return null;
    return { shift, site: getSiteById(shift.siteId) };
  });
}

export async function getActiveShift(): Promise<ApiResult<WorkerActiveShiftPayload>> {
  if (getBackendMode() === 'supabase') {
    const res = await getWorkerActiveShiftFromSupabase();
    if (!res.ok) return res;
    return {
      ok: true,
      data: {
        previewShiftId: res.data.shift?.id,
        shift: res.data.shift,
        summary: res.data.summary,
      },
    };
  }
  return mockRequest(() => {
    const previewShiftId = ACTIVE_PREVIEW_SHIFT_ID;
    const shift = getShiftById(previewShiftId);
    return {
      previewShiftId,
      shift,
      summary: {
        shiftId: previewShiftId,
        status: 'ready' as const,
        title: shift?.roleTitle,
        siteName: shift?.siteName,
        message: 'Demo active shift — clock actions are simulated.',
        isSupabaseBacked: false,
        actionsEnabled: true,
      },
    };
  });
}

export async function listWorkerCredentials(_workerId?: string): Promise<ApiResult<Credential[]>> {
  return mockRequest(() => credentials);
}

export async function listWorkerCredentialReadiness(): Promise<
  ApiResult<WorkerCredentialReadinessRow[]>
> {
  if (getBackendMode() === 'supabase') {
    return listWorkerCredentialReadinessFromSupabase();
  }
  return mockRequest(() =>
    credentials.map(c => ({
      credentialId: c.id,
      name: c.name,
      category: c.category,
      status: 'verified' as const,
      statusLabel: 'Verified (demo)',
    })),
  );
}

export async function selfAttestWorkerCredential(
  credentialId: string,
): Promise<ApiResult<WorkerCredentialSaveResult>> {
  if (getBackendMode() === 'supabase') {
    return selfAttestWorkerCredentialInSupabase(credentialId);
  }
  return mockRequest(() => ({
    credentialId,
    status: 'pending',
    message: 'Credential added (demo mode).',
    updatedAt: nowIso(),
  }));
}

export async function getWorkerReputation(workerId?: string): Promise<ApiResult<Worker | undefined>> {
  return mockRequest(() => selectWorker(workerId ?? 'worker-001'));
}

export async function getCareSite(id: string): Promise<ApiResult<CareSite | undefined>> {
  return mockRequest(() => getSiteById(id));
}

function failDeferred(_shiftId: string, code: string): ApiResult<WorkerActionResult> {
  return {
    ok: false,
    error: { code, message: SUPABASE_ACTION_DEFERRED },
  };
}

export async function submitWorkerShiftRequest(
  shiftId: string,
): Promise<ApiResult<WorkerShiftRequestResult>> {
  if (getBackendMode() === 'supabase') {
    return submitWorkerShiftRequestToSupabase(shiftId);
  }
  return mockRequest(() => ({
    requestId: `sr-mock-${shiftId}`,
    shiftId,
    status: 'simulated',
    message: 'Application sent (demo mode).',
    createdAt: nowIso(),
  }));
}

export async function listWorkerShiftRequests(): Promise<
  ApiResult<WorkerShiftRequestSummary[]>
> {
  if (getBackendMode() === 'supabase') {
    return listCurrentWorkerShiftRequestsFromSupabase();
  }
  return mockRequest(() => []);
}

// TODO(api): POST /worker/shifts/:shiftId/claim
export async function claimShift(shiftId: string): Promise<ApiResult<WorkerActionResult>> {
  if (getBackendMode() === 'supabase') {
    const res = await submitWorkerShiftRequestToSupabase(shiftId);
    if (!res.ok) return res;
    return {
      ok: true,
      data: {
        id: res.data.requestId ?? shiftId,
        status: 'submitted',
        message: res.data.message,
        updatedAt: res.data.createdAt,
      },
    };
  }
  return mockRequest(() => ({
    id: shiftId,
    status: 'claimed' as const,
    message: 'Shift claimed — you’re on the roster for this coverage.',
    updatedAt: nowIso(),
  }));
}

// TODO(api): POST /worker/shifts/:shiftId/save
export async function saveShift(shiftId: string): Promise<ApiResult<WorkerActionResult>> {
  if (getBackendMode() === 'supabase') {
    return failDeferred(shiftId, 'save_deferred');
  }
  return mockRequest(() => ({
    id: shiftId,
    status: 'saved' as const,
    message: 'Shift saved for later',
    updatedAt: nowIso(),
  }));
}

// TODO(api): POST /worker/shifts/:shiftId/question
export async function askShiftQuestion(
  shiftId: string,
  question?: string,
): Promise<ApiResult<WorkerActionResult>> {
  void question;
  if (getBackendMode() === 'supabase') {
    return failDeferred(shiftId, 'question_deferred');
  }
  return mockRequest(() => ({
    id: shiftId,
    status: 'question_sent' as const,
    message: 'Your question was sent to the site coordinator',
    updatedAt: nowIso(),
  }));
}

// TODO(api): POST /worker/shifts/:shiftId/calendar
export async function addShiftToCalendar(shiftId: string): Promise<ApiResult<WorkerActionResult>> {
  if (getBackendMode() === 'supabase') {
    return failDeferred(shiftId, 'calendar_deferred');
  }
  return mockRequest(() => ({
    id: shiftId,
    status: 'calendar_added' as const,
    message: 'Shift added to your calendar',
    updatedAt: nowIso(),
  }));
}

async function mapShiftClockAction(
  shiftId: string,
  action: (bookingId: string) => Promise<ApiResult<{ message: string }>>,
  status: WorkerActionResult['status'],
): Promise<ApiResult<WorkerActionResult>> {
  const bookingRes = await resolveBookingIdForShiftInSupabase(shiftId);
  if (!bookingRes.ok) return bookingRes;
  const res = await action(bookingRes.data);
  if (!res.ok) return res;
  return {
    ok: true,
    data: {
      id: bookingRes.data,
      status,
      message: res.data.message,
      updatedAt: nowIso(),
    },
  };
}

// TODO(api): POST /worker/shifts/:shiftId/clock-in
export async function clockInShift(shiftId: string): Promise<ApiResult<WorkerActionResult>> {
  if (getBackendMode() === 'supabase') {
    return mapShiftClockAction(shiftId, clockInBookingInSupabase, 'clocked_in');
  }
  return mockRequest(() => ({
    id: shiftId,
    status: 'clocked_in' as const,
    message: 'Clocked in',
    updatedAt: nowIso(),
  }));
}

// TODO(api): POST /worker/shifts/:shiftId/break/start
export async function startBreak(shiftId: string): Promise<ApiResult<WorkerActionResult>> {
  if (getBackendMode() === 'supabase') {
    return mapShiftClockAction(shiftId, startBreakInSupabase, 'break_started');
  }
  return mockRequest(() => ({
    id: shiftId,
    status: 'break_started' as const,
    message: 'Break started',
    updatedAt: nowIso(),
  }));
}

// TODO(api): POST /worker/shifts/:shiftId/break/end
export async function endBreak(shiftId: string): Promise<ApiResult<WorkerActionResult>> {
  if (getBackendMode() === 'supabase') {
    return mapShiftClockAction(shiftId, endBreakInSupabase, 'break_ended');
  }
  return mockRequest(() => ({
    id: shiftId,
    status: 'break_ended' as const,
    message: 'Break ended',
    updatedAt: nowIso(),
  }));
}

// TODO(api): POST /worker/shifts/:shiftId/clock-out
export async function clockOutShift(shiftId: string): Promise<ApiResult<WorkerActionResult>> {
  if (getBackendMode() === 'supabase') {
    return mapShiftClockAction(shiftId, clockOutBookingInSupabase, 'clocked_out');
  }
  return mockRequest(() => ({
    id: shiftId,
    status: 'clocked_out' as const,
    message: 'Clocked out',
    updatedAt: nowIso(),
  }));
}

// TODO(api): POST /worker/shifts/:shiftId/timesheet
export async function submitTimesheet(shiftId: string): Promise<ApiResult<WorkerActionResult>> {
  if (getBackendMode() === 'supabase') {
    const bookingRes = await resolveBookingIdForShiftInSupabase(shiftId);
    if (!bookingRes.ok) return bookingRes;
    const res = await submitWorkerTimesheetFromSupabase(bookingRes.data);
    if (!res.ok) return res;
    return {
      ok: true,
      data: {
        id: res.data.timesheetId,
        status: 'timesheet_submitted',
        message: res.data.message,
        updatedAt: res.data.submittedAt,
      },
    };
  }
  return mockRequest(() => ({
    id: shiftId,
    status: 'timesheet_submitted' as const,
    message: 'Timesheet submitted',
    updatedAt: nowIso(),
  }));
}

export async function submitSafetyReport(
  _payload: SafetyReportPayload,
): Promise<ApiResult<WorkerActionResult>> {
  return mockRequest(() => {
    void _payload;
    return {
      id: `sr-${Date.now()}`,
      status: 'submitted' as const,
      message: 'Safety report submitted',
      updatedAt: nowIso(),
    };
  });
}

export async function getWorkerById(id: string): Promise<ApiResult<Worker | undefined>> {
  return mockRequest(() => selectWorker(id));
}

// TODO: replace mockRequest with GET /worker/bookings
export async function listWorkerBookings(): Promise<ApiResult<WorkerBookingsPayload>> {
  if (getBackendMode() === 'supabase') {
    return listWorkerBookingsFromSupabase();
  }
  return mockRequest(() => {
    const upcoming: WorkerBookingsPayload['upcoming'] = [];
    const completed: WorkerBookingsPayload['completed'] = [];
    const rows: { section: 'upcoming' | 'completed'; shiftId: string; statusDisplay: string }[] = [
      { section: 'upcoming', shiftId: 'shift-002', statusDisplay: 'Confirmed' },
      { section: 'upcoming', shiftId: 'shift-003', statusDisplay: 'Awaiting approval' },
      { section: 'completed', shiftId: 'shift-005', statusDisplay: 'Completed' },
    ];
    for (const row of rows) {
      const shift = getShiftById(row.shiftId);
      if (!shift) continue;
      const card = { shift, statusDisplay: row.statusDisplay };
      if (row.section === 'upcoming') upcoming.push(card);
      else completed.push(card);
    }
    return { upcoming, completed };
  });
}

export async function getWorkerBookingForShift(
  shiftId: string,
): Promise<ApiResult<{ bookingId: string; status: string } | null>> {
  if (getBackendMode() === 'supabase') {
    const res = await getWorkerBookingForShiftFromSupabase(shiftId);
    if (!res.ok) return res;
    if (!res.data) return { ok: true, data: null };
    return {
      ok: true,
      data: { bookingId: res.data.bookingId, status: res.data.status },
    };
  }
  return mockRequest(() => null);
}

// TODO: replace mockRequest with GET /worker/messages/threads
export async function listWorkerMessages(): Promise<ApiResult<WorkerMessageThreadPreview[]>> {
  return mockRequest(() => [
    {
      id: 'thread-support',
      title: 'Covre Support',
      lastMessage: 'Thanks — your safety report was received.',
      timestamp: 'Yesterday',
      unreadCount: 0,
    },
    {
      id: 'thread-evergreen',
      title: 'Evergreen House',
      lastMessage: 'Parking note updated for tonight’s shift.',
      timestamp: '2:14 PM',
      unreadCount: 1,
    },
    {
      id: 'thread-harbor',
      title: 'Harbor Memory Care',
      lastMessage: 'Please confirm orientation completion.',
      timestamp: 'Mon',
      unreadCount: 0,
    },
    {
      id: 'thread-coordinator',
      title: 'Shift Coordinator',
      lastMessage: 'Reminder: badge required at entrance.',
      timestamp: 'Sat',
      unreadCount: 2,
    },
  ]);
}

export async function getCurrentWorkerProfile(): Promise<ApiResult<WorkerProfileSummary>> {
  if (getBackendMode() === 'supabase') {
    return getCurrentWorkerProfileFromSupabase();
  }
  return mockRequest(() => {
    const w = selectWorker('worker-001');
    return {
      workerId: w?.id ?? 'worker-001',
      fullName: w?.name ?? 'Maya Johnson',
      email: w?.email,
      phone: undefined,
      city: undefined,
      state: undefined,
      roles: w ? [w.primaryRole] : undefined,
      experienceLevel: undefined,
      onboardingComplete: true,
      isSupabaseBacked: false,
    };
  });
}

export async function saveCurrentWorkerProfile(
  draft: WorkerProfileDraft,
): Promise<ApiResult<WorkerProfileSaveResult>> {
  if (getBackendMode() === 'supabase') {
    return saveCurrentWorkerProfileToSupabase(draft);
  }
  return mockRequest(() => ({
    workerId: 'worker-001',
    status: 'saved',
    message: 'Profile saved (demo mode).',
    updatedAt: nowIso(),
  }));
}

export async function completeWorkerProfileOnboarding(
  draft: WorkerProfileDraft,
): Promise<ApiResult<WorkerProfileSaveResult>> {
  if (getBackendMode() === 'supabase') {
    return completeWorkerProfileOnboardingInSupabase(draft);
  }
  return mockRequest(() => ({
    workerId: 'worker-001',
    status: 'complete',
    message: 'Profile complete (demo mode).',
    updatedAt: nowIso(),
  }));
}

export async function getWorkerPayReadiness(): Promise<ApiResult<WorkerPayReadiness>> {
  if (getBackendMode() === 'supabase') {
    return getWorkerPayReadinessFromSupabase();
  }
  return mockRequest(() => ({
    earnings: [],
    payouts: [],
    earningsByStatus: {
      approved: [],
      queued: [],
      held: [],
      paid: [],
      pending: [],
      failed: [],
      cancelled: [],
    },
    payoutsByStatus: {
      prepared: [],
      processing: [],
      paid: [],
      failed: [],
      cancelled: [],
    },
    totals: {
      pendingCents: 0,
      approvedCents: 0,
      queuedCents: 0,
      paidCents: 0,
      heldCents: 0,
    },
    payoutMethodReadiness: {
      status: 'setup_not_connected',
      message: 'Payout setup is not connected yet.',
      actionLabel: 'Payout setup coming soon',
      actionDisabled: true,
      isSetupConnected: false,
      hasActiveMethod: false,
    },
    isSupabaseBacked: false,
    message: 'Earnings readout uses Supabase when configured. Demo balances are shown in mock mode only.',
  }));
}

// TODO: replace mockRequest with GET /worker/account/summary
export async function getWorkerAccount(): Promise<ApiResult<WorkerAccountPayload>> {
  if (getBackendMode() === 'supabase') {
    const res = await getCurrentWorkerProfileFromSupabase();
    if (!res.ok) return res;
    const p = res.data;
    const location =
      p.city && p.state ? `${p.city}, ${p.state}` : p.city ?? p.state ?? undefined;
    return {
      ok: true,
      data: {
        displayName: p.fullName,
        primaryRoleLabel: p.roles?.[0] ?? 'Care worker',
        onboardingComplete: p.onboardingComplete,
        needsOnboarding: !p.onboardingComplete,
        isSupabaseBacked: true,
        phone: p.phone,
        location,
      },
    };
  }
  return mockRequest(() => {
    const w = selectWorker('worker-001');
    return {
      displayName: w?.name ?? 'Maya Johnson',
      primaryRoleLabel: w?.primaryRole ?? 'DSP',
    };
  });
}
