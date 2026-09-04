import type { ApiResult } from "../api/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  ProviderTimesheetActionResult,
  ProviderTimesheetBookingReadinessRow,
  ProviderTimesheetReadinessRow,
  ProviderTimesheetReadinessSummary,
  ProviderTimesheetReviewRow,
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
    return "Timesheet actions are blocked by database permissions (RLS). Apply booking (0010), clock/timesheet (0012), and provider approval (0013) on your Supabase project."
  }
  return raw
}

const PROVIDER_TIMESHEET_ROLES = new Set(["owner", "admin", "scheduler"])

type ProviderMembership = {
  providerId: string
  role: string
  userId: string
}

type CareSiteEmbed = {
  id: string
  name: string
}

type ShiftEmbed = {
  id: string
  provider_id: string
  site_id: string
  title: string | null
  role: string | null
  starts_at: string
  ends_at: string
  status: string
  care_sites: CareSiteEmbed | CareSiteEmbed[] | null
}

type WorkerProfileEmbed = {
  id: string
  headline: string | null
}

type BookingTimesheetRow = {
  id: string
  shift_id: string
  worker_id: string
  status: string
  shifts: ShiftEmbed | ShiftEmbed[] | null
  worker_profiles: WorkerProfileEmbed | WorkerProfileEmbed[] | null
}

type TimesheetEmbedRow = {
  id: string
  booking_id: string
  clock_in_at: string | null
  clock_out_at: string | null
  break_minutes: number
  status: string
  submitted_at: string | null
  approved_at: string | null
  bookings: {
    id: string
    shift_id: string
    worker_id: string
    shifts: ShiftEmbed | ShiftEmbed[] | null
    worker_profiles: WorkerProfileEmbed | WorkerProfileEmbed[] | null
  } | null
}

const BOOKING_MISSING_ITEMS = [
  "Clock-in / clock-out events",
  "Worker-submitted timesheet",
  "Provider approval",
] as const

function unwrap<T>(embed: T | T[] | null): T | null {
  if (!embed) return null
  return Array.isArray(embed) ? embed[0] ?? null : embed
}

function formatDateLabel(startsAt: string): string {
  const start = new Date(startsAt)
  if (Number.isNaN(start.getTime())) return "—"
  const now = new Date()
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (startDay.getTime() === today.getTime()) return "Today"
  if (startDay.getTime() === tomorrow.getTime()) return "Tomorrow"
  return start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function formatTimeRange(startsAt: string, endsAt: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—"
  return `${start.toLocaleTimeString("en-US", opts)} - ${end.toLocaleTimeString("en-US", opts)}`
}

function shiftTitleFromRow(shift: ShiftEmbed): string {
  return shift.title?.trim() || shift.role?.trim() || "Shift"
}

function workerNameFromEmbed(embed: WorkerProfileEmbed | null): string {
  const headline = embed?.headline?.trim()
  if (headline) return headline
  return "Booked worker"
}

function calculateHours(
  clockIn: string | null,
  clockOut: string | null,
  breakMinutes: number,
): number {
  if (!clockIn || !clockOut) return 0
  const start = Date.parse(clockIn)
  const end = Date.parse(clockOut)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  const hours = (end - start) / (1000 * 60 * 60) - breakMinutes / 60
  return Math.max(0, Math.round(hours * 100) / 100)
}

function mapBookingToReadinessRow(row: BookingTimesheetRow): ProviderTimesheetBookingReadinessRow | null {
  const shift = unwrap(row.shifts)
  if (!shift) return null

  const site = unwrap(shift.care_sites)
  const workerProfile = unwrap(row.worker_profiles)
  const shiftTitle = shiftTitleFromRow(shift)
  const dateLabel = formatDateLabel(shift.starts_at)
  const timeRange = formatTimeRange(shift.starts_at, shift.ends_at)

  return {
    bookingId: row.id,
    shiftId: row.shift_id,
    workerId: row.worker_id,
    workerName: workerNameFromEmbed(workerProfile),
    shiftTitle,
    siteName: site?.name?.trim() || "Care site",
    shiftDate: `${dateLabel} · ${timeRange}`,
    status: "pending_clock_events",
    statusLabel: "Pending clock events",
    missingItems: [...BOOKING_MISSING_ITEMS],
    isSimulated: false,
  }
}

function toSummaryRow(row: ProviderTimesheetBookingReadinessRow): ProviderTimesheetReadinessRow {
  return {
    id: `timesheet-booking-${row.bookingId}`,
    bookingId: row.bookingId,
    shiftId: row.shiftId,
    workerId: row.workerId,
    shiftTitle: row.shiftTitle,
    siteName: row.siteName,
    shiftDate: row.shiftDate,
    workerName: row.workerName,
    hours: row.hours,
    status: row.status,
    statusLabel: row.statusLabel,
    isSimulated: row.isSimulated,
    missingItems: row.missingItems,
  }
}

function mapTimesheetToReviewRow(row: TimesheetEmbedRow): ProviderTimesheetReviewRow | null {
  const booking = row.bookings
  if (!booking) return null
  const shift = unwrap(booking.shifts)
  if (!shift) return null

  const site = unwrap(shift.care_sites)
  const workerProfile = unwrap(booking.worker_profiles)
  const dateLabel = formatDateLabel(shift.starts_at)
  const timeRange = formatTimeRange(shift.starts_at, shift.ends_at)

  return {
    timesheetId: row.id,
    bookingId: row.booking_id,
    shiftId: booking.shift_id,
    workerId: booking.worker_id,
    workerName: workerNameFromEmbed(workerProfile),
    shiftTitle: shiftTitleFromRow(shift),
    siteName: site?.name?.trim() || "Care site",
    shiftDate: `${dateLabel} · ${timeRange}`,
    hours: calculateHours(row.clock_in_at, row.clock_out_at, row.break_minutes ?? 0),
    status: row.status,
    submittedAt: row.submitted_at ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    isSupabaseBacked: true,
  }
}

async function loadProviderMembership(): Promise<ApiResult<ProviderMembership | null>> {
  const supabase = getSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return fail("not_authenticated", "Sign in with Supabase before loading timesheets.")
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

  return ok({
    providerId: row.provider_id,
    role: row.role,
    userId: session.user.id,
  })
}

function assertCanReviewTimesheets(membership: ProviderMembership): ApiResult<void> | null {
  if (!PROVIDER_TIMESHEET_ROLES.has(membership.role)) {
    return fail(
      "forbidden",
      "Only owners, admins, and schedulers can approve or dispute timesheets.",
    )
  }
  return null
}

const TIMESHEET_REVIEW_SELECT = `
  id,
  booking_id,
  clock_in_at,
  clock_out_at,
  break_minutes,
  status,
  submitted_at,
  approved_at,
  bookings!inner (
    id,
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
      status,
      care_sites ( id, name )
    ),
    worker_profiles ( id, headline )
  )
`

async function verifySubmittedTimesheet(
  supabase: ReturnType<typeof getSupabaseClient>,
  timesheetId: string,
  providerId: string,
): Promise<
  ApiResult<{ id: string; status: string; booking_id: string }>
> {
  const { data, error } = await supabase
    .from("timesheets")
    .select("id, status, booking_id")
    .eq("id", timesheetId)
    .maybeSingle()

  if (error) {
    return fail("timesheet_load", friendlyDbMessage(error, "Unable to load timesheet."))
  }
  if (!data) {
    return fail("timesheet_not_found", "Timesheet not found.")
  }

  const row = data as { id: string; status: string; booking_id: string }
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, shifts!inner ( provider_id )")
    .eq("id", row.booking_id)
    .eq("shifts.provider_id", providerId)
    .maybeSingle()

  if (bookingError) {
    return fail("timesheet_scope", friendlyDbMessage(bookingError, "Unable to verify timesheet."))
  }
  if (!booking) {
    return fail("timesheet_not_found", "Timesheet not found for your organization.")
  }

  return ok(row)
}

export async function approveProviderTimesheetInSupabase(
  timesheetId: string,
): Promise<ApiResult<ProviderTimesheetActionResult>> {
  try {
    const membershipResult = await loadProviderMembership()
    if (!membershipResult.ok) return membershipResult
    if (!membershipResult.data) {
      return fail("no_provider", "Join or create a provider organization before approving timesheets.")
    }

    const forbidden = assertCanReviewTimesheets(membershipResult.data)
    if (forbidden && !forbidden.ok) return forbidden

    const supabase = getSupabaseClient()
    const verifyResult = await verifySubmittedTimesheet(
      supabase,
      timesheetId,
      membershipResult.data.providerId,
    )
    if (!verifyResult.ok) return verifyResult

    const timesheet = verifyResult.data
    if (timesheet.status !== "submitted") {
      return fail(
        "invalid_status",
        timesheet.status === "approved"
          ? "This timesheet is already approved."
          : `Only submitted timesheets can be approved (current status: ${timesheet.status}).`,
      )
    }

    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await supabase
      .from("timesheets")
      .update({
        status: "approved",
        approved_at: now,
        approved_by: membershipResult.data.userId,
      })
      .eq("id", timesheetId)
      .select("id, status, updated_at")
      .single()

    if (updateError) {
      if (/check constraint|invalid input value|23514/i.test(updateError.message ?? "")) {
        return ok({
          timesheetId,
          status: "unsupported",
          message: "This database does not allow approved timesheet status yet.",
          updatedAt: now,
        })
      }
      return fail("timesheet_approve", friendlyDbMessage(updateError, "Unable to approve timesheet."))
    }

    const row = updated as { updated_at?: string }
    return ok({
      timesheetId,
      status: "approved",
      message: "Timesheet approved. Payroll export and billing invoicing are not connected yet.",
      updatedAt: row.updated_at ?? now,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function disputeProviderTimesheetInSupabase(
  timesheetId: string,
  reason?: string,
): Promise<ApiResult<ProviderTimesheetActionResult>> {
  try {
    const membershipResult = await loadProviderMembership()
    if (!membershipResult.ok) return membershipResult
    if (!membershipResult.data) {
      return fail("no_provider", "Join or create a provider organization before disputing timesheets.")
    }

    const forbidden = assertCanReviewTimesheets(membershipResult.data)
    if (forbidden && !forbidden.ok) return forbidden

    const supabase = getSupabaseClient()
    const verifyResult = await verifySubmittedTimesheet(
      supabase,
      timesheetId,
      membershipResult.data.providerId,
    )
    if (!verifyResult.ok) return verifyResult

    const timesheet = verifyResult.data
    if (timesheet.status !== "submitted") {
      return fail(
        "invalid_status",
        timesheet.status === "disputed"
          ? "This timesheet is already disputed."
          : `Only submitted timesheets can be disputed (current status: ${timesheet.status}).`,
      )
    }

    const now = new Date().toISOString()
    const payload: Record<string, string> = { status: "disputed" }
    if (reason?.trim()) {
      payload.provider_notes = reason.trim()
    }

    const { data: updated, error: updateError } = await supabase
      .from("timesheets")
      .update(payload)
      .eq("id", timesheetId)
      .select("id, status, updated_at")
      .single()

    if (updateError) {
      if (/check constraint|invalid input value|23514/i.test(updateError.message ?? "")) {
        return ok({
          timesheetId,
          status: "unsupported",
          message: "This database does not allow disputed timesheet status yet.",
          updatedAt: now,
        })
      }
      return fail("timesheet_dispute", friendlyDbMessage(updateError, "Unable to dispute timesheet."))
    }

    const row = updated as { updated_at?: string }
    const note = reason?.trim()
      ? " Dispute reason was saved in provider notes."
      : " Add a reason in provider notes when that field is exposed in the UI."
    return ok({
      timesheetId,
      status: "disputed",
      message: `Timesheet disputed.${note}`,
      updatedAt: row.updated_at ?? now,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function getProviderTimesheetReadinessFromSupabase(): Promise<
  ApiResult<ProviderTimesheetReadinessSummary>
> {
  try {
    const membershipResult = await loadProviderMembership()
    if (!membershipResult.ok) {
      return membershipResult
    }

    const emptySummary: ProviderTimesheetReadinessSummary = {
      pendingCount: 0,
      readyToApproveCount: 0,
      simulatedCount: 0,
      rows: [],
      submittedRows: [],
      approvedRows: [],
      disputedRows: [],
    }

    if (!membershipResult.data) {
      return ok(emptySummary)
    }

    const providerId = membershipResult.data.providerId
    const supabase = getSupabaseClient()

    const { data: timesheetData, error: timesheetError } = await supabase
      .from("timesheets")
      .select(TIMESHEET_REVIEW_SELECT)
      .eq("bookings.shifts.provider_id", providerId)
      .in("status", ["submitted", "approved", "disputed"])
      .order("submitted_at", { ascending: false })

    if (timesheetError) {
      return fail(
        "timesheets_load",
        friendlyDbMessage(timesheetError, "Unable to load timesheets."),
      )
    }

    const reviewRows = ((timesheetData ?? []) as TimesheetEmbedRow[])
      .map(mapTimesheetToReviewRow)
      .filter((r): r is ProviderTimesheetReviewRow => r != null)

    const submittedRows = reviewRows.filter(r => r.status === "submitted")
    const approvedRows = reviewRows.filter(r => r.status === "approved")
    const disputedRows = reviewRows.filter(r => r.status === "disputed")
    const timesheetBookingIds = new Set(reviewRows.map(r => r.bookingId))

    const { data: bookingRows, error: bookingError } = await supabase
      .from("bookings")
      .select(
        `
        id,
        shift_id,
        worker_id,
        status,
        shifts!inner (
          id,
          provider_id,
          site_id,
          title,
          role,
          starts_at,
          ends_at,
          status,
          care_sites ( id, name )
        ),
        worker_profiles ( id, headline )
      `,
      )
      .eq("shifts.provider_id", providerId)
      .in("status", ["confirmed", "accepted", "completed"])
      .order("created_at", { ascending: false })

    if (bookingError) {
      return fail(
        "timesheets_bookings_load",
        friendlyDbMessage(bookingError, "Unable to load timesheet readiness."),
      )
    }

    const readinessSource = ((bookingRows ?? []) as BookingTimesheetRow[])
      .filter(row => !timesheetBookingIds.has(row.id))
      .map(mapBookingToReadinessRow)
      .filter((r): r is ProviderTimesheetBookingReadinessRow => r != null)

    const readinessRows = readinessSource.map(toSummaryRow)
    const count = readinessRows.length

    return ok({
      pendingCount: count,
      readyToApproveCount: submittedRows.length,
      simulatedCount: 0,
      rows: readinessRows,
      submittedRows,
      approvedRows,
      disputedRows,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
