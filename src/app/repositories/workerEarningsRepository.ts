import type { ApiResult } from "../api/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  WorkerEarningGenerationResult,
  WorkerEarningRow,
  WorkerEarningStatus,
  WorkerPayEarningsGroups,
  WorkerPayPayoutGroups,
  WorkerPayReadiness,
  WorkerPayTotals,
  WorkerPayoutMethodReadiness,
  WorkerPayoutMethodStatus,
  WorkerPayoutRow,
  WorkerPayoutStatus,
} from "../services/types"

type EarningDbRow = {
  id: string
  status: string
  gross_earnings_cents: number
  adjustments_cents: number
  net_earnings_cents: number
  currency: string
  approved_at: string | null
  available_for_payout_at: string | null
  created_at: string
  shift_id: string | null
  booking_id: string | null
  timesheet_id: string | null
  shifts?: ShiftEmbed | ShiftEmbed[] | null
}

type ShiftEmbed = {
  role: string | null
  title: string | null
  provider_organizations?: { name: string | null } | { name: string | null }[] | null
}

type PayoutDbRow = {
  id: string
  status: string
  amount_cents: number
  currency: string
  paid_at: string | null
  created_at: string
}

type PayoutMethodDbRow = {
  id: string
  status: string
  processor: string
  processor_account_id: string | null
  created_at: string
  updated_at: string
}

/**
 * When false, Worker Pay must not invoke payout setup Edge functions or enable the setup button.
 * Covre UI never collects bank/card data — hosted onboarding only after processor integration ships.
 */
const PAYOUT_METHOD_SETUP_CONNECTED = false

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(err: { message?: string; code?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (err.code === "PGRST205" || /does not exist|42P01/i.test(raw)) {
    return "Worker earnings are not available yet. Apply the payment ledger migration first."
  }
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Worker earnings visibility is blocked by database permissions (RLS). Apply payment ledger policies (0023) on your Supabase project."
  }
  return raw
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function mapEarningStatus(raw: string): WorkerEarningStatus {
  if (
    raw === "pending" ||
    raw === "approved" ||
    raw === "held" ||
    raw === "queued" ||
    raw === "paid" ||
    raw === "failed" ||
    raw === "cancelled"
  ) {
    return raw
  }
  return "pending"
}

function mapPayoutStatus(raw: string): WorkerPayoutStatus {
  if (
    raw === "created" ||
    raw === "processing" ||
    raw === "paid" ||
    raw === "failed" ||
    raw === "cancelled"
  ) {
    return raw
  }
  return "created"
}

function mapEarningRow(row: EarningDbRow): WorkerEarningRow {
  const shift = unwrap(row.shifts)
  const org = unwrap(shift?.provider_organizations)
  const providerName = org?.name?.trim() || undefined
  const shiftRole = shift?.role?.trim() || shift?.title?.trim() || undefined

  return {
    id: row.id,
    status: mapEarningStatus(row.status),
    grossEarningsCents: row.gross_earnings_cents ?? 0,
    adjustmentsCents: row.adjustments_cents ?? 0,
    netEarningsCents: row.net_earnings_cents ?? 0,
    currency: row.currency ?? "usd",
    approvedAt: row.approved_at ?? undefined,
    availableForPayoutAt: row.available_for_payout_at ?? undefined,
    createdAt: row.created_at,
    shiftId: row.shift_id ?? undefined,
    bookingId: row.booking_id ?? undefined,
    timesheetId: row.timesheet_id ?? undefined,
    providerName,
    shiftRole,
  }
}

function mapPayoutRow(row: PayoutDbRow, lineCount: number): WorkerPayoutRow {
  return {
    id: row.id,
    status: mapPayoutStatus(row.status),
    amountCents: row.amount_cents ?? 0,
    currency: row.currency ?? "usd",
    paidAt: row.paid_at ?? undefined,
    createdAt: row.created_at,
    lineCount,
  }
}

function emptyEarningsGroups(): WorkerPayEarningsGroups {
  return {
    approved: [],
    queued: [],
    held: [],
    paid: [],
    pending: [],
    failed: [],
    cancelled: [],
  }
}

function emptyPayoutGroups(): WorkerPayPayoutGroups {
  return {
    prepared: [],
    processing: [],
    paid: [],
    failed: [],
    cancelled: [],
  }
}

function groupEarningsByStatus(earnings: WorkerEarningRow[]): WorkerPayEarningsGroups {
  const groups = emptyEarningsGroups()
  for (const row of earnings) {
    groups[row.status].push(row)
  }
  return groups
}

function groupPayoutsByStatus(payouts: WorkerPayoutRow[]): WorkerPayPayoutGroups {
  const groups = emptyPayoutGroups()
  for (const row of payouts) {
    if (row.status === "created") groups.prepared.push(row)
    else if (row.status === "processing") groups.processing.push(row)
    else if (row.status === "paid") groups.paid.push(row)
    else if (row.status === "failed") groups.failed.push(row)
    else if (row.status === "cancelled") groups.cancelled.push(row)
  }
  return groups
}

function computeTotals(earnings: WorkerEarningRow[]): WorkerPayTotals {
  const totals: WorkerPayTotals = {
    pendingCents: 0,
    approvedCents: 0,
    queuedCents: 0,
    paidCents: 0,
    heldCents: 0,
  }

  for (const row of earnings) {
    const cents = row.netEarningsCents
    if (row.status === "pending") totals.pendingCents += cents
    else if (row.status === "approved") totals.approvedCents += cents
    else if (row.status === "queued") totals.queuedCents += cents
    else if (row.status === "paid") totals.paidCents += cents
    else if (row.status === "held") totals.heldCents += cents
  }

  return totals
}

function setupNotConnectedReadiness(): WorkerPayoutMethodReadiness {
  return {
    status: "setup_not_connected",
    message: "Payout setup is not connected yet.",
    actionLabel: "Payout setup coming soon",
    actionDisabled: true,
    isSetupConnected: PAYOUT_METHOD_SETUP_CONNECTED,
    hasActiveMethod: false,
  }
}

function mapPayoutMethodStatus(raw: string): WorkerPayoutMethodStatus {
  if (
    raw === "pending" ||
    raw === "active" ||
    raw === "failed" ||
    raw === "inactive" ||
    raw === "removed"
  ) {
    return raw
  }
  return "pending"
}

function pickPrimaryPayoutMethod(rows: PayoutMethodDbRow[]): PayoutMethodDbRow | null {
  if (rows.length === 0) return null
  const priority: WorkerPayoutMethodStatus[] = [
    "active",
    "pending",
    "failed",
    "inactive",
    "removed",
  ]
  for (const status of priority) {
    const match = rows.find(r => mapPayoutMethodStatus(r.status) === status)
    if (match) return match
  }
  return rows[0] ?? null
}

function mapPayoutMethodReadiness(rows: PayoutMethodDbRow[]): WorkerPayoutMethodReadiness {
  if (rows.length === 0) {
    if (PAYOUT_METHOD_SETUP_CONNECTED) {
      return {
        status: "no_method",
        message: "Add a payout method to receive future payouts.",
        actionLabel: "Set up payout method",
        actionDisabled: false,
        isSetupConnected: true,
        hasActiveMethod: false,
      }
    }
    return setupNotConnectedReadiness()
  }

  const primary = pickPrimaryPayoutMethod(rows)
  if (!primary) {
    return setupNotConnectedReadiness()
  }

  const methodStatus = mapPayoutMethodStatus(primary.status)
  const processor =
    primary.processor && primary.processor !== "external"
      ? primary.processor
      : undefined

  if (methodStatus === "active") {
    return {
      status: "active",
      methodStatus,
      processor,
      message: "Payout method active.",
      actionLabel: "Update payout method",
      actionDisabled: !PAYOUT_METHOD_SETUP_CONNECTED,
      isSetupConnected: PAYOUT_METHOD_SETUP_CONNECTED,
      hasActiveMethod: true,
    }
  }

  if (methodStatus === "pending") {
    return {
      status: "pending",
      methodStatus,
      processor,
      message: "Your payout method is being verified.",
      actionDisabled: true,
      isSetupConnected: PAYOUT_METHOD_SETUP_CONNECTED,
      hasActiveMethod: false,
    }
  }

  if (methodStatus === "failed") {
    return {
      status: "failed",
      methodStatus,
      processor,
      message: "Payout method needs attention.",
      actionLabel: "Update payout method",
      actionDisabled: !PAYOUT_METHOD_SETUP_CONNECTED,
      isSetupConnected: PAYOUT_METHOD_SETUP_CONNECTED,
      hasActiveMethod: false,
    }
  }

  if (methodStatus === "inactive" || methodStatus === "removed") {
    return {
      status: "inactive",
      methodStatus,
      processor,
      message: "Payout method is inactive. Set up a payout method to receive future payouts.",
      actionLabel: "Set up payout method",
      actionDisabled: !PAYOUT_METHOD_SETUP_CONNECTED,
      isSetupConnected: PAYOUT_METHOD_SETUP_CONNECTED,
      hasActiveMethod: false,
    }
  }

  return {
    status: "unknown",
    methodStatus,
    processor,
    message: "Payout method status is unavailable.",
    actionDisabled: true,
    isSetupConnected: PAYOUT_METHOD_SETUP_CONNECTED,
    hasActiveMethod: false,
  }
}

async function loadPayoutMethodReadiness(
  supabase: ReturnType<typeof getSupabaseClient>,
  workerId: string,
): Promise<WorkerPayoutMethodReadiness> {
  const { data, error } = await supabase
    .from("worker_payout_methods")
    .select("id, status, processor, processor_account_id, created_at, updated_at")
    .eq("worker_id", workerId)
    .order("updated_at", { ascending: false })

  if (error) {
    return setupNotConnectedReadiness()
  }

  return mapPayoutMethodReadiness((data ?? []) as PayoutMethodDbRow[])
}

function emptyReadiness(message: string): WorkerPayReadiness {
  return {
    earnings: [],
    payouts: [],
    earningsByStatus: emptyEarningsGroups(),
    payoutsByStatus: emptyPayoutGroups(),
    totals: {
      pendingCents: 0,
      approvedCents: 0,
      queuedCents: 0,
      paidCents: 0,
      heldCents: 0,
    },
    payoutMethodReadiness: setupNotConnectedReadiness(),
    isSupabaseBacked: true,
    message,
  }
}

async function resolveWorkerId(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("worker_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data) return null
  return (data as { id: string }).id
}

function mapRpcEarningGenerationResult(data: Record<string, unknown>): WorkerEarningGenerationResult {
  return {
    earningId: String(data.earning_id ?? ""),
    timesheetId: String(data.timesheet_id ?? ""),
    bookingId: data.booking_id != null ? String(data.booking_id) : undefined,
    shiftId: data.shift_id != null ? String(data.shift_id) : undefined,
    workerId: data.worker_id != null ? String(data.worker_id) : undefined,
    status: String(data.status ?? "approved"),
    grossEarningsCents:
      data.gross_earnings_cents != null ? Number(data.gross_earnings_cents) : undefined,
    adjustmentsCents:
      data.adjustments_cents != null ? Number(data.adjustments_cents) : undefined,
    netEarningsCents: Number(data.net_earnings_cents ?? 0),
    currency: String(data.currency ?? "usd"),
    approvedMinutes:
      data.approved_minutes != null ? Number(data.approved_minutes) : undefined,
    workerRateCentsSnapshot:
      data.worker_rate_cents_snapshot != null
        ? Number(data.worker_rate_cents_snapshot)
        : undefined,
    idempotent: data.idempotent === true,
    message: String(data.message ?? "Worker earning generated."),
  }
}

function friendlyEarningRpcMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  const code = raw.match(/(?:P0001:\s*)?([a-z_]+)/i)?.[1]?.toLowerCase()

  switch (code) {
    case "not_authorized":
      return "You are not authorized to generate earnings."
    case "timesheet_not_found":
      return "Timesheet not found."
    case "timesheet_not_approved":
      return "Timesheet must be approved before earning generation."
    case "booking_not_found":
      return "Booking record is missing."
    case "worker_rate_snapshot_required":
      return "Worker pay snapshot is missing."
    case "invalid_duration":
      return "Timesheet duration is invalid."
    case "earning_calculation_failed":
      return "Could not calculate this earning."
    default:
      if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
        return friendlyDbMessage(err, fallback)
      }
      return "Could not generate earning right now."
  }
}

export async function generateWorkerEarningFromTimesheetInSupabase(
  timesheetId: string,
): Promise<ApiResult<WorkerEarningGenerationResult>> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return fail("not_authenticated", "Sign in before generating worker earnings.")
    }

    const { data, error } = await supabase.rpc("generate_worker_earning_from_timesheet", {
      target_timesheet_id: timesheetId,
    })

    if (error) {
      return fail(
        "earning_generation",
        friendlyEarningRpcMessage(error, "Unable to generate worker earning."),
      )
    }

    if (!data || typeof data !== "object") {
      return fail("earning_generation", "Worker earning RPC returned an empty response.")
    }

    return ok(mapRpcEarningGenerationResult(data as Record<string, unknown>))
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function getWorkerPayReadinessFromSupabase(): Promise<
  ApiResult<WorkerPayReadiness>
> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return ok(
        emptyReadiness("Sign in to view earnings for your worker account."),
      )
    }

    const workerId = await resolveWorkerId(supabase, session.user.id)
    if (!workerId) {
      return ok(
        emptyReadiness(
          "Complete worker profile setup before earnings can be loaded.",
        ),
      )
    }

    const { data: earningRows, error: earningsError } = await supabase
      .from("worker_earnings")
      .select(
        `
        id,
        status,
        gross_earnings_cents,
        adjustments_cents,
        net_earnings_cents,
        currency,
        approved_at,
        available_for_payout_at,
        created_at,
        shift_id,
        booking_id,
        timesheet_id,
        shifts (
          role,
          title,
          provider_organizations ( name )
        )
      `,
      )
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false })

    if (earningsError) {
      return fail(
        "worker_earnings_load",
        friendlyDbMessage(earningsError, "Unable to load worker earnings."),
      )
    }

    const { data: payoutRows, error: payoutsError } = await supabase
      .from("worker_payouts")
      .select("id, status, amount_cents, currency, paid_at, created_at")
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false })

    if (payoutsError) {
      return fail(
        "worker_payouts_load",
        friendlyDbMessage(payoutsError, "Unable to load worker payouts."),
      )
    }

    const payouts = (payoutRows ?? []) as PayoutDbRow[]
    const payoutIds = payouts.map(p => p.id)
    const lineCountByPayout = new Map<string, number>()

    if (payoutIds.length > 0) {
      const { data: lineRows, error: linesError } = await supabase
        .from("worker_payout_lines")
        .select("payout_id")
        .in("payout_id", payoutIds)

      if (linesError) {
        return fail(
          "worker_payout_lines_load",
          friendlyDbMessage(linesError, "Unable to load payout details."),
        )
      }

      for (const line of (lineRows ?? []) as { payout_id: string }[]) {
        lineCountByPayout.set(
          line.payout_id,
          (lineCountByPayout.get(line.payout_id) ?? 0) + 1,
        )
      }
    }

    const payoutMethodReadiness = await loadPayoutMethodReadiness(supabase, workerId)

    const earnings = ((earningRows ?? []) as EarningDbRow[]).map(mapEarningRow)
    const payoutSummaries = payouts.map(p =>
      mapPayoutRow(p, lineCountByPayout.get(p.id) ?? 0),
    )
    const earningsByStatus = groupEarningsByStatus(earnings)
    const payoutsByStatus = groupPayoutsByStatus(payoutSummaries)

    const hasRows = earnings.length > 0 || payoutSummaries.length > 0

    return ok({
      earnings,
      payouts: payoutSummaries,
      earningsByStatus,
      payoutsByStatus,
      totals: computeTotals(earnings),
      payoutMethodReadiness,
      isSupabaseBacked: true,
      message: hasRows
        ? undefined
        : "Earnings will appear here after approved timesheets are converted into worker earnings.",
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
