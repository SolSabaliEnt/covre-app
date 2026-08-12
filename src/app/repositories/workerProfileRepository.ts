import type { ApiResult } from "../api/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  WorkerProfileDraft,
  WorkerProfileSaveResult,
  WorkerProfileSummary,
} from "../services/types"

type WorkerProfileDraftMeta = {
  roles?: string[]
  availability?: string
  experienceLevel?: string
}

type UserProfileRow = {
  id: string
  display_name: string
  email: string | null
  phone: string | null
  primary_role: string
}

type WorkerProfileRow = {
  id: string
  user_id: string
  headline: string | null
  city: string | null
  state: string | null
  status: string
  updated_at: string
}

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyAuthOrDbMessage(err: { message?: string; code?: string }): string {
  const raw = err.message ?? "Unable to save worker profile."
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Saving is blocked by database permissions (RLS). Use mock mode or confirm worker profile policies are applied in Supabase."
  }
  return raw
}

function draftFromMetadata(meta: Record<string, unknown>): Partial<WorkerProfileDraft> {
  const stored = meta.worker_profile_draft as WorkerProfileDraftMeta | undefined
  if (!stored) return {}
  return {
    roles: stored.roles,
    availability: stored.availability,
    experienceLevel: stored.experienceLevel,
  }
}

function buildSummary(
  sessionUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
  userRow: UserProfileRow | null,
  workerRow: WorkerProfileRow | null,
): WorkerProfileSummary {
  const meta = sessionUser.user_metadata ?? {}
  const draftMeta = draftFromMetadata(meta)
  const fullName =
    userRow?.display_name?.trim() ||
    (typeof meta.full_name === "string" ? meta.full_name.trim() : "") ||
    sessionUser.email?.split("@")[0] ||
    "Care worker"

  return {
    workerId: workerRow?.id ?? "",
    fullName,
    email: userRow?.email ?? sessionUser.email ?? undefined,
    phone: userRow?.phone ?? (typeof meta.phone === "string" ? meta.phone : undefined),
    city: workerRow?.city ?? undefined,
    state: workerRow?.state ?? undefined,
    roles: draftMeta.roles,
    experienceLevel: draftMeta.experienceLevel ?? workerRow?.headline ?? undefined,
    onboardingComplete: Boolean(meta.worker_onboarding_complete),
    isSupabaseBacked: true,
  }
}

async function requireSession() {
  const supabase = getSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return { supabase, session: null as const }
  }
  return { supabase, session }
}

async function loadProfileRows(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
): Promise<{ userRow: UserProfileRow | null; workerRow: WorkerProfileRow | null }> {
  const [{ data: userRow }, { data: workerRow }] = await Promise.all([
    supabase.from("user_profiles").select("id, display_name, email, phone, primary_role").eq("id", userId).maybeSingle(),
    supabase
      .from("worker_profiles")
      .select("id, user_id, headline, city, state, status, updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
  ])
  return {
    userRow: (userRow as UserProfileRow | null) ?? null,
    workerRow: (workerRow as WorkerProfileRow | null) ?? null,
  }
}

function validateDraft(draft: WorkerProfileDraft, requireComplete: boolean): ApiResult<never> | null {
  if (!draft.fullName?.trim()) {
    return fail("validation", "Full name is required.")
  }
  if (requireComplete && (!draft.roles?.length)) {
    return fail("validation", "Select at least one role you are interested in.")
  }
  return null
}

async function persistProfile(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
  email: string | undefined,
  draft: WorkerProfileDraft,
  markComplete: boolean,
): Promise<ApiResult<WorkerProfileSaveResult>> {
  const validationError = validateDraft(draft, markComplete)
  if (validationError) return validationError

  const fullName = draft.fullName.trim()
  const phone = draft.phone?.trim() || null
  const city = draft.city?.trim() || null
  const state = draft.state?.trim() || null
  const headline = draft.experienceLevel?.trim() || null
  const draftMeta: WorkerProfileDraftMeta = {
    roles: draft.roles,
    availability: draft.availability?.trim() || undefined,
    experienceLevel: draft.experienceLevel?.trim() || undefined,
  }

  const { error: userErr } = await supabase.from("user_profiles").upsert(
    {
      id: userId,
      display_name: fullName,
      email: email ?? null,
      phone,
      primary_role: "worker",
    },
    { onConflict: "id" },
  )
  if (userErr) {
    return fail("user_profile_upsert", friendlyAuthOrDbMessage(userErr))
  }

  const { data: existingWorker } = await supabase
    .from("worker_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  const workerPayload = {
    user_id: userId,
    headline,
    city,
    state,
    status: markComplete ? "active" : "pending",
  }

  let workerId: string
  if (existingWorker?.id) {
    const { data: updated, error: workerErr } = await supabase
      .from("worker_profiles")
      .update(workerPayload)
      .eq("user_id", userId)
      .select("id, updated_at")
      .single()
    if (workerErr || !updated) {
      return fail("worker_profile_update", friendlyAuthOrDbMessage(workerErr ?? { message: "Unknown error" }))
    }
    workerId = updated.id as string
    const updatedAt = (updated.updated_at as string) ?? new Date().toISOString()
    const { error: metaErr } = await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        phone,
        role: "worker",
        worker_profile_draft: markComplete ? null : draftMeta,
        ...(markComplete ? { worker_onboarding_complete: true } : {}),
      },
    })
    if (metaErr) {
      return fail("auth_update_failed", friendlyAuthOrDbMessage(metaErr))
    }
    return ok({
      workerId,
      status: markComplete ? "complete" : "saved",
      message: markComplete ? "Worker profile saved. You can browse shifts." : "Profile draft saved.",
      updatedAt,
    })
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("worker_profiles")
    .insert(workerPayload)
    .select("id, updated_at")
    .single()
  if (insertErr || !inserted) {
    return fail("worker_profile_insert", friendlyAuthOrDbMessage(insertErr ?? { message: "Unknown error" }))
  }
  workerId = inserted.id as string
  const updatedAt = (inserted.updated_at as string) ?? new Date().toISOString()

  const { error: metaErr } = await supabase.auth.updateUser({
    data: {
      full_name: fullName,
      phone,
      role: "worker",
      worker_profile_draft: markComplete ? null : draftMeta,
      ...(markComplete ? { worker_onboarding_complete: true } : {}),
    },
  })
  if (metaErr) {
    return fail("auth_update_failed", friendlyAuthOrDbMessage(metaErr))
  }

  return ok({
    workerId,
    status: markComplete ? "complete" : "saved",
    message: markComplete ? "Worker profile saved. You can browse shifts." : "Profile draft saved.",
    updatedAt,
  })
}

export async function getCurrentWorkerProfileFromSupabase(): Promise<ApiResult<WorkerProfileSummary>> {
  try {
    const { supabase, session } = await requireSession()
    if (!session) {
      return fail(
        "not_authenticated",
        "Sign in with Supabase before setting up your worker profile.",
      )
    }

    const { userRow, workerRow } = await loadProfileRows(supabase, session.user.id)
    return ok(buildSummary(session.user, userRow, workerRow))
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function saveCurrentWorkerProfileToSupabase(
  draft: WorkerProfileDraft,
): Promise<ApiResult<WorkerProfileSaveResult>> {
  try {
    const { supabase, session } = await requireSession()
    if (!session) {
      return fail(
        "not_authenticated",
        "Sign in with Supabase before setting up your worker profile.",
      )
    }
    return persistProfile(supabase, session.user.id, session.user.email, draft, false)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function completeWorkerProfileOnboardingInSupabase(
  draft: WorkerProfileDraft,
): Promise<ApiResult<WorkerProfileSaveResult>> {
  try {
    const { supabase, session } = await requireSession()
    if (!session) {
      return fail(
        "not_authenticated",
        "Sign in with Supabase before setting up your worker profile.",
      )
    }
    return persistProfile(supabase, session.user.id, session.user.email, draft, true)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
