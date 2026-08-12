import type { ApiResult } from "../api/types"
import { getCurrentAdminRoleFromSupabase } from "../auth/supabaseAdminAuth"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  AdminRateActionResult,
  AdminWorkerRateReviewQueue,
  AdminWorkerRateReviewRow,
  AdminWorkerRateReviewStatus,
} from "../services/types"

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (/bill_rate_cents|worker_rate_cents|column.*does not exist|42703/i.test(raw)) {
    return "Worker-rate review is not available yet. Apply the worker/bill rate migration first."
  }
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Admin rate reads are blocked by database permissions (RLS). Apply admin read-only policies (0016) on your Supabase project."
  }
  return raw
}

const RATE_RPC_MESSAGE_MAP: Record<string, string> = {
  not_authorized: "Only admin users can change shift rates.",
  reason_required: "A reason is required for this rate change.",
  shift_not_found: "Shift could not be found.",
  rate_locked: "Rates are locked on this shift.",
  booked_shift_rate_locked:
    "This shift has an active booking. Rate changes are blocked until booking is cancelled or an override RPC exists.",
  bill_rate_required: "Bill rate must be set before locking rates.",
  worker_rate_required: "Worker rate must be set before locking rates.",
  invalid_rate: "Rate amount must be zero or greater.",
}

function friendlyRateRpcMessage(err: { message?: string }, fallback: string): string {
  const raw = (err.message ?? fallback).trim()
  const token = raw.toLowerCase()
  if (RATE_RPC_MESSAGE_MAP[token]) {
    return RATE_RPC_MESSAGE_MAP[token]
  }
  if (/function.*does not exist|set_shift_worker_rate|update_shift_bill_rate|lock_shift_rates|unlock_shift_rates/i.test(raw)) {
    return "Admin rate RPCs are not available yet. Apply migration 0025 on your Supabase project."
  }
  if (/only admin users|not authenticated/i.test(raw)) {
    return RATE_RPC_MESSAGE_MAP.not_authorized
  }
  if (raw.length > 0 && raw.length < 200) {
    return raw
  }
  return fallback
}

type RpcShiftRateResult = {
  id?: string
  worker_rate_cents?: number | null
  bill_rate_cents?: number | null
  rates_locked_at?: string | null
  rates_updated_at?: string | null
  message?: string
}

async function requireAdminSession(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<ApiResult<{ userId: string }>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return fail("not_authenticated", "Sign in at /auth/admin before changing rates.")
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

function mapShiftRateRpcResult(
  shiftId: string,
  data: RpcShiftRateResult | null,
  fallbackMessage: string,
): AdminRateActionResult {
  return {
    shiftId: data?.id ?? shiftId,
    billRateCents: data?.bill_rate_cents ?? undefined,
    workerRateCents: data?.worker_rate_cents ?? undefined,
    ratesLockedAt: data?.rates_locked_at ?? undefined,
    ratesUpdatedAt: data?.rates_updated_at ?? undefined,
    message: data?.message?.trim() || fallbackMessage,
  }
}

function validateNonnegativeCents(
  cents: number,
  label: string,
): ApiResult<never> | null {
  if (!Number.isFinite(cents) || cents < 0) {
    return fail("validation", `${label} must be zero or greater.`)
  }
  return null
}

type ProviderEmbed = { id: string; name: string | null }
type SiteEmbed = { id: string; name: string | null }

type ShiftRateRow = {
  id: string
  provider_id: string
  site_id: string
  role: string | null
  title: string | null
  status: string
  starts_at: string
  is_urgent: boolean
  bill_rate_cents: number | null
  worker_rate_cents: number | null
  currency: string | null
  rate_type: string | null
  rates_locked_at: string | null
  rates_updated_at: string | null
  created_at: string
  provider_organizations: ProviderEmbed | ProviderEmbed[] | null
  care_sites: SiteEmbed | SiteEmbed[] | null
}

function unwrap<T>(embed: T | T[] | null): T | null {
  if (!embed) return null
  return Array.isArray(embed) ? embed[0] ?? null : embed
}

function deriveReviewStatus(row: {
  bill_rate_cents: number | null
  worker_rate_cents: number | null
  rates_locked_at: string | null
}): AdminWorkerRateReviewStatus {
  if (row.rates_locked_at) return "locked"
  if (row.worker_rate_cents == null) return "missing_worker_rate"
  if (row.bill_rate_cents == null) return "missing_bill_rate"
  return "rate_ready"
}

function roleLabel(row: ShiftRateRow): string {
  return row.role?.trim() || row.title?.trim() || "Shift"
}

function sortRows(rows: AdminWorkerRateReviewRow[]): AdminWorkerRateReviewRow[] {
  return [...rows].sort((a, b) => {
    const aMissingWorker = a.status === "missing_worker_rate" ? 0 : 1
    const bMissingWorker = b.status === "missing_worker_rate" ? 0 : 1
    if (aMissingWorker !== bMissingWorker) return aMissingWorker - bMissingWorker

    const aStarts = Date.parse(a.startsAt ?? "")
    const bStarts = Date.parse(b.startsAt ?? "")
    const aStartValid = Number.isFinite(aStarts)
    const bStartValid = Number.isFinite(bStarts)
    if (aStartValid && bStartValid && aStarts !== bStarts) return aStarts - bStarts
    if (aStartValid && !bStartValid) return -1
    if (!aStartValid && bStartValid) return 1

    const aCreated = Date.parse(a.createdAt ?? "")
    const bCreated = Date.parse(b.createdAt ?? "")
    if (Number.isFinite(aCreated) && Number.isFinite(bCreated) && aCreated !== bCreated) {
      return bCreated - aCreated
    }
    return 0
  })
}

function buildSummary(rows: AdminWorkerRateReviewRow[]): AdminWorkerRateReviewQueue["summary"] {
  return {
    missingWorkerRate: rows.filter(r => r.status === "missing_worker_rate").length,
    missingBillRate: rows.filter(r => r.status === "missing_bill_rate").length,
    ready: rows.filter(r => r.status === "rate_ready").length,
    locked: rows.filter(r => r.status === "locked").length,
  }
}

export async function listAdminWorkerRateReviewQueueFromSupabase(): Promise<
  ApiResult<AdminWorkerRateReviewQueue>
> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return fail("not_authenticated", "Sign in at /auth/admin before loading rate review.")
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

    const { data: rows, error } = await supabase
      .from("shifts")
      .select(
        `
        id,
        provider_id,
        site_id,
        role,
        title,
        status,
        starts_at,
        is_urgent,
        bill_rate_cents,
        worker_rate_cents,
        currency,
        rate_type,
        rates_locked_at,
        rates_updated_at,
        created_at,
        provider_organizations ( id, name ),
        care_sites ( id, name )
      `,
      )
      .order("starts_at", { ascending: true })
      .limit(500)

    if (error) {
      return fail(
        "shifts_rate_load",
        friendlyDbMessage(error, "Unable to load shifts for rate review."),
      )
    }

    const mapped = ((rows ?? []) as ShiftRateRow[]).map((row): AdminWorkerRateReviewRow => {
      const provider = unwrap(row.provider_organizations)
      const site = unwrap(row.care_sites)
      const reviewStatus = deriveReviewStatus(row)
      return {
        id: row.id,
        shiftId: row.id,
        providerId: row.provider_id,
        providerName: provider?.name?.trim() || undefined,
        siteName: site?.name?.trim() || undefined,
        role: roleLabel(row),
        status: reviewStatus,
        startsAt: row.starts_at,
        billRateCents: row.bill_rate_cents ?? undefined,
        workerRateCents: row.worker_rate_cents ?? undefined,
        currency: row.currency?.trim() || "usd",
        rateType: row.rate_type?.trim() || "hourly",
        shiftStatus: row.status,
        isUrgent: row.is_urgent,
        createdAt: row.created_at,
        ratesLockedAt: row.rates_locked_at ?? undefined,
        ratesUpdatedAt: row.rates_updated_at ?? undefined,
        isSupabaseBacked: true,
      }
    })

    const sorted = sortRows(mapped)

    return ok({
      rows: sorted,
      summary: buildSummary(sorted),
      isSupabaseBacked: true,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function setAdminShiftWorkerRateInSupabase(
  shiftId: string,
  workerRateCents: number,
  reason: string,
): Promise<ApiResult<AdminRateActionResult>> {
  const trimmed = reason.trim()
  if (!trimmed) {
    return fail("validation", RATE_RPC_MESSAGE_MAP.reason_required)
  }
  const centsError = validateNonnegativeCents(workerRateCents, "Worker rate")
  if (centsError) {
    return centsError
  }

  try {
    const supabase = getSupabaseClient()
    const sessionResult = await requireAdminSession(supabase)
    if (!sessionResult.ok) {
      return sessionResult
    }

    const { data, error } = await supabase.rpc("set_shift_worker_rate", {
      target_shift_id: shiftId,
      next_worker_rate_cents: Math.round(workerRateCents),
      reason: trimmed,
    })

    if (error) {
      return fail(
        "set_worker_rate",
        friendlyRateRpcMessage(error, "Worker rate could not be updated."),
      )
    }

    return ok(
      mapShiftRateRpcResult(shiftId, (data ?? null) as RpcShiftRateResult | null, "Worker rate updated"),
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function updateAdminShiftBillRateInSupabase(
  shiftId: string,
  billRateCents: number,
  reason: string,
): Promise<ApiResult<AdminRateActionResult>> {
  const trimmed = reason.trim()
  if (!trimmed) {
    return fail("validation", RATE_RPC_MESSAGE_MAP.reason_required)
  }
  const centsError = validateNonnegativeCents(billRateCents, "Bill rate")
  if (centsError) {
    return centsError
  }

  try {
    const supabase = getSupabaseClient()
    const sessionResult = await requireAdminSession(supabase)
    if (!sessionResult.ok) {
      return sessionResult
    }

    const { data, error } = await supabase.rpc("update_shift_bill_rate", {
      target_shift_id: shiftId,
      next_bill_rate_cents: Math.round(billRateCents),
      reason: trimmed,
    })

    if (error) {
      return fail(
        "update_bill_rate",
        friendlyRateRpcMessage(error, "Bill rate could not be updated."),
      )
    }

    return ok(
      mapShiftRateRpcResult(shiftId, (data ?? null) as RpcShiftRateResult | null, "Bill rate updated"),
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function lockAdminShiftRatesInSupabase(
  shiftId: string,
  reason: string,
): Promise<ApiResult<AdminRateActionResult>> {
  const trimmed = reason.trim()
  if (!trimmed) {
    return fail("validation", RATE_RPC_MESSAGE_MAP.reason_required)
  }

  try {
    const supabase = getSupabaseClient()
    const sessionResult = await requireAdminSession(supabase)
    if (!sessionResult.ok) {
      return sessionResult
    }

    const { data, error } = await supabase.rpc("lock_shift_rates", {
      target_shift_id: shiftId,
      reason: trimmed,
    })

    if (error) {
      return fail(
        "lock_shift_rates",
        friendlyRateRpcMessage(error, "Shift rates could not be locked."),
      )
    }

    return ok(
      mapShiftRateRpcResult(shiftId, (data ?? null) as RpcShiftRateResult | null, "Shift rates locked"),
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function unlockAdminShiftRatesInSupabase(
  shiftId: string,
  reason: string,
): Promise<ApiResult<AdminRateActionResult>> {
  const trimmed = reason.trim()
  if (!trimmed) {
    return fail("validation", RATE_RPC_MESSAGE_MAP.reason_required)
  }

  try {
    const supabase = getSupabaseClient()
    const sessionResult = await requireAdminSession(supabase)
    if (!sessionResult.ok) {
      return sessionResult
    }

    const { data, error } = await supabase.rpc("unlock_shift_rates", {
      target_shift_id: shiftId,
      reason: trimmed,
    })

    if (error) {
      return fail(
        "unlock_shift_rates",
        friendlyRateRpcMessage(error, "Shift rates could not be unlocked."),
      )
    }

    return ok(
      mapShiftRateRpcResult(shiftId, (data ?? null) as RpcShiftRateResult | null, "Shift rates unlocked"),
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
