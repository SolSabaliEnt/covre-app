/**
 * Referral / affiliate ledger (mock). Mutates in-memory `referralLedger` for admin actions.
 * TODO(api): replace mockRequest with HTTP — keep Promise<ApiResult<…>> exports stable.
 */
import type { ApiResult } from '../api/types';
import { mockRequest } from '../api/mockApi';
import { getBackendMode } from '../lib/backendMode';
import {
  copyProviderReferralLinkFromSupabase,
  getProviderReferralDashboardFromSupabase,
} from '../repositories/providerReferralRepository';
import type {
  ReferralActionResult,
  ReferralDashboard,
  ReferralInvitePayload,
  ReferralRecord,
  ReferralStatus,
  ReferralTrack,
} from './types';
import {
  PROVIDER_REFERRAL_LINK,
  PROVIDER_REFERRAL_TIERS,
  SEED_REFERRAL_RECORDS,
  WORKER_REFERRAL_LINK,
  WORKER_REFERRAL_TIERS,
} from '../data/referrals';

function nowIso(): string {
  return new Date().toISOString();
}

let referralLedger: ReferralRecord[] = SEED_REFERRAL_RECORDS.map(r => ({ ...r }));

const PIPELINE_PENDING: ReferralStatus[] = ['invited', 'signed_up', 'first_shift_completed'];

function sumRewards(records: ReferralRecord[], statuses: ReferralStatus[]): number {
  return records.filter(r => statuses.includes(r.status)).reduce((acc, r) => acc + r.rewardAmount, 0);
}

function buildWorkerDashboard(workerId?: string): ReferralDashboard {
  const wid = workerId ?? 'worker-001';
  const records = referralLedger.filter(
    r => r.track === 'worker_to_provider' && r.referrerId === wid,
  );
  return {
    referralLink: WORKER_REFERRAL_LINK,
    totalPending: sumRewards(records, PIPELINE_PENDING),
    totalQualified: sumRewards(records, ['qualified']),
    totalPaidOrCredited: sumRewards(records, ['paid', 'credited']),
    tiers: WORKER_REFERRAL_TIERS,
    records: records.map(r => ({ ...r })),
  };
}

function buildProviderDashboard(providerId?: string): ReferralDashboard {
  const pid = providerId ?? 'provider-001';
  const records = referralLedger.filter(
    r => r.track === 'provider_to_provider' && r.referrerId === pid,
  );
  return {
    referralLink: PROVIDER_REFERRAL_LINK,
    totalPending: sumRewards(records, PIPELINE_PENDING),
    totalQualified: sumRewards(records, ['qualified']),
    totalPaidOrCredited: sumRewards(records, ['paid', 'credited']),
    tiers: PROVIDER_REFERRAL_TIERS,
    records: records.map(r => ({ ...r })),
  };
}

export async function getWorkerReferralDashboard(workerId?: string): Promise<ApiResult<ReferralDashboard>> {
  return mockRequest(() => buildWorkerDashboard(workerId));
}

export async function getProviderReferralDashboard(providerId?: string): Promise<ApiResult<ReferralDashboard>> {
  if (getBackendMode() === 'supabase') {
    void providerId;
    return getProviderReferralDashboardFromSupabase();
  }
  return mockRequest(() => buildProviderDashboard(providerId));
}

export async function listAdminReferrals(): Promise<ApiResult<ReferralRecord[]>> {
  return mockRequest(() => referralLedger.map(r => ({ ...r })));
}

export async function createReferralInvite(payload: ReferralInvitePayload): Promise<ApiResult<ReferralRecord>> {
  return mockRequest(() => {
    const id = `ref-${Date.now()}`;
    const isWorker = payload.track === 'worker_to_provider';
    const referrerId = isWorker ? 'worker-001' : 'provider-001';
    const referrerName = isWorker ? 'Maya Johnson' : 'Evergreen Residential Care';
    const link = isWorker ? WORKER_REFERRAL_LINK : PROVIDER_REFERRAL_LINK;
    const rewardType = isWorker ? ('cash' as const) : ('shift_credit' as const);
    const row: ReferralRecord = {
      id,
      track: payload.track,
      referrerId,
      referrerName,
      referredOrganization: payload.referredOrganization,
      referredContact: payload.referredContact,
      facilityType: payload.facilityType,
      status: 'invited',
      rewardAmount: isWorker ? 300 : 200,
      rewardType,
      referralLink: link,
      createdAt: nowIso(),
    };
    referralLedger = [...referralLedger, row];
    return row;
  });
}

export async function copyReferralLink(
  referrerId: string,
  track: ReferralTrack,
): Promise<ApiResult<ReferralActionResult>> {
  if (getBackendMode() === 'supabase' && track === 'provider_to_provider') {
    void referrerId;
    return copyProviderReferralLinkFromSupabase();
  }
  void referrerId;
  void track;
  return mockRequest(() => ({
    id: `copy-${Date.now()}`,
    status: 'ready',
    message: 'Referral link copied',
    updatedAt: nowIso(),
  }));
}

export async function approveReferralReward(referralId: string): Promise<ApiResult<ReferralActionResult>> {
  return mockRequest(() => {
    const idx = referralLedger.findIndex(r => r.id === referralId);
    if (idx === -1) {
      throw new Error('Referral not found');
    }
    const row = referralLedger[idx];
    if (row.status !== 'qualified') {
      throw new Error('Only qualified referrals can be approved for payout.');
    }
    const nextStatus = row.rewardType === 'cash' ? ('paid' as const) : ('credited' as const);
    const updated: ReferralRecord = {
      ...row,
      status: nextStatus,
      qualifiedAt: row.qualifiedAt ?? nowIso(),
    };
    referralLedger = referralLedger.map((r, i) => (i === idx ? updated : r));
    return {
      id: referralId,
      status: nextStatus,
      message:
        nextStatus === 'paid'
          ? 'Reward marked paid (demo — no funds moved).'
          : 'Shift credits recorded (demo — no billing run).',
      updatedAt: nowIso(),
    };
  });
}

export async function markReferralIneligible(referralId: string): Promise<ApiResult<ReferralActionResult>> {
  return mockRequest(() => {
    const idx = referralLedger.findIndex(r => r.id === referralId);
    if (idx === -1) {
      throw new Error('Referral not found');
    }
    const row = referralLedger[idx];
    const updated: ReferralRecord = { ...row, status: 'ineligible' };
    referralLedger = referralLedger.map((r, i) => (i === idx ? updated : r));
    return {
      id: referralId,
      status: 'ineligible',
      message: 'Referral marked ineligible.',
      updatedAt: nowIso(),
    };
  });
}
