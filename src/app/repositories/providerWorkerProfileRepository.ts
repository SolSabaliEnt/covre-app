import type { ApiResult } from '../api/types';
import { getSupabaseClient } from '../lib/supabaseClient';
import type {
  ProviderWorkerCredential,
  ProviderWorkerProfile,
  ProviderWorkerRecentShift,
  ProviderWorkerSiteFamiliarity,
} from '../services/types';

type WorkerProfileRow = {
  id: string;
  user_id: string;
  headline: string | null;
  city: string | null;
  state: string | null;
  status: string;
};

type UserProfileRow = {
  display_name: string | null;
};

type CredentialEmbed = {
  id: string;
  name: string;
  credential_type: string | null;
};

type WorkerCredentialRow = {
  credential_id: string;
  status: string;
  credentials: CredentialEmbed | CredentialEmbed[] | null;
};

type SiteContinuityRow = {
  site_id: string;
  site_name: string;
  approved_shift_count: number;
};

type ProviderContinuityRow = {
  approved_shift_count: number;
  distinct_site_count: number;
  first_worked_at: string;
  last_worked_at: string;
};

type ShiftEmbed = {
  id: string;
  provider_id: string;
  site_id: string;
  title: string | null;
  role: string | null;
  starts_at: string;
  ends_at: string;
  care_sites: { id: string; name: string } | Array<{ id: string; name: string }> | null;
};

type ApprovedWorkRow = {
  id: string;
  approved_at: string | null;
  bookings:
    | {
        shift_id: string;
        worker_id: string;
        shifts: ShiftEmbed | ShiftEmbed[] | null;
      }
    | Array<{
        shift_id: string;
        worker_id: string;
        shifts: ShiftEmbed | ShiftEmbed[] | null;
      }>
    | null;
};

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } };
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function friendlyDbMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback;
  if (/worker_site_continuity_v1|worker_provider_continuity_v1|relation .* does not exist/i.test(raw)) {
    return 'Provider worker history requires the Covre continuity read-model migration.';
  }
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return 'Worker profile access is blocked by database permissions (RLS). Providers may only read worker data permitted for their organization.';
  }
  return raw;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3) || 'CW';
}

function formatLocation(row: WorkerProfileRow): string {
  return [row.city?.trim(), row.state?.trim()].filter(Boolean).join(', ') || 'Location not shared';
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${start.toLocaleTimeString(undefined, options)} – ${end.toLocaleTimeString(undefined, options)}`;
}

function mapCredentials(rows: WorkerCredentialRow[]): ProviderWorkerCredential[] {
  return rows
    .map(row => {
      const credential = unwrap(row.credentials);
      if (!credential) return null;
      return {
        id: credential.id,
        name: credential.name,
        category: credential.credential_type ?? 'Credential',
        verified: row.status === 'verified',
      } satisfies ProviderWorkerCredential;
    })
    .filter((row): row is ProviderWorkerCredential => Boolean(row));
}

function mapRecentWork(rows: ApprovedWorkRow[]): ProviderWorkerRecentShift[] {
  const recent: ProviderWorkerRecentShift[] = [];
  for (const row of rows) {
    const booking = unwrap(row.bookings);
    if (!booking) continue;
    const shift = unwrap(booking.shifts);
    if (!shift) continue;
    const site = unwrap(shift.care_sites);
    recent.push({
      shiftId: shift.id,
      siteName: site?.name?.trim() || 'Care site',
      roleTitle: shift.title?.trim() || shift.role?.trim() || 'Shift',
      dateLabel: formatDateLabel(shift.starts_at),
      timeRange: formatTimeRange(shift.starts_at, shift.ends_at),
    });
  }
  return recent.slice(0, 5);
}

/**
 * Provider-facing worker profile built from real Supabase metadata plus approved-work continuity.
 * No Covre score, preferred-worker badge, on-time score, or repeat-request score is synthesized here.
 */
export async function getProviderWorkerProfileFromSupabase(
  providerId: string,
  workerId: string,
): Promise<ApiResult<ProviderWorkerProfile | null>> {
  try {
    if (!isUuid(workerId)) return ok(null);

    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return fail('not_authenticated', 'Sign in before loading a worker profile.');

    const { data: workerData, error: workerError } = await supabase
      .from('worker_profiles')
      .select('id, user_id, headline, city, state, status')
      .eq('id', workerId)
      .maybeSingle();

    if (workerError) {
      return fail('worker_profile_load', friendlyDbMessage(workerError, 'Unable to load worker profile.'));
    }
    if (!workerData) return ok(null);
    const worker = workerData as WorkerProfileRow;

    const [providerContinuityRes, siteContinuityRes, userProfileRes, credentialRes, recentWorkRes] =
      await Promise.all([
        supabase
          .from('worker_provider_continuity_v1')
          .select('approved_shift_count, distinct_site_count, first_worked_at, last_worked_at')
          .eq('provider_id', providerId)
          .eq('worker_id', workerId)
          .maybeSingle(),
        supabase
          .from('worker_site_continuity_v1')
          .select('site_id, site_name, approved_shift_count')
          .eq('provider_id', providerId)
          .eq('worker_id', workerId)
          .order('approved_shift_count', { ascending: false }),
        supabase
          .from('user_profiles')
          .select('display_name')
          .eq('id', worker.user_id)
          .maybeSingle(),
        supabase
          .from('worker_credentials')
          .select('credential_id, status, credentials(id, name, credential_type)')
          .eq('worker_id', workerId),
        supabase
          .from('timesheets')
          .select(
            `
            id,
            approved_at,
            bookings!inner (
              shift_id,
              worker_id,
              shifts!inner (
                id,
                provider_id,
                site_id,
                title,
                role,
                starts_at,
                ends_at,
                care_sites ( id, name )
              )
            )
          `,
          )
          .eq('status', 'approved')
          .eq('bookings.worker_id', workerId)
          .eq('bookings.shifts.provider_id', providerId)
          .order('approved_at', { ascending: false })
          .limit(5),
      ]);

    if (providerContinuityRes.error) {
      return fail(
        'provider_worker_continuity_load',
        friendlyDbMessage(providerContinuityRes.error, 'Unable to load shared work history.'),
      );
    }
    if (siteContinuityRes.error) {
      return fail(
        'provider_worker_site_continuity_load',
        friendlyDbMessage(siteContinuityRes.error, 'Unable to load shared site history.'),
      );
    }

    const providerContinuity = providerContinuityRes.data as ProviderContinuityRow | null;
    const siteRows = (siteContinuityRes.data ?? []) as SiteContinuityRow[];
    const userProfile = userProfileRes.error ? null : (userProfileRes.data as UserProfileRow | null);
    const credentials = credentialRes.error
      ? []
      : mapCredentials((credentialRes.data ?? []) as WorkerCredentialRow[]);
    const recentShifts = recentWorkRes.error
      ? []
      : mapRecentWork((recentWorkRes.data ?? []) as unknown as ApprovedWorkRow[]);

    const siteFamiliarity: ProviderWorkerSiteFamiliarity[] = siteRows.map(row => ({
      siteId: row.site_id,
      siteName: row.site_name,
      shiftCount: row.approved_shift_count,
    }));

    const roles = [...new Set(recentShifts.map(row => row.roleTitle).filter(Boolean))];
    const name =
      userProfile?.display_name?.trim() ||
      worker.headline?.trim() ||
      'Care worker';
    const approvedShiftsTogether = providerContinuity?.approved_shift_count ?? 0;

    return ok({
      id: worker.id,
      name,
      roles: roles.length > 0 ? roles : [worker.headline?.trim() || 'Care worker'],
      location: formatLocation(worker),
      initials: initialsFromName(name),
      covreScore: 0,
      isVerified: false,
      isPreferredBench: false,
      credentials,
      reliability: {
        completedShifts: approvedShiftsTogether,
        onTimeRatePct: 0,
        repeatRequests: 0,
      },
      siteFamiliarity,
      recentShifts,
      providerNotes:
        'Provider notes are not connected to the Supabase worker profile yet. Shared work history above is derived only from approved timesheets.',
    });
  } catch (error) {
    return fail('unexpected', error instanceof Error ? error.message : 'Request failed.');
  }
}
