import type { ApiResult } from "../api/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  WorkerShiftRequestResult,
  WorkerShiftRequestSummary,
} from "../services/types"

type WorkerProfileRow = { id: string }

type ShiftRequestRow = {
  id: string
  shift_id: string
  worker_id: string
  status: string
  created_at: string
}

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(err: { message?: string; code?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (err.code === "23505" || /duplicate key|unique constraint/i.test(raw)) {
    return "You already applied for this shift."
  }
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Applying is blocked by database permissions (RLS). Apply worker shift request policies (0008) on your Supabase project."
  }
  return raw
}

async function resolveWorkerProfileId(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
): Promise<ApiResult<string>> {
  const { data, error } = await supabase
    .from("worker_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    return fail("worker_profile_load", friendlyDbMessage(error, "Unable to load worker profile."))
  }

  const workerId = (data as WorkerProfileRow | null)?.id
  if (!workerId) {
    return fail(
      "worker_profile_required",
      "Complete your worker profile before applying for shifts.",
    )
  }

  return ok(workerId)
}

export async function submitWorkerShiftRequestToSupabase(
  shiftId: string,
): Promise<ApiResult<WorkerShiftRequestResult>> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return fail(
        "not_authenticated",
        "Sign in with Supabase before applying for shifts.",
      )
    }

    const profileRes = await resolveWorkerProfileId(supabase, session.user.id)
    if (!profileRes.ok) return profileRes
    const workerId = profileRes.data

    const { data: shift, error: shiftErr } = await supabase
      .from("shifts")
      .select("id, status")
      .eq("id", shiftId)
      .eq("status", "open")
      .maybeSingle()

    if (shiftErr) {
      return fail("shift_load", friendlyDbMessage(shiftErr, "Unable to verify shift."))
    }

    if (!shift) {
      return fail("shift_not_open", "This shift is not open for applications.")
    }

    const { data: existing } = await supabase
      .from("shift_requests")
      .select("id, status, created_at")
      .eq("shift_id", shiftId)
      .eq("worker_id", workerId)
      .maybeSingle()

    if (existing) {
      const row = existing as ShiftRequestRow
      const active = row.status === "requested" || row.status === "accepted"
      return ok({
        requestId: row.id,
        shiftId,
        status: "already_submitted",
        message: "You already applied for this shift.",
        createdAt: row.created_at,
      })
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("shift_requests")
      .insert({
        shift_id: shiftId,
        worker_id: workerId,
        status: "requested",
      })
      .select("id, created_at")
      .single()

    if (insertErr) {
      if (insertErr.code === "23505") {
        return ok({
          shiftId,
          status: "already_submitted",
          message: "You already applied for this shift.",
          createdAt: new Date().toISOString(),
        })
      }
      return fail("shift_request_insert", friendlyDbMessage(insertErr, "Unable to submit application."))
    }

    const row = inserted as { id: string; created_at: string }
    return ok({
      requestId: row.id,
      shiftId,
      status: "submitted",
      message: "Application sent",
      createdAt: row.created_at,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function listCurrentWorkerShiftRequestsFromSupabase(): Promise<
  ApiResult<WorkerShiftRequestSummary[]>
> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return fail(
        "not_authenticated",
        "Sign in with Supabase before applying for shifts.",
      )
    }

    const profileRes = await resolveWorkerProfileId(supabase, session.user.id)
    if (!profileRes.ok) {
      if (profileRes.error.code === "worker_profile_required") {
        return ok([])
      }
      return profileRes
    }
    const workerId = profileRes.data

    const { data: rows, error } = await supabase
      .from("shift_requests")
      .select("id, shift_id, status, created_at")
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false })

    if (error) {
      return fail(
        "shift_requests_load",
        friendlyDbMessage(error, "Unable to load your applications."),
      )
    }

    const summaries: WorkerShiftRequestSummary[] = ((rows ?? []) as ShiftRequestRow[]).map(r => ({
      requestId: r.id,
      shiftId: r.shift_id,
      status: r.status,
      submittedAt: r.created_at,
    }))

    return ok(summaries)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function withdrawWorkerShiftRequestFromSupabase(
  requestId: string,
): Promise<ApiResult<WorkerShiftRequestResult>> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return fail(
        "not_authenticated",
        "Sign in with Supabase before applying for shifts.",
      )
    }

    const profileRes = await resolveWorkerProfileId(supabase, session.user.id)
    if (!profileRes.ok) return profileRes
    const workerId = profileRes.data

    const { data: row, error: loadErr } = await supabase
      .from("shift_requests")
      .select("id, shift_id, status, created_at")
      .eq("id", requestId)
      .eq("worker_id", workerId)
      .maybeSingle()

    if (loadErr) {
      return fail("shift_request_load", friendlyDbMessage(loadErr, "Unable to load application."))
    }

    if (!row) {
      return fail("not_found", "Application not found.")
    }

    const existing = row as ShiftRequestRow
    if (existing.status === "withdrawn") {
      return ok({
        requestId: existing.id,
        shiftId: existing.shift_id,
        status: "withdrawn",
        message: "Application already withdrawn.",
        createdAt: existing.created_at,
      })
    }

    if (existing.status !== "requested") {
      return fail(
        "cannot_withdraw",
        "Only pending applications can be withdrawn.",
      )
    }

    const { error: updateErr } = await supabase
      .from("shift_requests")
      .update({ status: "withdrawn" })
      .eq("id", requestId)
      .eq("worker_id", workerId)

    if (updateErr) {
      return fail(
        "shift_request_withdraw",
        friendlyDbMessage(updateErr, "Unable to withdraw application."),
      )
    }

    return ok({
      requestId: existing.id,
      shiftId: existing.shift_id,
      status: "withdrawn",
      message: "Application withdrawn",
      createdAt: existing.created_at,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
