import type { ApiResult } from "../api/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  ProviderBookWorkerRpcResult,
  ProviderBookingAcceptResult,
} from "../services/types"

type ProviderMembership = {
  providerId: string
  role: string
}

type ShiftRequestRow = {
  id: string
  shift_id: string
  worker_id: string
  status: string
}

export type ShiftRowForBooking = {
  id: string
  provider_id: string
  status: string
  bill_rate_cents: number | null
  worker_rate_cents: number | null
  currency: string | null
  rate_type: string | null
  platform_fee_cents: number | null
  platform_fee_percent: number | string | null
  rate_policy: Record<string, unknown> | null
}

export type ShiftRatesForBooking = {
  billRateCents: number
  workerRateCents: number
  currency: string
  rateType: string
}

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(err: { message?: string; code?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (/bill_rate_cents|worker_rate_cents|rate_policy|column.*does not exist|42703/i.test(raw)) {
    return "Booking rate enforcement is not available yet. Apply the worker/bill rate migration first."
  }
  if (err.code === "23505" || /duplicate key|unique constraint/i.test(raw)) {
    return "This shift already has a booking."
  }
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Booking is blocked by database permissions (RLS). Apply booking lifecycle policies (0010) on your Supabase project."
  }
  return raw
}

const SCHEDULER_ROLES = new Set(["owner", "admin", "scheduler"])

const BOOKING_RPC_MESSAGE_MAP: Record<string, string> = {
  not_authorized: "You do not have permission to book this worker.",
  shift_not_found: "Shift not found for your organization.",
  shift_not_bookable: "This shift is no longer open for booking.",
  worker_not_found: "Worker not found.",
  request_not_found: "Application not found.",
  request_not_eligible: "This application is no longer eligible for booking.",
  booking_conflict: "This shift already has an active booking.",
  bill_rate_required: "Provider bill rate is required before booking.",
  worker_rate_required:
    "Worker pay rate must be set in Admin → Rate Review before booking.",
  rate_snapshot_failed: "We could not snapshot the booking rates. Please try again.",
}

function friendlyBookingRpcMessage(err: { message?: string }, fallback: string): string {
  const raw = (err.message ?? fallback).trim()
  const token = raw.toLowerCase()
  if (BOOKING_RPC_MESSAGE_MAP[token]) {
    return BOOKING_RPC_MESSAGE_MAP[token]
  }
  if (/function.*does not exist|book_worker_for_shift/i.test(raw)) {
    return "Booking RPC is not available yet. Apply migration 0026 on your Supabase project."
  }
  if (/not authenticated/i.test(raw)) {
    return BOOKING_RPC_MESSAGE_MAP.not_authorized
  }
  return fallback
}

type BookWorkerRpcRow = {
  booking_id?: string
  shift_id?: string
  worker_id?: string
  request_id?: string | null
  status?: string
  bill_rate_cents_snapshot?: number | null
  worker_rate_cents_snapshot?: number | null
  currency_snapshot?: string | null
  rate_type_snapshot?: string | null
  created_at?: string
  idempotent?: boolean
  message?: string
}

function mapBookWorkerRpcResult(row: BookWorkerRpcRow | null): ProviderBookWorkerRpcResult {
  return {
    bookingId: row?.booking_id ?? "",
    shiftId: row?.shift_id ?? "",
    workerId: row?.worker_id ?? "",
    requestId: row?.request_id ?? null,
    status: row?.status ?? "confirmed",
    billRateCentsSnapshot: row?.bill_rate_cents_snapshot ?? null,
    workerRateCentsSnapshot: row?.worker_rate_cents_snapshot ?? null,
    currencySnapshot: row?.currency_snapshot ?? null,
    rateTypeSnapshot: row?.rate_type_snapshot ?? null,
    createdAt: row?.created_at ?? "",
    idempotent: row?.idempotent === true,
    message: row?.message ?? "Booking created",
  }
}

/** Calls book_worker_for_shift RPC — production booking transaction boundary. */
export async function bookWorkerForShiftViaRpc(params: {
  shiftId: string
  workerId: string
  requestId?: string | null
}): Promise<ApiResult<ProviderBookWorkerRpcResult>> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return fail(
        "not_authenticated",
        "Sign in with Supabase before booking a worker.",
      )
    }

    const rpcArgs: {
      target_shift_id: string
      target_worker_id: string
      target_request_id?: string
    } = {
      target_shift_id: params.shiftId,
      target_worker_id: params.workerId,
    }

    if (params.requestId) {
      rpcArgs.target_request_id = params.requestId
    }

    const { data, error } = await supabase.rpc("book_worker_for_shift", rpcArgs)

    if (error) {
      return fail(
        "booking_rpc",
        friendlyBookingRpcMessage(error, "We could not book this worker right now."),
      )
    }

    return ok(mapBookWorkerRpcResult((data ?? null) as BookWorkerRpcRow | null))
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export function validateShiftRatesForBooking(
  shift: ShiftRowForBooking,
): ApiResult<ShiftRatesForBooking> {
  if (shift.bill_rate_cents == null || shift.bill_rate_cents < 0) {
    return fail(
      "bill_rate_required",
      "Provider bill rate is required before booking. Add a provider bill rate before booking.",
    )
  }

  if (shift.worker_rate_cents == null || shift.worker_rate_cents < 0) {
    return fail(
      "worker_rate_required",
      "Worker pay rate must be set by admin before this worker can be booked. Open Admin → Rate Review to set worker pay before booking.",
    )
  }

  const currency = shift.currency?.trim()
  if (!currency) {
    return fail("currency_required", "Shift currency is required before booking.")
  }

  const rateType = shift.rate_type?.trim()
  if (!rateType) {
    return fail("rate_type_required", "Shift rate type is required before booking.")
  }

  return ok({
    billRateCents: shift.bill_rate_cents,
    workerRateCents: shift.worker_rate_cents,
    currency,
    rateType,
  })
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
      "Sign in with Supabase before accepting an applicant.",
    )
  }

  const { data: rows, error } = await supabase
    .from("provider_members")
    .select("provider_id, role")
    .eq("user_id", session.user.id)
    .limit(1)

  if (error) {
    return fail(
      "provider_membership_load",
      friendlyDbMessage(error, "Unable to load provider membership."),
    )
  }

  const row = rows?.[0] as { provider_id: string; role: string } | undefined
  if (!row?.provider_id) {
    return ok(null)
  }

  return ok({ providerId: row.provider_id, role: row.role })
}

export async function acceptProviderShiftApplicantInSupabase(
  requestId: string,
): Promise<ApiResult<ProviderBookingAcceptResult>> {
  try {
    const supabase = getSupabaseClient()
    const membershipRes = await loadProviderMembership(supabase)
    if (!membershipRes.ok) return membershipRes

    if (!membershipRes.data) {
      return fail(
        "provider_membership_required",
        "Complete provider onboarding before accepting applicants.",
      )
    }

    if (!SCHEDULER_ROLES.has(membershipRes.data.role)) {
      return fail("forbidden", BOOKING_RPC_MESSAGE_MAP.not_authorized)
    }

    const { data: requestRow, error: reqErr } = await supabase
      .from("shift_requests")
      .select("id, shift_id, worker_id, status")
      .eq("id", requestId)
      .maybeSingle()

    if (reqErr) {
      return fail(
        "shift_request_load",
        "We could not book this worker right now.",
      )
    }

    if (!requestRow) {
      return fail("not_found", BOOKING_RPC_MESSAGE_MAP.request_not_found)
    }

    const request = requestRow as ShiftRequestRow

    if (request.status !== "requested") {
      return fail(
        "request_not_eligible",
        BOOKING_RPC_MESSAGE_MAP.request_not_eligible,
      )
    }

    const rpcResult = await bookWorkerForShiftViaRpc({
      shiftId: request.shift_id,
      workerId: request.worker_id,
      requestId: request.id,
    })

    if (!rpcResult.ok) {
      return rpcResult
    }

    const booking = rpcResult.data
    return ok({
      bookingId: booking.bookingId,
      shiftId: booking.shiftId,
      workerId: booking.workerId,
      requestId: request.id,
      status: booking.status,
      message: booking.idempotent
        ? "Booking already exists"
        : booking.message || "Booking created",
      createdAt: booking.createdAt || new Date().toISOString(),
    })
  } catch {
    return fail("unexpected", "We could not book this worker right now.")
  }
}
