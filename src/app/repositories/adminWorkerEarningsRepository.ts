import type { ApiResult } from "../api/types"
import { getCurrentAdminRoleFromSupabase } from "../auth/supabaseAdminAuth"
import { formatWorkerPayDisplayFromSnapshot } from "../lib/workerRateCents"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  AdminEarningGenerationQueue,
  AdminEarningGenerationRow,
  WorkerEarningGenerationResult,
  WorkerEarningStatus,
} from "../services/types"
import { generateWorkerEarningFromTimesheetInSupabase } from "./workerEarningsRepository"

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Admin earning reads are blocked by database permissions (RLS). Apply admin read-only policies (0016) on your Supabase project."
  }
  if (/PGRST205|does not exist|42P01/i.test(raw)) {
    return "Worker earnings are not available yet. Apply the payment ledger migration first."
  }
  return raw
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function mapEarningStatus(raw: string | undefined): WorkerEarningStatus | undefined {
  if (!raw) return undefined
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
  return undefined
}

async function requireAdminSession(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<ApiResult<{ userId: string }>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return fail("not_authenticated", "Sign in at /auth/admin before generating earnings.")
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

const APPROVED_TIMESHEET_EARNING_SELECT = `
  id,
  status,
  approved_at,
  booking_id,
  bookings!inner (
    id,
    worker_rate_cents_snapshot,
    rate_type_snapshot,
    shifts!inner (
      id,
      starts_at,
      provider_organizations ( id, name ),
      care_sites ( id, name )
    ),
    worker_profiles ( id, headline )
  )
`

type ApprovedTimesheetDbRow = {
  id: string
  status: string
  approved_at: string | null
  booking_id: string
  bookings: {
    id: string
    worker_rate_cents_snapshot: number | null
    rate_type_snapshot: string | null
    shifts: {
      id: string
      starts_at: string
      provider_organizations?: { name: string | null } | { name: string | null }[] | null
      care_sites?: { name: string | null } | { name: string | null }[] | null
    } | {
      id: string
      starts_at: string
      provider_organizations?: { name: string | null } | { name: string | null }[] | null
      care_sites?: { name: string | null } | { name: string | null }[] | null
    }[]
    worker_profiles?: { headline: string | null } | { headline: string | null }[] | null
  } | {
    id: string
    worker_rate_cents_snapshot: number | null
    rate_type_snapshot: string | null
    shifts: {
      id: string
      starts_at: string
      provider_organizations?: { name: string | null } | { name: string | null }[] | null
      care_sites?: { name: string | null } | { name: string | null }[] | null
    } | {
      id: string
      starts_at: string
      provider_organizations?: { name: string | null } | { name: string | null }[] | null
      care_sites?: { name: string | null } | { name: string | null }[] | null
    }[]
    worker_profiles?: { headline: string | null } | { headline: string | null }[] | null
  }[]
}

type WorkerEarningLookupRow = {
  id: string
  status: string
  timesheet_id: string | null
}

function mapApprovedTimesheetRow(
  row: ApprovedTimesheetDbRow,
  earningByTimesheetId: Map<string, WorkerEarningLookupRow>,
): AdminEarningGenerationRow {
  const booking = unwrap(row.bookings)
  const shift = unwrap(booking?.shifts)
  const provider = unwrap(shift?.provider_organizations)
  const site = unwrap(shift?.care_sites)
  const profile = unwrap(booking?.worker_profiles)

  const workerRateSnapshot = booking?.worker_rate_cents_snapshot
  const hasWorkerRateSnapshot =
    workerRateSnapshot != null && workerRateSnapshot >= 0

  const earning = earningByTimesheetId.get(row.id)
  const earningId = earning?.id
  const earningStatus = mapEarningStatus(earning?.status)

  let canGenerate = false
  let blockerReason: string | undefined

  if (earningId) {
    blockerReason = "Earning already generated."
  } else if (row.status !== "approved") {
    blockerReason = "Timesheet must be approved before earning generation."
  } else if (!hasWorkerRateSnapshot) {
    blockerReason = "Worker pay snapshot is missing."
  } else {
    canGenerate = true
  }

  return {
    timesheetId: row.id,
    bookingId: booking?.id ?? row.booking_id,
    workerName: profile?.headline?.trim() || undefined,
    providerName: provider?.name?.trim() || undefined,
    siteName: site?.name?.trim() || undefined,
    shiftStartsAt: shift?.starts_at ?? undefined,
    timesheetStatus: row.status,
    workerPayDisplay: hasWorkerRateSnapshot
      ? formatWorkerPayDisplayFromSnapshot(
          workerRateSnapshot,
          booking?.rate_type_snapshot,
        )
      : undefined,
    hasWorkerRateSnapshot,
    earningId,
    earningStatus,
    canGenerate,
    blockerReason,
  }
}

function buildQueueSummary(rows: AdminEarningGenerationRow[]): AdminEarningGenerationQueue["summary"] {
  let readyToGenerate = 0
  let alreadyGenerated = 0
  let missingRateSnapshot = 0

  for (const row of rows) {
    if (row.earningId) {
      alreadyGenerated += 1
    } else if (!row.hasWorkerRateSnapshot) {
      missingRateSnapshot += 1
    } else if (row.canGenerate) {
      readyToGenerate += 1
    }
  }

  return {
    approvedTimesheets: rows.length,
    readyToGenerate,
    alreadyGenerated,
    missingRateSnapshot,
  }
}

export async function listApprovedTimesheetsForEarningGenerationFromSupabase(): Promise<
  ApiResult<AdminEarningGenerationQueue>
> {
  try {
    const supabase = getSupabaseClient()
    const adminCheck = await requireAdminSession(supabase)
    if (!adminCheck.ok) return adminCheck

    const { data: timesheetData, error: timesheetError } = await supabase
      .from("timesheets")
      .select(APPROVED_TIMESHEET_EARNING_SELECT)
      .eq("status", "approved")
      .order("approved_at", { ascending: false })

    if (timesheetError) {
      return fail(
        "earning_queue_load",
        friendlyDbMessage(timesheetError, "Unable to load approved timesheets."),
      )
    }

    const timesheetRows = (timesheetData ?? []) as ApprovedTimesheetDbRow[]
    const timesheetIds = timesheetRows.map(r => r.id)

    const earningByTimesheetId = new Map<string, WorkerEarningLookupRow>()

    if (timesheetIds.length > 0) {
      const { data: earningRows, error: earningError } = await supabase
        .from("worker_earnings")
        .select("id, status, timesheet_id")
        .in("timesheet_id", timesheetIds)

      if (earningError) {
        return fail(
          "worker_earnings_load",
          friendlyDbMessage(earningError, "Unable to load worker earnings."),
        )
      }

      for (const row of (earningRows ?? []) as WorkerEarningLookupRow[]) {
        if (row.timesheet_id) {
          earningByTimesheetId.set(row.timesheet_id, row)
        }
      }
    }

    const rows = timesheetRows.map(row =>
      mapApprovedTimesheetRow(row, earningByTimesheetId),
    )

    return ok({
      rows,
      summary: buildQueueSummary(rows),
      isSupabaseBacked: true,
      message:
        rows.length === 0
          ? "No approved timesheets are ready for earning generation."
          : undefined,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function generateAdminWorkerEarningFromTimesheetInSupabase(
  timesheetId: string,
): Promise<ApiResult<WorkerEarningGenerationResult>> {
  try {
    const supabase = getSupabaseClient()
    const adminCheck = await requireAdminSession(supabase)
    if (!adminCheck.ok) return adminCheck

    return generateWorkerEarningFromTimesheetInSupabase(timesheetId)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
