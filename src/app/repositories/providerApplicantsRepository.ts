import type { ApiResult } from "../api/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  ProviderShiftApplicant,
  ProviderShiftApplicantStatus,
  ProviderShiftApplicantsResult,
} from "../services/types"
import type {
  ProviderShiftApplicantReview,
  ProviderShiftApplicantReviewResult,
} from "../services/providerApplicantReviewTypes"
import type { ProviderShiftInvitationStatus } from "./providerShiftInvitationsRepository"

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

type InvitationRow = {
  id: string
  shift_id: string
  worker_id: string
  status: string
  created_at: string
  updated_at: string
  resolved_at: string | null
  resolution_reason: string | null
}

type WorkerProfileRow = {
  id: string
  headline: string | null
  city: string | null
  state: string | null
}

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(err: { message?: string; code?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (/resolved_at|resolution_reason|column.*does not exist|42703/i.test(raw)) {
    return "Terminal coverage reconciliation requires the Covre Slice 19 migration."
  }
  if (/provider_shift_invitations|relation .*does not exist/i.test(raw)) {
    return "Invitation-aware applicant review requires the Covre provider shift invitation migration."
  }
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Loading applicants is blocked by database permissions (RLS). Apply provider applicant review policies on your Supabase project."
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

async function verifyShiftOwnership(
  supabase: ReturnType<typeof getSupabaseClient>,
  providerId: string,
  shiftId: string,
): Promise<ApiResult<true>> {
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

  return ok(true)
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

    const ownership = await verifyShiftOwnership(supabase, membershipRes.data.providerId, shiftId)
    if (!ownership.ok) return ownership

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
          ? "Applicant review is connected."
          : undefined,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

/**
 * Canonical provider review feed for one shift. Invitation state is overlaid on the normal
 * shift_request lifecycle; accepted invitations are still confirmed through the existing booking
 * transaction rather than a parallel invitation-booking path.
 */
export async function listProviderShiftApplicantReviewFromSupabase(
  shiftId: string,
): Promise<ApiResult<ProviderShiftApplicantReviewResult>> {
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
    const ownership = await verifyShiftOwnership(supabase, providerId, shiftId)
    if (!ownership.ok) return ownership

    const [requestRes, invitationRes] = await Promise.all([
      supabase
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
        .order("created_at", { ascending: false }),
      supabase
        .from("provider_shift_invitations")
        .select("id, shift_id, worker_id, status, created_at, updated_at, resolved_at, resolution_reason")
        .eq("provider_id", providerId)
        .eq("shift_id", shiftId)
        .order("created_at", { ascending: false }),
    ])

    if (requestRes.error) {
      return fail(
        "shift_requests_load",
        friendlyDbMessage(requestRes.error, "Unable to load applications."),
      )
    }
    if (invitationRes.error) {
      return fail(
        "shift_invitations_load",
        friendlyDbMessage(invitationRes.error, "Unable to load shift invitations."),
      )
    }

    const requestRows = (requestRes.data ?? []) as ShiftRequestRow[]
    const invitationRows = (invitationRes.data ?? []) as InvitationRow[]
    const requestByWorker = new Map(requestRows.map(row => [row.worker_id, row]))
    const invitationByWorker = new Map(invitationRows.map(row => [row.worker_id, row]))
    const workerIds = [...new Set([...requestByWorker.keys(), ...invitationByWorker.keys()])]

    let profileByWorker = new Map<string, WorkerProfileRow>()
    const requestProfiles = requestRows
      .map(row => row.worker_profiles)
      .filter((row): row is WorkerProfileRow => Boolean(row?.id))
    profileByWorker = new Map(requestProfiles.map(row => [row.id, row]))

    const missingWorkerIds = workerIds.filter(workerId => !profileByWorker.has(workerId))
    if (missingWorkerIds.length > 0) {
      const { data: profileRows, error: profileErr } = await supabase
        .from("worker_profiles")
        .select("id, headline, city, state")
        .in("id", missingWorkerIds)

      if (profileErr) {
        return fail(
          "worker_profiles_load",
          friendlyDbMessage(profileErr, "Unable to load invited worker profiles."),
        )
      }

      for (const row of (profileRows ?? []) as WorkerProfileRow[]) {
        profileByWorker.set(row.id, row)
      }
    }

    const applicants: ProviderShiftApplicantReview[] = workerIds.map(workerId => {
      const request = requestByWorker.get(workerId)
      const invitation = invitationByWorker.get(workerId)
      const profile = profileByWorker.get(workerId)
      const requestStatus = request ? mapApplicantStatus(request.status) : undefined

      let reviewState: ProviderShiftApplicantReview["reviewState"] = "applied"
      if (requestStatus === "accepted") reviewState = "booked"
      else if (invitation?.resolution_reason === "shift_covered_elsewhere") reviewState = "covered_elsewhere"
      else if (requestStatus === "withdrawn") reviewState = "withdrawn"
      else if (requestStatus === "rejected") reviewState = invitation?.resolution_reason ? "covered_elsewhere" : "declined"
      else if (invitation?.status === "accepted") reviewState = "invited_accepted"
      else if (invitation && (invitation.status === "pending" || invitation.status === "viewed")) reviewState = "invited"
      else if (invitation?.status === "withdrawn" && invitation.resolution_reason === "shift_covered") reviewState = "covered_elsewhere"
      else if (invitation?.status === "declined") reviewState = "declined"
      else if (invitation?.status === "withdrawn") reviewState = "withdrawn"

      return {
        requestId: request?.id,
        shiftId,
        workerId,
        workerName: profile?.headline?.trim() || "Care worker",
        workerRole: profile?.headline?.trim() || undefined,
        workerLocation: formatLocation(profile?.city, profile?.state),
        requestStatus,
        submittedAt: request?.created_at,
        invitation: invitation
          ? {
              invitationId: invitation.id,
              status: invitation.status as ProviderShiftInvitationStatus,
              invitedAt: invitation.created_at,
              updatedAt: invitation.updated_at,
              resolvedAt: invitation.resolved_at ?? undefined,
              resolutionReason: invitation.resolution_reason ?? undefined,
            }
          : undefined,
        reviewState,
        isSupabaseBacked: true,
      }
    })

    const stateWeight: Record<ProviderShiftApplicantReview["reviewState"], number> = {
      booked: 0,
      invited_accepted: 1,
      applied: 2,
      invited: 3,
      covered_elsewhere: 4,
      withdrawn: 5,
      declined: 6,
    }
    applicants.sort((a, b) => stateWeight[a.reviewState] - stateWeight[b.reviewState])

    const hasBooked = applicants.some(applicant => applicant.reviewState === "booked")
    return ok({
      shiftId,
      applicants,
      canConfirmBookings: !hasBooked,
      message:
        hasBooked
          ? "Coverage is secured. Competing pending applications and invitations were closed automatically."
          : applicants.length > 0
            ? "Invitations and applications are shown together. Worker acceptance still requires provider booking confirmation."
            : undefined,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
