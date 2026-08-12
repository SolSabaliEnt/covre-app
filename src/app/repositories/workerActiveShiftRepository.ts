import type { ApiResult } from "../api/types"
import type { Role, Shift, ShiftLifecycleStatus } from "../data/types"
import {
  formatEstimatedTotalFromWorkerRate,
  formatWorkerPayDisplayFromSnapshot,
} from "../lib/workerRateCents"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  WorkerActiveShiftPhase,
  WorkerActiveShiftStatus,
  WorkerActiveShiftSummary,
  WorkerBookingStatus,
  WorkerClockEvent,
  WorkerClockEventType,
  WorkerTimesheetSubmitResult,
} from "../services/types"

type CareSiteEmbed = {
  id: string
  name: string
  site_type: string | null
  city: string | null
  state: string | null
  address_line1: string | null
  address_line2: string | null
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
  is_urgent: boolean
  care_sites: CareSiteEmbed | CareSiteEmbed[] | null
}

type BookingRateSnapshot = {
  workerRateCentsSnapshot: number | null
  currencySnapshot: string | null
  rateTypeSnapshot: string | null
}

type BookingRow = {
  id: string
  shift_id: string
  worker_id: string
  status: string
  worker_rate_cents_snapshot: number | null
  currency_snapshot: string | null
  rate_type_snapshot: string | null
  rate_snapshot_at: string | null
  shifts: ShiftEmbed | ShiftEmbed[] | null
}

type ClockEventRow = {
  id: string
  booking_id: string
  worker_id: string
  event_type: string
  occurred_at: string
  note: string | null
}

type TimesheetRow = {
  id: string
  booking_id: string
  clock_in_at: string | null
  clock_out_at: string | null
  break_minutes: number
  status: string
  submitted_at: string | null
}

const CONNECTED_MESSAGE =
  "Clock events are now recorded for this booking. Timesheet approval remains with the facility."

const BOOKING_WITH_SHIFT_SELECT = `
  id,
  shift_id,
  worker_id,
  status,
  worker_rate_cents_snapshot,
  currency_snapshot,
  rate_type_snapshot,
  rate_snapshot_at,
  shifts (
    id,
    provider_id,
    site_id,
    title,
    role,
    starts_at,
    ends_at,
    status,
    is_urgent,
    care_sites (
      id,
      name,
      site_type,
      city,
      state,
      address_line1,
      address_line2
    )
  )
`

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "This action is blocked by database permissions (RLS). Apply clock events and timesheet policies (0012) on your Supabase project."
  }
  if (/clock_events|relation.*does not exist/i.test(raw)) {
    return "Clock events table is not available yet. Apply migration 0012 on your Supabase project."
  }
  return raw
}

function unwrap<T>(embed: T | T[] | null): T | null {
  if (!embed) return null
  return Array.isArray(embed) ? embed[0] ?? null : embed
}

function mapBookingStatus(dbStatus: string): WorkerBookingStatus {
  switch (dbStatus) {
    case "confirmed":
    case "accepted":
      return "confirmed"
    case "requested":
      return "pending"
    case "cancelled_by_worker":
      return "cancelled_by_worker"
    case "cancelled_by_provider":
      return "cancelled_by_provider"
    case "completed":
      return "completed"
    case "no_show":
      return "no_show"
    default:
      return "pending"
  }
}

function asWorkRole(role: string | null | undefined): Role {
  const r = role?.trim() ?? ""
  const known: Role[] = ["DSP", "CNA", "Medication Aide", "LPN", "RN", "Caregiver"]
  if (known.includes(r as Role)) return r as Role
  return "Caregiver"
}

function formatSiteAddress(site: CareSiteEmbed | null): string {
  if (!site) return ""
  const parts = [
    site.address_line1,
    site.address_line2,
    [site.city, site.state].filter(Boolean).join(", "),
  ].filter((p): p is string => Boolean(p?.trim()))
  return parts.join(", ").trim()
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

function formatTimeLabel(iso: string | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function parseWorkerRateCentsSnapshot(value: number | null | undefined): number | null {
  if (value == null || value < 0) return null
  return value
}

function mapShiftForActiveShift(shift: ShiftEmbed, snapshot: BookingRateSnapshot): Shift {
  const site = unwrap(shift.care_sites)
  const roleTitle = shift.title?.trim() || shift.role?.trim() || "Shift"
  const workerRateCentsSnapshot = parseWorkerRateCentsSnapshot(
    snapshot.workerRateCentsSnapshot,
  )
  const payDisplay = formatWorkerPayDisplayFromSnapshot(
    workerRateCentsSnapshot,
    snapshot.rateTypeSnapshot,
  )
  const estimatedTotalDisplay =
    workerRateCentsSnapshot != null
      ? formatEstimatedTotalFromWorkerRate(
          shift.starts_at,
          shift.ends_at,
          workerRateCentsSnapshot,
          snapshot.rateTypeSnapshot,
        )
      : "—"

  return {
    id: shift.id,
    roleTitle,
    workRole: asWorkRole(shift.role),
    siteId: shift.site_id,
    siteName: site?.name?.trim() || "Care site",
    providerOrgId: shift.provider_id,
    providerName: "Facility partner",
    dateLabel: formatDateLabel(shift.starts_at),
    timeRange: formatTimeRange(shift.starts_at, shift.ends_at),
    hourlyPayDisplay: payDisplay,
    workerRateCentsSnapshot: workerRateCentsSnapshot ?? undefined,
    currencySnapshot: snapshot.currencySnapshot ?? undefined,
    rateTypeSnapshot: snapshot.rateTypeSnapshot ?? undefined,
    workerPayDisplay: payDisplay,
    estimatedTotalDisplay,
    distanceMiles: "—",
    credentialTags: [],
    workerFeedCardStatus: "ready",
    providerBoardStatus: "covered",
    assignedWorkerId: null,
    lifecycleStatus: mapLifecycleStatus(shift.status),
    showOnWorkerFeed: false,
    facilitySettingLabel: site?.site_type?.trim() || "Care site",
    streetAddress: formatSiteAddress(site) || "Address on file",
    duties: [],
    requiredCredentialsDisplayed: [],
    isUrgent: shift.is_urgent,
    isReadyMatch: true,
    isSupabaseDiscovery: true,
  }
}

function mapLifecycleStatus(dbStatus: string): ShiftLifecycleStatus {
  const map: Record<string, ShiftLifecycleStatus> = {
    open: "Open",
    requested: "Requested",
    booked: "Booked",
    confirmed: "Booked",
    clocked_in: "Clocked In",
    pending_approval: "Pending Approval",
    approved: "Approved",
    invoiced: "Invoiced",
    draft: "Open",
    cancelled: "Open",
    completed: "Approved",
  }
  return map[dbStatus] ?? "Booked"
}

function unavailableSummary(message: string): WorkerActiveShiftSummary {
  return {
    status: "unavailable",
    message,
    isSupabaseBacked: true,
    actionsEnabled: false,
  }
}

type ParsedActiveBooking = {
  bookingId: string
  shiftId: string
  shift: Shift
  startsAt: string
  endsAt: string
  workerPayDisplay: string
  workerRateCentsSnapshot?: number
  rateTypeSnapshot?: string
  bookingStatus: WorkerBookingStatus
}

function parseBookingRow(row: BookingRow): ParsedActiveBooking | null {
  const shiftEmbed = unwrap(row.shifts)
  if (!shiftEmbed) return null

  const bookingStatus = mapBookingStatus(row.status)
  if (
    bookingStatus === "cancelled_by_worker" ||
    bookingStatus === "cancelled_by_provider" ||
    bookingStatus === "no_show" ||
    bookingStatus === "disputed"
  ) {
    return null
  }

  return {
    bookingId: row.id,
    shiftId: row.shift_id,
    shift: mapShiftForActiveShift(shiftEmbed, {
      workerRateCentsSnapshot: row.worker_rate_cents_snapshot,
      currencySnapshot: row.currency_snapshot,
      rateTypeSnapshot: row.rate_type_snapshot,
    }),
    startsAt: shiftEmbed.starts_at,
    endsAt: shiftEmbed.ends_at,
    workerPayDisplay: formatWorkerPayDisplayFromSnapshot(
      parseWorkerRateCentsSnapshot(row.worker_rate_cents_snapshot),
      row.rate_type_snapshot,
    ),
    workerRateCentsSnapshot:
      parseWorkerRateCentsSnapshot(row.worker_rate_cents_snapshot) ?? undefined,
    rateTypeSnapshot: row.rate_type_snapshot ?? undefined,
    bookingStatus,
  }
}

function pickActiveBooking(rows: ParsedActiveBooking[]): ParsedActiveBooking | null {
  const now = Date.now()
  const eligible = rows.filter(
    r =>
      (r.bookingStatus === "confirmed" || r.bookingStatus === "pending") &&
      Number.isFinite(Date.parse(r.endsAt)) &&
      Date.parse(r.endsAt) >= now - 1000 * 60 * 60 * 12,
  )

  if (eligible.length === 0) return null

  const inProgress = eligible.find(r => {
    const start = Date.parse(r.startsAt)
    const end = Date.parse(r.endsAt)
    return start <= now && end >= now
  })
  if (inProgress) return inProgress

  const upcoming = eligible
    .filter(r => Date.parse(r.endsAt) >= now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))

  return upcoming[0] ?? null
}

function mapClockEvent(row: ClockEventRow): WorkerClockEvent {
  return {
    id: row.id,
    bookingId: row.booking_id,
    eventType: row.event_type as WorkerClockEventType,
    occurredAt: row.occurred_at,
    note: row.note ?? undefined,
  }
}

function calculateBreakMinutes(events: ClockEventRow[]): number {
  let totalMs = 0
  let breakStartMs: number | null = null
  for (const e of events) {
    const t = Date.parse(e.occurred_at)
    if (!Number.isFinite(t)) continue
    if (e.event_type === "break_start") {
      breakStartMs = t
    } else if (e.event_type === "break_end" && breakStartMs != null) {
      totalMs += t - breakStartMs
      breakStartMs = null
    }
  }
  return Math.round(totalMs / (1000 * 60))
}

function eventAt(events: ClockEventRow[], type: WorkerClockEventType): string | undefined {
  const row = events.find(e => e.event_type === type)
  return row?.occurred_at
}

function hasOpenBreak(events: ClockEventRow[]): boolean {
  let open = false
  for (const e of events) {
    if (e.event_type === "break_start") open = true
    if (e.event_type === "break_end") open = false
  }
  return open
}

function derivePhase(
  events: ClockEventRow[],
  timesheet: TimesheetRow | null,
): WorkerActiveShiftPhase {
  if (timesheet?.status === "submitted" || timesheet?.submitted_at) {
    return "submitted"
  }
  const hasClockOut = events.some(e => e.event_type === "clock_out")
  if (hasClockOut) return "clocked_out"
  if (hasOpenBreak(events)) return "on_break"
  if (events.some(e => e.event_type === "clock_in")) return "clocked_in"
  return "scheduled"
}

function deriveCapabilities(
  phase: WorkerActiveShiftPhase,
  events: ClockEventRow[],
  timesheet: TimesheetRow | null,
) {
  const hasClockIn = events.some(e => e.event_type === "clock_in")
  const hasClockOut = events.some(e => e.event_type === "clock_out")
  const onBreak = hasOpenBreak(events)
  const submitted = phase === "submitted"

  return {
    canClockIn: phase === "scheduled" && !hasClockIn,
    canStartBreak: phase === "clocked_in" && hasClockIn && !hasClockOut && !onBreak,
    canEndBreak: phase === "on_break",
    canClockOut: phase === "clocked_in" && hasClockIn && !hasClockOut && !onBreak,
    canSubmitTimesheet:
      phase === "clocked_out" && hasClockIn && hasClockOut && !submitted && !timesheet?.submitted_at,
  }
}

async function resolveWorkerProfileId(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
): Promise<ApiResult<string | null>> {
  const { data, error } = await supabase
    .from("worker_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    return fail("worker_profile_load", friendlyDbMessage(error, "Unable to load worker profile."))
  }

  return ok((data as { id: string } | null)?.id ?? null)
}

async function requireSession(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<ApiResult<{ userId: string; workerId: string }>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return fail("not_authenticated", "Sign in with Supabase before using active shift.")
  }

  const profileRes = await resolveWorkerProfileId(supabase, session.user.id)
  if (!profileRes.ok) return profileRes
  if (!profileRes.data) {
    return fail("worker_profile_missing", "Complete your worker profile before starting shifts.")
  }

  return ok({ userId: session.user.id, workerId: profileRes.data })
}

async function verifyWorkerBooking(
  supabase: ReturnType<typeof getSupabaseClient>,
  bookingId: string,
  workerId: string,
): Promise<ApiResult<ParsedActiveBooking>> {
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_WITH_SHIFT_SELECT)
    .eq("id", bookingId)
    .eq("worker_id", workerId)
    .maybeSingle()

  if (error) {
    return fail("booking_load", friendlyDbMessage(error, "Unable to load booking."))
  }

  if (!data) {
    return fail("booking_not_found", "Booking not found for your account.")
  }

  const parsed = parseBookingRow(data as BookingRow)
  if (!parsed) {
    return fail("booking_inactive", "This booking is not active for clock events.")
  }

  if (parsed.bookingStatus !== "confirmed" && parsed.bookingStatus !== "pending") {
    return fail("booking_inactive", "Only confirmed bookings can be clocked.")
  }

  return ok(parsed)
}

async function loadClockEvents(
  supabase: ReturnType<typeof getSupabaseClient>,
  bookingId: string,
): Promise<ApiResult<ClockEventRow[]>> {
  const { data, error } = await supabase
    .from("clock_events")
    .select("id, booking_id, worker_id, event_type, occurred_at, note")
    .eq("booking_id", bookingId)
    .order("occurred_at", { ascending: true })

  if (error) {
    return fail("clock_events_load", friendlyDbMessage(error, "Unable to load clock events."))
  }

  return ok((data ?? []) as ClockEventRow[])
}

async function loadTimesheet(
  supabase: ReturnType<typeof getSupabaseClient>,
  bookingId: string,
): Promise<ApiResult<TimesheetRow | null>> {
  const { data, error } = await supabase
    .from("timesheets")
    .select("id, booking_id, clock_in_at, clock_out_at, break_minutes, status, submitted_at")
    .eq("booking_id", bookingId)
    .maybeSingle()

  if (error) {
    return fail("timesheet_load", friendlyDbMessage(error, "Unable to load timesheet."))
  }

  return ok((data as TimesheetRow | null) ?? null)
}

function buildSummaryFromBooking(
  active: ParsedActiveBooking,
  events: ClockEventRow[],
  timesheet: TimesheetRow | null,
): WorkerActiveShiftSummary {
  const phase = derivePhase(events, timesheet)
  const caps = deriveCapabilities(phase, events, timesheet)
  const clockInAt = eventAt(events, "clock_in")
  const clockOutAt = eventAt(events, "clock_out")

  let status: WorkerActiveShiftStatus = "scheduled"
  if (phase === "submitted") status = "completed_staged"
  else if (phase !== "scheduled") status = "in_progress_staged"

  return {
    bookingId: active.bookingId,
    shiftId: active.shiftId,
    status,
    phase,
    title: active.shift.roleTitle,
    siteName: active.shift.siteName,
    startsAt: active.startsAt,
    endsAt: active.endsAt,
    role: active.shift.workRole,
    workerPayDisplay: active.workerPayDisplay,
    workerRateCentsSnapshot: active.workerRateCentsSnapshot,
    rateTypeSnapshot: active.rateTypeSnapshot,
    message: CONNECTED_MESSAGE,
    isSupabaseBacked: true,
    actionsEnabled: true,
    events: events.map(mapClockEvent),
    clockInAt,
    clockOutAt,
    timesheetId: timesheet?.id,
    ...caps,
  }
}

async function loadActiveBookingForWorker(
  supabase: ReturnType<typeof getSupabaseClient>,
  workerId: string,
): Promise<ApiResult<ParsedActiveBooking | null>> {
  const { data: rows, error } = await supabase
    .from("bookings")
    .select(BOOKING_WITH_SHIFT_SELECT)
    .eq("worker_id", workerId)
    .in("status", ["confirmed", "accepted", "requested"])
    .order("created_at", { ascending: false })

  if (error) {
    return fail("active_shift_load", friendlyDbMessage(error, "Unable to load active shift."))
  }

  const parsed = ((rows ?? []) as BookingRow[])
    .map(parseBookingRow)
    .filter((r): r is ParsedActiveBooking => r != null)

  return ok(pickActiveBooking(parsed))
}

export async function getWorkerActiveShiftFromSupabase(): Promise<
  ApiResult<{ summary: WorkerActiveShiftSummary; shift?: Shift }>
> {
  try {
    const supabase = getSupabaseClient()
    const sessionRes = await requireSession(supabase)
    if (!sessionRes.ok) {
      if (sessionRes.error.code === "worker_profile_missing") {
        return ok({ summary: unavailableSummary(sessionRes.error.message) })
      }
      return sessionRes
    }

    const activeRes = await loadActiveBookingForWorker(supabase, sessionRes.data.workerId)
    if (!activeRes.ok) return activeRes

    if (!activeRes.data) {
      return ok({
        summary: unavailableSummary(
          "No active booking is ready yet. Apply for shifts and check your bookings.",
        ),
      })
    }

    const eventsRes = await loadClockEvents(supabase, activeRes.data.bookingId)
    if (!eventsRes.ok) return eventsRes

    const timesheetRes = await loadTimesheet(supabase, activeRes.data.bookingId)
    if (!timesheetRes.ok) return timesheetRes

    const summary = buildSummaryFromBooking(
      activeRes.data,
      eventsRes.data,
      timesheetRes.data,
    )

    return ok({ summary, shift: activeRes.data.shift })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

async function insertClockEvent(
  bookingId: string,
  eventType: WorkerClockEventType,
): Promise<ApiResult<WorkerClockEvent>> {
  try {
    const supabase = getSupabaseClient()
    const sessionRes = await requireSession(supabase)
    if (!sessionRes.ok) return sessionRes

    const bookingRes = await verifyWorkerBooking(
      supabase,
      bookingId,
      sessionRes.data.workerId,
    )
    if (!bookingRes.ok) return bookingRes

    const eventsRes = await loadClockEvents(supabase, bookingId)
    if (!eventsRes.ok) return eventsRes

    const events = eventsRes.data
    const phase = derivePhase(events, null)

    if (eventType === "clock_in") {
      if (events.some(e => e.event_type === "clock_in")) {
        return fail("invalid_transition", "You are already clocked in.")
      }
    } else if (eventType === "break_start") {
      if (phase !== "clocked_in") {
        return fail("invalid_transition", "Start a break only while clocked in.")
      }
    } else if (eventType === "break_end") {
      if (phase !== "on_break") {
        return fail("invalid_transition", "You are not on a break.")
      }
    } else if (eventType === "clock_out") {
      if (phase !== "clocked_in" && phase !== "on_break") {
        return fail("invalid_transition", "Clock out only after clocking in.")
      }
      if (hasOpenBreak(events)) {
        return fail("invalid_transition", "End your break before clocking out.")
      }
    }

    const { data, error } = await supabase
      .from("clock_events")
      .insert({
        booking_id: bookingId,
        worker_id: sessionRes.data.workerId,
        event_type: eventType,
      })
      .select("id, booking_id, worker_id, event_type, occurred_at, note")
      .single()

    if (error) {
      return fail("clock_event_insert", friendlyDbMessage(error, "Unable to record clock event."))
    }

    return ok(mapClockEvent(data as ClockEventRow))
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function clockInBookingInSupabase(
  bookingId: string,
): Promise<ApiResult<{ message: string; event: WorkerClockEvent }>> {
  const res = await insertClockEvent(bookingId, "clock_in")
  if (!res.ok) return res
  return ok({ message: "Clocked in", event: res.data })
}

export async function startBreakInSupabase(
  bookingId: string,
): Promise<ApiResult<{ message: string; event: WorkerClockEvent }>> {
  const res = await insertClockEvent(bookingId, "break_start")
  if (!res.ok) return res
  return ok({ message: "Break started", event: res.data })
}

export async function endBreakInSupabase(
  bookingId: string,
): Promise<ApiResult<{ message: string; event: WorkerClockEvent }>> {
  const res = await insertClockEvent(bookingId, "break_end")
  if (!res.ok) return res
  return ok({ message: "Break ended", event: res.data })
}

export async function clockOutBookingInSupabase(
  bookingId: string,
): Promise<ApiResult<{ message: string; event: WorkerClockEvent }>> {
  const res = await insertClockEvent(bookingId, "clock_out")
  if (!res.ok) return res
  return ok({ message: "Clocked out", event: res.data })
}

export async function submitWorkerTimesheetFromSupabase(
  bookingId: string,
): Promise<ApiResult<WorkerTimesheetSubmitResult>> {
  try {
    const supabase = getSupabaseClient()
    const sessionRes = await requireSession(supabase)
    if (!sessionRes.ok) return sessionRes

    const bookingRes = await verifyWorkerBooking(
      supabase,
      bookingId,
      sessionRes.data.workerId,
    )
    if (!bookingRes.ok) return bookingRes

    const existingRes = await loadTimesheet(supabase, bookingId)
    if (!existingRes.ok) return existingRes

    if (existingRes.data?.status === "submitted" || existingRes.data?.submitted_at) {
      return ok({
        timesheetId: existingRes.data.id,
        bookingId,
        status: "submitted",
        message: "Timesheet was already submitted for this booking.",
        submittedAt: existingRes.data.submitted_at ?? new Date().toISOString(),
      })
    }

    const eventsRes = await loadClockEvents(supabase, bookingId)
    if (!eventsRes.ok) return eventsRes

    const events = eventsRes.data
    const clockInAt = eventAt(events, "clock_in")
    const clockOutAt = eventAt(events, "clock_out")

    if (!clockInAt || !clockOutAt) {
      return fail(
        "timesheet_incomplete",
        "Clock in and clock out before submitting your timesheet.",
      )
    }

    const breakMinutes = calculateBreakMinutes(events)
    const submittedAt = new Date().toISOString()

    const { data, error } = await supabase
      .from("timesheets")
      .insert({
        booking_id: bookingId,
        clock_in_at: clockInAt,
        clock_out_at: clockOutAt,
        break_minutes: breakMinutes,
        status: "submitted",
        submitted_at: submittedAt,
      })
      .select("id, booking_id, status, submitted_at")
      .single()

    if (error) {
      if (/duplicate|unique/i.test(error.message ?? "")) {
        return fail(
          "timesheet_duplicate",
          "A timesheet already exists for this booking.",
        )
      }
      return fail("timesheet_insert", friendlyDbMessage(error, "Unable to submit timesheet."))
    }

    const row = data as { id: string; booking_id: string; status: string; submitted_at: string }

    return ok({
      timesheetId: row.id,
      bookingId: row.booking_id,
      status: row.status,
      message: "Timesheet submitted to the facility for review.",
      submittedAt: row.submitted_at ?? submittedAt,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function resolveBookingIdForShiftInSupabase(
  shiftId: string,
): Promise<ApiResult<string>> {
  const activeRes = await getWorkerActiveShiftFromSupabase()
  if (activeRes.ok && activeRes.data.summary.bookingId && activeRes.data.summary.shiftId === shiftId) {
    return ok(activeRes.data.summary.bookingId)
  }

  const supabase = getSupabaseClient()
  const sessionRes = await requireSession(supabase)
  if (!sessionRes.ok) return sessionRes

  const { data, error } = await supabase
    .from("bookings")
    .select("id")
    .eq("shift_id", shiftId)
    .eq("worker_id", sessionRes.data.workerId)
    .maybeSingle()

  if (error) {
    return fail("booking_resolve", friendlyDbMessage(error, "Unable to resolve booking."))
  }

  if (!data) {
    return fail("booking_not_found", "No booking found for this shift.")
  }

  return ok((data as { id: string }).id)
}

export { formatTimeLabel }
