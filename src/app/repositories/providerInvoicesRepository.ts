import type { ApiResult } from "../api/types"
import { resolveBillRateCents } from "../lib/billRateCents"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  ProviderInvoiceGenerationResult,
  ProviderInvoiceLineRow,
  ProviderInvoiceRow,
  ProviderInvoiceStatus,
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
    return "Invoice actions are blocked by database permissions (RLS). Apply invoice generation policies (0014) on your Supabase project."
  }
  if (/unique|duplicate key|23505/i.test(raw)) {
    return "One or more timesheets were already invoiced. Refresh and try again."
  }
  return raw
}

const INVOICE_WRITE_ROLES = new Set(["owner", "admin", "billing"])

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
  title: string | null
  role: string | null
  starts_at: string
  ends_at: string
  hourly_rate: number | string | null
  bill_rate_cents: number | null
  currency: string | null
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
  bookings: {
    id: string
    shift_id: string
    worker_id: string
    bill_rate_cents_snapshot: number | null
    currency_snapshot: string | null
    shifts: ShiftEmbed | ShiftEmbed[] | null
    worker_profiles: WorkerProfileEmbed | WorkerProfileEmbed[] | null
  } | null
}

type InvoiceLineEmbed = {
  id: string
  timesheet_id: string
  booking_id: string
  shift_id: string
  worker_id: string
  description: string
  hours: number | string | null
  rate_cents: number | null
  amount_cents: number
}

type InvoiceListRow = {
  id: string
  provider_id: string
  status: string
  subtotal: number | string | null
  total: number | string | null
  generated_at: string | null
  created_at: string
  invoice_lines: InvoiceLineEmbed[] | null
}

const APPROVED_TIMESHEET_SELECT = `
  id,
  booking_id,
  clock_in_at,
  clock_out_at,
  break_minutes,
  bookings!inner (
    id,
    shift_id,
    worker_id,
    bill_rate_cents_snapshot,
    currency_snapshot,
    shifts!inner (
      id,
      title,
      role,
      starts_at,
      ends_at,
      hourly_rate,
      bill_rate_cents,
      currency,
      care_sites ( id, name )
    ),
    worker_profiles ( id, headline )
  )
`

function unwrap<T>(embed: T | T[] | null): T | null {
  if (!embed) return null
  return Array.isArray(embed) ? embed[0] ?? null : embed
}

function parseMoney(value: number | string | null | undefined): number {
  if (value == null) return 0
  const n = typeof value === "number" ? value : Number.parseFloat(String(value))
  return Number.isFinite(n) ? n : 0
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

function shiftTitleFromRow(shift: ShiftEmbed): string {
  return shift.title?.trim() || shift.role?.trim() || "Shift"
}

function workerNameFromEmbed(embed: WorkerProfileEmbed | null): string {
  const headline = embed?.headline?.trim()
  if (headline) return headline
  return "Booked worker"
}

function mapDbStatus(status: string, generatedAt: string | null): ProviderInvoiceStatus {
  if (status === "void") return "void"
  if (generatedAt) return "generated"
  return "draft"
}

function mapLineEmbed(line: InvoiceLineEmbed): ProviderInvoiceLineRow {
  const rate = line.rate_cents != null ? line.rate_cents / 100 : undefined
  const parts = line.description.split(" · ")
  return {
    id: line.id,
    timesheetId: line.timesheet_id,
    bookingId: line.booking_id,
    shiftId: line.shift_id,
    workerName: parts[0]?.trim() || "Worker",
    siteName: parts[parts.length - 1]?.trim() || "Care site",
    description: line.description,
    hours: parseMoney(line.hours),
    rate,
    amount: (line.amount_cents ?? 0) / 100,
  }
}

function mapInvoiceRow(row: InvoiceListRow): ProviderInvoiceRow {
  const lines = (row.invoice_lines ?? []).map(mapLineEmbed)
  const totalAmount = parseMoney(row.total) || lines.reduce((sum, l) => sum + l.amount, 0)
  return {
    invoiceId: row.id,
    providerId: row.provider_id,
    status: mapDbStatus(row.status, row.generated_at),
    totalAmount,
    generatedAt: row.generated_at ?? undefined,
    lineCount: lines.length,
    lines,
    isSupabaseBacked: true,
  }
}

async function loadProviderMembership(): Promise<ApiResult<ProviderMembership | null>> {
  const supabase = getSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return fail("not_authenticated", "Sign in with Supabase before managing invoices.")
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

function assertCanGenerateInvoices(membership: ProviderMembership): ApiResult<void> | null {
  if (!INVOICE_WRITE_ROLES.has(membership.role)) {
    return fail(
      "forbidden",
      "Only owners, admins, and billing roles can generate invoices.",
    )
  }
  return null
}

async function loadInvoicedTimesheetIds(
  supabase: ReturnType<typeof getSupabaseClient>,
  providerId: string,
): Promise<ApiResult<Set<string>>> {
  const { data: invoiceRows, error: invoiceError } = await supabase
    .from("invoices")
    .select("id")
    .eq("provider_id", providerId)

  if (invoiceError) {
    return fail(
      "invoices_load",
      friendlyDbMessage(invoiceError, "Unable to load existing invoices."),
    )
  }

  const invoiceIds = ((invoiceRows ?? []) as { id: string }[]).map(row => row.id)
  if (invoiceIds.length === 0) {
    return ok(new Set())
  }

  const { data: lineRows, error: lineError } = await supabase
    .from("invoice_lines")
    .select("timesheet_id")
    .in("invoice_id", invoiceIds)

  if (lineError) {
    return fail(
      "invoice_lines_load",
      friendlyDbMessage(lineError, "Unable to load existing invoice lines."),
    )
  }

  const ids = new Set(
    ((lineRows ?? []) as { timesheet_id: string }[]).map(row => row.timesheet_id),
  )
  return ok(ids)
}

export async function listProviderInvoicesFromSupabase(): Promise<
  ApiResult<ProviderInvoiceRow[]>
> {
  try {
    const membershipResult = await loadProviderMembership()
    if (!membershipResult.ok) return membershipResult
    if (!membershipResult.data) return ok([])

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from("invoices")
      .select(
        `
        id,
        provider_id,
        status,
        subtotal,
        total,
        generated_at,
        created_at,
        invoice_lines (
          id,
          timesheet_id,
          booking_id,
          shift_id,
          worker_id,
          description,
          hours,
          rate_cents,
          amount_cents
        )
      `,
      )
      .eq("provider_id", membershipResult.data.providerId)
      .order("created_at", { ascending: false })

    if (error) {
      return fail(
        "invoices_load",
        friendlyDbMessage(error, "Unable to load invoices."),
      )
    }

    return ok(((data ?? []) as InvoiceListRow[]).map(mapInvoiceRow))
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function generateProviderInvoiceFromApprovedTimesheetsInSupabase(): Promise<
  ApiResult<ProviderInvoiceGenerationResult>
> {
  try {
    const membershipResult = await loadProviderMembership()
    if (!membershipResult.ok) return membershipResult
    if (!membershipResult.data) {
      return fail("no_provider", "Join or create a provider organization before generating invoices.")
    }

    const forbidden = assertCanGenerateInvoices(membershipResult.data)
    if (forbidden && !forbidden.ok) return forbidden

    const supabase = getSupabaseClient()
    const providerId = membershipResult.data.providerId

    const invoicedResult = await loadInvoicedTimesheetIds(supabase, providerId)
    if (!invoicedResult.ok) return invoicedResult
    const invoicedIds = invoicedResult.data

    const { data: timesheetData, error: timesheetError } = await supabase
      .from("timesheets")
      .select(APPROVED_TIMESHEET_SELECT)
      .eq("bookings.shifts.provider_id", providerId)
      .eq("status", "approved")
      .order("approved_at", { ascending: true })

    if (timesheetError) {
      return fail(
        "timesheets_load",
        friendlyDbMessage(timesheetError, "Unable to load approved timesheets."),
      )
    }

    const candidates = ((timesheetData ?? []) as ApprovedTimesheetRow[]).filter(
      row => !invoicedIds.has(row.id),
    )

    if (candidates.length === 0) {
      return fail(
        "no_timesheets",
        "No approved timesheets are ready for invoice generation.",
      )
    }

    const linePayloads: {
      timesheetId: string
      bookingId: string
      shiftId: string
      workerId: string
      description: string
      hours: number
      rateCents: number | null
      billRateCentsSnapshot: number | null
      currencySnapshot: string | null
      amountCents: number
    }[] = []

    for (const row of candidates) {
      const booking = row.bookings
      if (!booking) continue
      const shift = unwrap(booking.shifts)
      if (!shift) continue

      const site = unwrap(shift.care_sites)
      const workerProfile = unwrap(booking.worker_profiles)
      const workerName = workerNameFromEmbed(workerProfile)
      const shiftTitle = shiftTitleFromRow(shift)
      const siteName = site?.name?.trim() || "Care site"
      const hours = calculateHours(row.clock_in_at, row.clock_out_at, row.break_minutes ?? 0)
      const billRateCents = resolveBillRateCents(shift, booking)
      const rateCents = billRateCents
      const amountCents =
        rateCents != null && hours > 0 ? Math.round(hours * rateCents) : 0
      const currencySnapshot =
        booking.currency_snapshot?.trim() || shift.currency?.trim() || "usd"

      linePayloads.push({
        timesheetId: row.id,
        bookingId: row.booking_id,
        shiftId: booking.shift_id,
        workerId: booking.worker_id,
        description: `${workerName} · ${shiftTitle} · ${siteName}`,
        hours,
        rateCents,
        billRateCentsSnapshot: billRateCents,
        currencySnapshot,
        amountCents,
      })
    }

    if (linePayloads.length === 0) {
      return fail(
        "no_timesheets",
        "No approved timesheets are ready for invoice generation.",
      )
    }

    const totalCents = linePayloads.reduce((sum, line) => sum + line.amountCents, 0)
    const totalDollars = Math.round((totalCents / 100) * 100) / 100
    const now = new Date().toISOString()

    const { data: invoiceRow, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        provider_id: providerId,
        status: "draft",
        subtotal: totalDollars,
        total: totalDollars,
        fees: 0,
        generated_at: now,
        generated_by: membershipResult.data.userId,
      })
      .select("id, status, total, generated_at")
      .single()

    if (invoiceError || !invoiceRow) {
      return fail(
        "invoice_insert",
        friendlyDbMessage(invoiceError ?? {}, "Unable to create invoice."),
      )
    }

    const invoiceId = (invoiceRow as { id: string }).id

    const { error: linesError } = await supabase.from("invoice_lines").insert(
      linePayloads.map(line => ({
        invoice_id: invoiceId,
        timesheet_id: line.timesheetId,
        booking_id: line.bookingId,
        shift_id: line.shiftId,
        worker_id: line.workerId,
        description: line.description,
        hours: line.hours,
        rate_cents: line.rateCents,
        bill_rate_cents_snapshot: line.billRateCentsSnapshot,
        currency_snapshot: line.currencySnapshot,
        rate_snapshot: {
          source: "provider_invoice_draft",
          bill_rate_cents: line.billRateCentsSnapshot,
          currency: line.currencySnapshot,
        },
        amount_cents: line.amountCents,
      })),
    )

    if (linesError) {
      return fail(
        "invoice_lines_insert",
        `${friendlyDbMessage(linesError, "Invoice header was created but lines failed.")} Refresh billing — you may need to void the partial draft in the database.`,
      )
    }

    return ok({
      invoiceId,
      status: "generated",
      message: `Draft invoice created with ${linePayloads.length} line${linePayloads.length === 1 ? "" : "s"}. Payment rails are not connected.`,
      totalAmount: totalDollars,
      generatedAt: now,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
