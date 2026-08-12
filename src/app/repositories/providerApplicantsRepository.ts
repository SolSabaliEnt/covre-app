import type { ApiResult } from "../api/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  ProviderShiftApplicant,
  ProviderShiftApplicantStatus,
  ProviderShiftApplicantsResult,
} from "../services/types"

type ProviderMembership = { providerId: string }

type ShiftRequestRow = {
  id: string
  shift_id: string
  worker_id: string
  status: string
  created_at: string
  worker_profiles: {
    id: string
    headline: string | null
    city: string | null
    state: string | null
  } | null
}

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(err: { message?: string; code?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Loading applicants is blocked by database permissions (RLS). Apply provider applicant review policies (0009) on your Supabase project."
  }
  return raw
}

function mapApplicantStatus(dbStatus: string): ProviderShiftApplicantStatus {
  if (dbStatus === "declined") return "rejected"
  if (
    dbStatus === "requested" ||
    dbStatus === "withdrawn" ||
    dbStatus === "accepted"
  ) {
    return dbStatus
  }
  return "requested"
}

function formatLocation(city: string | null | undefined, state: string | null | undefined): string | undefined {
  const parts = [city, state].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : undefined
}

async function loadProviderMembership(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<ApiResult<ProviderMembership | null>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return fail(
      "not_authenticated",
      "Sign in with Supabase before loading applicants.",
    )
  }

  const { data: rows, error } = await supabase
    .from("provider_members")
    .select("provider_id")
    .eq("user_id", session.user.id)
    .limit(1)

  if (error) {
    return fail(
      "provider_membership_load",
      friendlyDbMessage(error, "Unable to load provider membership."),
    )
  }

  const row = rows?.[0] as { provider_id: string } | undefined
  if (!row?.provider_id) {
    return ok(null)
  }

  return ok({ providerId: row.provider_id })
}

function rowToApplicant(row: ShiftRequestRow): ProviderShiftApplicant {
  const wp = row.worker_profiles
  const workerRole = wp?.headline?.trim() || undefined
  const workerLocation = formatLocation(wp?.city, wp?.state)

  return {
    requestId: row.id,
    shiftId: row.shift_id,
    workerId: row.worker_id,
    workerName: wp?.headline?.trim() || "Care worker",
    workerRole,
    workerLocation,
    status: mapApplicantStatus(row.status),
    submittedAt: row.created_at,
    isSupabaseBacked: true,
  }
}

export async function listProviderShiftApplicantsFromSupabase(
  shiftId: string,
): Promise<ApiResult<ProviderShiftApplicantsResult>> {
  try {
    const supabase = getSupabaseClient()
    const membershipRes = await loadProviderMembership(supabase)
    if (!membershipRes.ok) return membershipRes

    if (!membershipRes.data) {
      return fail(
        "provider_membership_required",
        "Complete provider onboarding before viewing applicants.",
      )
    }

    const { providerId } = membershipRes.data

    const { data: shift, error: shiftErr } = await supabase
      .from("shifts")
      .select("id, provider_id")
      .eq("id", shiftId)
      .eq("provider_id", providerId)
      .maybeSingle()

    if (shiftErr) {
      return fail("shift_load", friendlyDbMessage(shiftErr, "Unable to verify shift."))
    }

    if (!shift) {
      return fail("shift_not_found", "Shift not found for your organization.")
    }

    const { data: rows, error: reqErr } = await supabase
      .from("shift_requests")
      .select(
        `
        id,
        shift_id,
        worker_id,
        status,
        created_at,
        worker_profiles (
          id,
          headline,
          city,
          state
        )
      `,
      )
      .eq("shift_id", shiftId)
      .order("created_at", { ascending: false })

    if (reqErr) {
      return fail(
        "shift_requests_load",
        friendlyDbMessage(reqErr, "Unable to load applications."),
      )
    }

    const applicants = ((rows ?? []) as ShiftRequestRow[]).map(rowToApplicant)

    return ok({
      shiftId,
      applicants,
      isReadOnly: true,
      message:
        applicants.length > 0
          ? "Applicant review is connected. Booking acceptance comes next."
          : undefined,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
