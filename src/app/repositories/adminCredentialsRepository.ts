import type { ApiResult } from "../api/types"
import { getCurrentAdminRoleFromSupabase } from "../auth/supabaseAdminAuth"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  AdminCredentialReviewActionResult,
  AdminCredentialReviewPayload,
  AdminCredentialReviewRow,
  AdminCredentialReviewStatus,
} from "../services/types"

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Admin credential reads are blocked by database permissions (RLS). Apply admin read-only policies (0016) on your Supabase project."
  }
  if (/42P17|infinite recursion/i.test(raw)) {
    return "Unable to load credential queue due to a database policy issue. Contact ops."
  }
  return raw
}

function friendlyRpcMessage(err: { message?: string }, fallback: string): string {
  const raw = (err.message ?? fallback).trim()
  const lower = raw.toLowerCase()
  if (/only admin users|admin users can verify/i.test(lower)) {
    return "Only admin users can verify credentials."
  }
  if (/rejection reason is required/i.test(lower)) {
    return "Rejection reason is required."
  }
  if (/credential not found|could not be updated|not found/i.test(lower)) {
    return "Credential could not be updated."
  }
  if (/already verified/i.test(lower)) {
    return "This credential is already verified."
  }
  if (/already rejected/i.test(lower)) {
    return "This credential is already rejected."
  }
  if (/not been submitted|missing/i.test(lower)) {
    return "This credential has not been submitted for review."
  }
  if (/function.*does not exist|verify_worker_credential|reject_worker_credential/i.test(lower)) {
    return "Credential verification is not available yet. Apply migration 0020 on your Supabase project."
  }
  if (raw.length > 0 && raw.length < 200) {
    return raw
  }
  return fallback
}

async function requireAdminSession(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<ApiResult<{ userId: string }>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return fail("not_authenticated", "Sign in at /auth/admin before updating credentials.")
  }

  const roleResult = await getCurrentAdminRoleFromSupabase()
  if (!roleResult.ok) {
    return fail(roleResult.error.code, roleResult.error.message)
  }
  if (!roleResult.data.isAdmin) {
    return fail(
      "forbidden",
      roleResult.data.message ?? "This account does not have admin access.",
    )
  }

  return ok({ userId: session.user.id })
}

type RpcCredentialResult = {
  id?: string
  status?: string
  verified_at?: string
  message?: string
}

function mapRpcResult(
  credentialId: string,
  payload: RpcCredentialResult | null,
  fallbackMessage: string,
): AdminCredentialReviewActionResult {
  return {
    credentialId: payload?.id ?? credentialId,
    status: payload?.status ?? "unknown",
    message: payload?.message ?? fallbackMessage,
    updatedAt: payload?.verified_at ?? new Date().toISOString(),
  }
}

const STATUS_SORT: Record<AdminCredentialReviewStatus, number> = {
  pending: 0,
  expiring_soon: 1,
  expired: 2,
  rejected: 3,
  verified: 4,
  missing: 5,
}

function parseReviewStatus(raw: string | null | undefined): AdminCredentialReviewStatus {
  switch (raw) {
    case "pending":
    case "verified":
    case "rejected":
    case "expired":
    case "expiring_soon":
    case "missing":
      return raw
    default:
      return "pending"
  }
}

type WorkerCredentialDbRow = {
  id: string
  worker_id: string
  credential_id: string
  status: string
  expires_at: string | null
  verified_at: string | null
  verified_by: string | null
  created_at: string
  updated_at: string
}

type CredentialDbRow = {
  id: string
  name: string
  credential_type: string | null
}

type WorkerProfileDbRow = {
  id: string
  headline: string | null
  city: string | null
  state: string | null
  user_id: string
}

function workerDisplayName(profile: WorkerProfileDbRow | undefined, workerId: string): string {
  const headline = profile?.headline?.trim()
  if (headline) {
    return headline
  }
  return `Worker ${workerId.slice(0, 8)}`
}

function workerLocation(profile: WorkerProfileDbRow | undefined): string | undefined {
  if (!profile) {
    return undefined
  }
  const city = profile.city?.trim()
  const state = profile.state?.trim()
  if (city && state) {
    return `${city}, ${state}`
  }
  return city || state || undefined
}

function sortRows(rows: AdminCredentialReviewRow[]): AdminCredentialReviewRow[] {
  return [...rows].sort((a, b) => {
    const statusDiff = STATUS_SORT[a.status] - STATUS_SORT[b.status]
    if (statusDiff !== 0) {
      return statusDiff
    }
    const aTime = a.submittedAt ?? a.verifiedAt ?? ""
    const bTime = b.submittedAt ?? b.verifiedAt ?? ""
    return bTime.localeCompare(aTime)
  })
}

function buildPayload(rows: AdminCredentialReviewRow[]): AdminCredentialReviewPayload {
  const pendingCount = rows.filter(
    r => r.status === "pending" || r.status === "expiring_soon",
  ).length
  const verifiedCount = rows.filter(r => r.status === "verified").length
  const rejectedCount = rows.filter(r => r.status === "rejected").length
  const expiredCount = rows.filter(
    r => r.status === "expired" || r.status === "missing",
  ).length

  return {
    rows: sortRows(rows),
    pendingCount,
    verifiedCount,
    rejectedCount,
    expiredCount,
    isSupabaseBacked: true,
  }
}

function mapCredentialRows(
  data: unknown[],
): AdminCredentialReviewRow[] {
  const rows: AdminCredentialReviewRow[] = []

  for (const row of data) {
    const base = row as WorkerCredentialDbRow & {
      credentials?: { name?: string; credential_type?: string | null } | CredentialDbRow | null
      worker_profiles?: WorkerProfileDbRow | null
    }
    const profile = base.worker_profiles ?? undefined
    const catalog =
      base.credentials && "name" in base.credentials ? base.credentials : undefined
    const credentialName =
      catalog?.name?.trim() || `Credential ${base.credential_id.slice(0, 8)}`

    rows.push({
      id: base.id,
      workerId: base.worker_id,
      workerName: workerDisplayName(profile, base.worker_id),
      credentialId: base.credential_id,
      credentialName,
      status: parseReviewStatus(base.status),
      expiresAt: base.expires_at ?? undefined,
      submittedAt: base.updated_at ?? base.created_at,
      verifiedAt: base.verified_at ?? undefined,
      verifiedBy: base.verified_by ?? undefined,
      workerHeadline: profile?.headline?.trim() || undefined,
      workerLocation: workerLocation(profile),
      isSupabaseBacked: true,
    })
  }

  return rows
}

async function loadWithJoins(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<ApiResult<AdminCredentialReviewRow[]>> {
  const { data, error } = await supabase
    .from("worker_credentials")
    .select(
      `
      id,
      worker_id,
      credential_id,
      status,
      expires_at,
      verified_at,
      verified_by,
      created_at,
      updated_at,
      credentials ( name, credential_type ),
      worker_profiles ( headline, city, state, user_id )
    `,
    )
    .order("updated_at", { ascending: false })

  if (error) {
    return fail("worker_credentials_load", friendlyDbMessage(error, "Unable to load credentials."))
  }

  return ok(mapCredentialRows(data ?? []))
}

async function loadWithSeparateQueries(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<ApiResult<AdminCredentialReviewPayload>> {
  const { data: wcRows, error: wcErr } = await supabase
    .from("worker_credentials")
    .select(
      "id, worker_id, credential_id, status, expires_at, verified_at, verified_by, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })

  if (wcErr) {
    return fail("worker_credentials_load", friendlyDbMessage(wcErr, "Unable to load credentials."))
  }

  const credentials = (wcRows ?? []) as WorkerCredentialDbRow[]
  if (credentials.length === 0) {
    return ok(buildPayload([]))
  }

  const credentialIds = [...new Set(credentials.map(c => c.credential_id))]
  const workerIds = [...new Set(credentials.map(c => c.worker_id))]

  const [{ data: catalogRows, error: catalogErr }, { data: profileRows, error: profileErr }] =
    await Promise.all([
      supabase.from("credentials").select("id, name, credential_type").in("id", credentialIds),
      supabase
        .from("worker_profiles")
        .select("id, headline, city, state, user_id")
        .in("id", workerIds),
    ])

  if (catalogErr) {
    return fail("credentials_load", friendlyDbMessage(catalogErr, "Unable to load credential catalog."))
  }
  if (profileErr) {
    return fail("worker_profiles_load", friendlyDbMessage(profileErr, "Unable to load worker profiles."))
  }

  const catalogById = new Map(
    ((catalogRows ?? []) as CredentialDbRow[]).map(c => [c.id, c]),
  )
  const profileById = new Map(
    ((profileRows ?? []) as WorkerProfileDbRow[]).map(p => [p.id, p]),
  )

  const rows: AdminCredentialReviewRow[] = credentials.map(wc => {
    const catalog = catalogById.get(wc.credential_id)
    const profile = profileById.get(wc.worker_id)
    return {
      id: wc.id,
      workerId: wc.worker_id,
      workerName: workerDisplayName(profile, wc.worker_id),
      credentialId: wc.credential_id,
      credentialName: catalog?.name?.trim() || `Credential ${wc.credential_id.slice(0, 8)}`,
      status: parseReviewStatus(wc.status),
      expiresAt: wc.expires_at ?? undefined,
      submittedAt: wc.updated_at ?? wc.created_at,
      verifiedAt: wc.verified_at ?? undefined,
      verifiedBy: wc.verified_by ?? undefined,
      workerHeadline: profile?.headline?.trim() || undefined,
      workerLocation: workerLocation(profile),
      isSupabaseBacked: true,
    }
  })

  return ok(buildPayload(rows))
}

export async function verifyAdminWorkerCredentialInSupabase(
  credentialId: string,
  note?: string,
): Promise<ApiResult<AdminCredentialReviewActionResult>> {
  try {
    const supabase = getSupabaseClient()
    const sessionResult = await requireAdminSession(supabase)
    if (!sessionResult.ok) {
      return sessionResult
    }

    const { data, error } = await supabase.rpc("verify_worker_credential", {
      target_credential_id: credentialId,
      review_note: note?.trim() || null,
    })

    if (error) {
      return fail(
        "credential_verify",
        friendlyRpcMessage(error, "Credential could not be updated."),
      )
    }

    return ok(
      mapRpcResult(credentialId, (data ?? null) as RpcCredentialResult | null, "Credential verified"),
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function rejectAdminWorkerCredentialInSupabase(
  credentialId: string,
  reason: string,
): Promise<ApiResult<AdminCredentialReviewActionResult>> {
  const trimmed = reason.trim()
  if (!trimmed) {
    return fail("validation", "Rejection reason is required.")
  }

  try {
    const supabase = getSupabaseClient()
    const sessionResult = await requireAdminSession(supabase)
    if (!sessionResult.ok) {
      return sessionResult
    }

    const { data, error } = await supabase.rpc("reject_worker_credential", {
      target_credential_id: credentialId,
      rejection_reason: trimmed,
    })

    if (error) {
      return fail(
        "credential_reject",
        friendlyRpcMessage(error, "Credential could not be updated."),
      )
    }

    return ok(
      mapRpcResult(credentialId, (data ?? null) as RpcCredentialResult | null, "Credential rejected"),
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function listAdminCredentialReviewQueueFromSupabase(): Promise<
  ApiResult<AdminCredentialReviewPayload>
> {
  try {
    const supabase = getSupabaseClient()
    const sessionResult = await requireAdminSession(supabase)
    if (!sessionResult.ok) {
      return sessionResult
    }

    const joined = await loadWithJoins(supabase)
    if (joined.ok) {
      return ok(buildPayload(joined.data))
    }

    return loadWithSeparateQueries(supabase)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
