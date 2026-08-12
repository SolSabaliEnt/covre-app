import type { ApiResult } from "../api/types"
import {
  billRateCentsToHourlyDollars,
  estimateAmountFromBillRateCents,
  estimateShiftAmountFromBillRateCents,
  resolveBillRateCents,
} from "../lib/billRateCents"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  ProviderApprovedTimesheetBillingRow,
  ProviderBillingReadinessRow,
  ProviderBillingSummary,
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
    return "Loading billing is blocked by database permissions (RLS). Apply provider shifts (0004), bookings/timesheets (0010–0014) on your Supabase project."
  }
  return raw
}

type ProviderMembership = {
  providerId: string
}

type CareSiteEmbed = {
  id: string
  name: string
}

type ShiftBillingEmbed = {
  id: string
  title: string | null
  role: string | null
  starts_at: string
  ends_at: string
  hourly_rate: number | string | null
  bill_rate_cents: number | null
  care_sites: CareSiteEmbed | CareSiteEmbed[] | null
}

type WorkerProfileEmbed = {
  id: string
  headline: string | null
}

type ApprovedTimesheetRow = {
  id: string
  booking_id: string
  clock_in_at: string | null
  clock_out_at: string | null
  break_minutes: number
  status: string
  approved_at: string | null
  bookings: {
    id: string
    shift_id: string
    bill_rate_cents_snapshot: number | null
    shifts: ShiftBillingEmbed | ShiftBillingEmbed[] | null
    worker_profiles: WorkerProfileEmbed | WorkerProfileEmbed[] | null
  } | null
}

type SubmittedTimesheetRow = ApprovedTimesheetRow

type ShiftBillingRow = {
  id: string
  site_id: string
  title: string | null
  role: string | null
  starts_at: string
  ends_at: string
  hourly_rate: number | string | null
  bill_rate_cents: number | null
  status: string
  care_sites: CareSiteEmbed | CareSiteEmbed[] | null
}

const SHIFT_BILLING_SELECT = `
  id,
  site_id,
  title,
  role,
  starts_at,
  ends_at,
  hourly_rate,
  bill_rate_cents,
  status,
  care_sites (
    id,
    name
  )
`

const APPROVED_TIMESHEET_SELECT = `
  id,
  booking_id,
  clock_in_at,
  clock_out_at,
  break_minutes,
  status,
  approved_at,
  submitted_at,
  bookings!inner (
    id,
    shift_id,
    bill_rate_cents_snapshot,
    shifts!inner (
      id,
      title,
      role,
      starts_at,
      ends_at,
      hourly_rate,
      bill_rate_cents,
      care_sites ( id, name )
    ),
    worker_profiles ( id, headline )
  )
`

const SHIFT_PREP_MISSING = [
  "Worker booking",
  "Approved timesheet",
  "Invoice generation",
  "Payment rail",
] as const

const SUBMITTED_MISSING = ["Provider approval", "Invoice generation", "Payment rail"] as const

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

function shiftTitleFromRow(row: { title: string | null; role: string | null }): string {
  return row.title?.trim() || row.role?.trim() || "Shift"
}

function workerNameFromEmbed(embed: WorkerProfileEmbed | null): string {
  const headline = embed?.headline?.trim()
  if (headline) return headline
  return "Booked worker"
}

function mapApprovedTimesheet(
  row: ApprovedTimesheetRow,
): { billingRow: ProviderBillingReadinessRow; approvedRow: ProviderApprovedTimesheetBillingRow } | null {
  const booking = row.bookings
  if (!booking) return null
  const shift = unwrap(booking.shifts)
  if (!shift) return null

  const site = unwrap(shift.care_sites)
  const workerProfile = unwrap(booking.worker_profiles)
  const siteName = site?.name?.trim() || "Care site"
  const shiftTitle = shiftTitleFromRow(shift)
  const dateLabel = formatDateLabel(shift.starts_at)
  const timeRange = formatTimeRange(shift.starts_at, shift.ends_at)
  const hours = calculateHours(row.clock_in_at, row.clock_out_at, row.break_minutes ?? 0)
  const billRateCents = resolveBillRateCents(shift, booking)
  const hourlyRate = billRateCentsToHourlyDollars(billRateCents)
  const estimatedAmount = estimateAmountFromBillRateCents(hours, billRateCents)
  const workerName = workerNameFromEmbed(workerProfile)

  const approvedRow: ProviderApprovedTimesheetBillingRow = {
    timesheetId: row.id,
    bookingId: row.booking_id,
    shiftId: booking.shift_id,
    workerName,
    siteName,
    hours,
    hourlyRate,
    estimatedAmount,
    approvedAt: row.approved_at ?? undefined,
    isSupabaseBacked: true,
  }

  const billingRow: ProviderBillingReadinessRow = {
    id: `billing-approved-${row.id}`,
    shiftId: booking.shift_id,
    shiftTitle: `${workerName} · ${shiftTitle}`,
    siteName,
    shiftDate: `${dateLabel} · ${timeRange}`,
    estimatedAmount,
    status: "ready",
    statusLabel: "Ready to invoice",
    isSimulated: false,
    missingItems: ["Invoice generation", "Payment rail"],
  }

  return { billingRow, approvedRow }
}

function mapSubmittedTimesheet(row: SubmittedTimesheetRow): ProviderBillingReadinessRow | null {
  const booking = row.bookings
  if (!booking) return null
  const shift = unwrap(booking.shifts)
  if (!shift) return null

  const site = unwrap(shift.care_sites)
  const workerProfile = unwrap(booking.worker_profiles)
  const siteName = site?.name?.trim() || "Care site"
  const shiftTitle = shiftTitleFromRow(shift)
  const dateLabel = formatDateLabel(shift.starts_at)
  const timeRange = formatTimeRange(shift.starts_at, shift.ends_at)
  const hours = calculateHours(row.clock_in_at, row.clock_out_at, row.break_minutes ?? 0)
  const workerName = workerNameFromEmbed(workerProfile)

  return {
    id: `billing-submitted-${row.id}`,
    shiftId: booking.shift_id,
    shiftTitle: `${workerName} · ${shiftTitle}`,
    siteName,
    shiftDate: `${dateLabel} · ${timeRange}`,
    estimatedAmount: estimateAmountFromBillRateCents(
      hours,
      resolveBillRateCents(shift, booking),
    ),
    status: "pending_timesheet",
    statusLabel: "Awaiting approval",
    isSimulated: false,
    missingItems: [...SUBMITTED_MISSING],
  }
}

function mapShiftToBillingRow(row: ShiftBillingRow): ProviderBillingReadinessRow {
  const site = unwrap(row.care_sites)
  const siteName = site?.name?.trim() || "Care site"
  const shiftTitle = shiftTitleFromRow(row)
  const dateLabel = formatDateLabel(row.starts_at)
  const timeRange = formatTimeRange(row.starts_at, row.ends_at)
  const estimatedAmount = estimateShiftAmountFromBillRateCents(
    row.starts_at,
    row.ends_at,
    resolveBillRateCents(row),
  )

  return {
    id: `billing-prep-${row.id}`,
    shiftId: row.id,
    shiftTitle,
    siteName,
    shiftDate: `${dateLabel} · ${timeRange}`,
    estimatedAmount,
    status: "pending_booking",
    statusLabel: "Pending booking",
    isSimulated: true,
    missingItems: [...SHIFT_PREP_MISSING],
  }
}

async function loadProviderMembership(): Promise<ApiResult<ProviderMembership | null>> {
  const supabase = getSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return fail("not_authenticated", "Sign in with Supabase before loading billing.")
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

export async function getProviderBillingReadinessFromSupabase(): Promise<
  ApiResult<ProviderBillingSummary>
> {
  try {
    const membershipResult = await loadProviderMembership()
    if (!membershipResult.ok) {
      return membershipResult
    }

    const emptySummary: ProviderBillingSummary = {
      estimatedOpenValue: 0,
      readyToInvoiceValue: 0,
      simulatedInvoiceValue: 0,
      rows: [],
    }

    if (!membershipResult.data) {
      return ok(emptySummary)
    }

    const providerId = membershipResult.data.providerId
    const supabase = getSupabaseClient()

    const invoicedTimesheetIds = new Set<string>()
    const { data: invoiceHeaders, error: invoiceHeadersError } = await supabase
      .from("invoices")
      .select("id")
      .eq("provider_id", providerId)

    if (invoiceHeadersError) {
      return fail(
        "billing_invoices_load",
        friendlyDbMessage(invoiceHeadersError, "Unable to load invoices for billing."),
      )
    }

    const invoiceIds = ((invoiceHeaders ?? []) as { id: string }[]).map(row => row.id)
    if (invoiceIds.length > 0) {
      const { data: lineRows, error: lineError } = await supabase
        .from("invoice_lines")
        .select("timesheet_id")
        .in("invoice_id", invoiceIds)

      if (lineError) {
        return fail(
          "billing_invoice_lines_load",
          friendlyDbMessage(lineError, "Unable to load invoice lines for billing."),
        )
      }

      for (const row of (lineRows ?? []) as { timesheet_id: string }[]) {
        invoicedTimesheetIds.add(row.timesheet_id)
      }
    }

    const { data: approvedData, error: approvedError } = await supabase
      .from("timesheets")
      .select(APPROVED_TIMESHEET_SELECT)
      .eq("bookings.shifts.provider_id", providerId)
      .eq("status", "approved")
      .order("approved_at", { ascending: false })

    if (approvedError) {
      return fail(
        "billing_approved_load",
        friendlyDbMessage(approvedError, "Unable to load approved timesheets."),
      )
    }

    const approvedMapped = ((approvedData ?? []) as ApprovedTimesheetRow[])
      .filter(row => !invoicedTimesheetIds.has(row.id))
      .map(mapApprovedTimesheet)
      .filter((r): r is NonNullable<typeof r> => r != null)

    const approvedRows = approvedMapped.map(r => r.approvedRow)
    const readyRows = approvedMapped.map(r => r.billingRow)
    const readyToInvoiceValue = readyRows.reduce((sum, r) => sum + r.estimatedAmount, 0)

    const { data: submittedData, error: submittedError } = await supabase
      .from("timesheets")
      .select(APPROVED_TIMESHEET_SELECT)
      .eq("bookings.shifts.provider_id", providerId)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false })

    if (submittedError) {
      return fail(
        "billing_submitted_load",
        friendlyDbMessage(submittedError, "Unable to load submitted timesheets."),
      )
    }

    const submittedRows = ((submittedData ?? []) as SubmittedTimesheetRow[])
      .map(mapSubmittedTimesheet)
      .filter((r): r is ProviderBillingReadinessRow => r != null)

    const billedShiftIds = new Set([
      ...approvedMapped.map(r => r.billingRow.shiftId),
      ...submittedRows.map(r => r.shiftId),
    ])

    const { data: shiftData, error: shiftError } = await supabase
      .from("shifts")
      .select(SHIFT_BILLING_SELECT)
      .eq("provider_id", providerId)
      .order("starts_at", { ascending: false })

    if (shiftError) {
      return fail(
        "billing_shifts_load",
        friendlyDbMessage(shiftError, "Unable to load billing readiness."),
      )
    }

    const prepRows = ((shiftData ?? []) as ShiftBillingRow[])
      .filter(row => !billedShiftIds.has(row.id))
      .map(mapShiftToBillingRow)

    const submittedValue = submittedRows.reduce((sum, r) => sum + r.estimatedAmount, 0)
    const prepValue = prepRows.reduce((sum, r) => sum + r.estimatedAmount, 0)
    const estimatedOpenValue = readyToInvoiceValue + submittedValue + prepValue

    const rows = [...readyRows, ...submittedRows, ...prepRows]

    return ok({
      estimatedOpenValue,
      readyToInvoiceValue,
      simulatedInvoiceValue: readyToInvoiceValue,
      rows,
      approvedTimesheetRows: approvedRows,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
