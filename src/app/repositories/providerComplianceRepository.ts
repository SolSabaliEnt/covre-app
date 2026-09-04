import type { ApiResult } from "../api/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  ProviderCompliancePacketGenerationResult,
  ProviderCompliancePacketRow,
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
    return "Compliance actions are blocked by database permissions (RLS). Apply compliance packet policies (0015) on your Supabase project."
  }
  if (/unique|duplicate key|23505/i.test(raw)) {
    return "A compliance packet already exists for this booking or timesheet. Refresh and try again."
  }
  return raw
}

const PACKET_WRITE_ROLES = new Set(["owner", "admin", "scheduler"])

type ProviderMembership = {
  providerId: string
  role: string
  userId: string
}

type CareSiteEmbed = {
  id: string
  name: string
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
}

type ShiftComplianceEmbed = {
  id: string
  site_id: string
  title: string | null
  role: string | null
  starts_at: string
  ends_at: string
  hourly_rate?: number | string | null
  care_sites: CareSiteEmbed | CareSiteEmbed[] | null
}

type WorkerProfileEmbed = {
  id: string
  headline: string | null
}

type ApprovedTimesheetComplianceRow = {
  id: string
  booking_id: string
  approved_at: string | null
  approved_by: string | null
  clock_in_at?: string | null
  clock_out_at?: string | null
  break_minutes?: number
  status?: string
  provider_notes?: string | null
  bookings: {
    id: string
    shift_id: string
    worker_id: string
    shifts: ShiftComplianceEmbed | ShiftComplianceEmbed[] | null
    worker_profiles: WorkerProfileEmbed | WorkerProfileEmbed[] | null
  } | null
}

type CompliancePacketDbRow = {
  id: string
  booking_id: string
  timesheet_id: string | null
  status: string
  snapshot: Record<string, unknown> | null
  generated_at: string | null
  bookings: {
    id: string
    shift_id: string
    worker_id: string
    shifts: ShiftComplianceEmbed | ShiftComplianceEmbed[] | null
    worker_profiles: WorkerProfileEmbed | WorkerProfileEmbed[] | null
  } | null
}

type ShiftComplianceRow = {
  id: string
  site_id: string
  title: string | null
  role: string | null
  starts_at: string
  ends_at: string
  status: string
  care_sites: CareSiteEmbed | CareSiteEmbed[] | null
}

const SHIFT_COMPLIANCE_SELECT = `
  id,
  site_id,
  title,
  role,
  starts_at,
  ends_at,
  status,
  care_sites (
    id,
    name
  )
`

const APPROVED_TIMESHEET_COMPLIANCE_SELECT = `
  id,
  booking_id,
  approved_at,
  approved_by,
  clock_in_at,
  clock_out_at,
  break_minutes,
  status,
  provider_notes,
  bookings!inner (
    id,
    shift_id,
    worker_id,
    shifts!inner (
      id,
      site_id,
      title,
      role,
      starts_at,
      ends_at,
      hourly_rate,
      care_sites ( id, name, address_line1, address_line2, city, state, postal_code )
    ),
    worker_profiles ( id, headline )
  )
`

const COMPLIANCE_PACKET_SELECT = `
  id,
  booking_id,
  timesheet_id,
  status,
  snapshot,
  generated_at,
  bookings!inner (
    id,
    shift_id,
    worker_id,
    shifts!inner (
      id,
      site_id,
      title,
      role,
      starts_at,
      ends_at,
      care_sites ( id, name )
    ),
    worker_profiles ( id, headline )
  )
`

const APPROVED_PACKET_MISSING = ["Worker credential snapshot", "Generated packet file"] as const

const PREP_MISSING_ITEMS = [
  "Worker booking",
  "Worker credential snapshot",
  "Timesheet approval",
  "Generated packet file",
] as const

const SNAPSHOT_LIMITATIONS = [
  "Credential snapshot not included in this pass",
  "PDF and file storage are not connected yet",
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

function shiftTitleFromRow(row: { title: string | null; role: string | null }): string {
  return row.title?.trim() || row.role?.trim() || "Shift"
}

function workerNameFromEmbed(embed: WorkerProfileEmbed | null): string {
  const headline = embed?.headline?.trim()
  if (headline) return headline
  return "Booked worker"
}

function formatSiteAddress(site: CareSiteEmbed | null): string | undefined {
  if (!site) return undefined
  const parts = [
    site.address_line1?.trim(),
    site.address_line2?.trim(),
    [site.city?.trim(), site.state?.trim()].filter(Boolean).join(", "),
    site.postal_code?.trim(),
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : undefined
}

function calculateHours(
  clockIn: string | null | undefined,
  clockOut: string | null | undefined,
  breakMinutes: number | undefined,
): number | null {
  if (!clockIn || !clockOut) return null
  const start = Date.parse(clockIn)
  const end = Date.parse(clockOut)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  const hours = (end - start) / (1000 * 60 * 60) - (breakMinutes ?? 0) / 60
  return Math.max(0, Math.round(hours * 100) / 100)
}

async function loadProviderMembership(): Promise<ApiResult<ProviderMembership | null>> {
  const supabase = getSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return fail(
      "not_authenticated",
      "Sign in with Supabase before loading compliance packets.",
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

  return ok({ providerId: row.provider_id, role: row.role, userId: session.user.id })
}

function assertCanGeneratePackets(membership: ProviderMembership): ApiResult<void> | null {
  if (!PACKET_WRITE_ROLES.has(membership.role)) {
    return fail(
      "forbidden",
      "Only owners, admins, and schedulers can generate compliance packet snapshots.",
    )
  }
  return null
}

function mapGeneratedPacketRow(row: CompliancePacketDbRow): ProviderCompliancePacketRow | null {
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
  const workerName = workerNameFromEmbed(workerProfile)

  return {
    id: `compliance-packet-${row.id}`,
    packetId: row.id,
    bookingId: row.booking_id,
    timesheetId: row.timesheet_id ?? undefined,
    shiftId: booking.shift_id,
    siteId: shift.site_id,
    shiftTitle: `${workerName} · ${shiftTitle}`,
    siteName,
    shiftDate: `${dateLabel} · ${timeRange}`,
    status: "packet_generated",
    statusLabel: "Snapshot generated",
    packetType: "Shift compliance packet",
    generatedAt: row.generated_at ?? undefined,
    isSimulated: false,
    isSupabaseBacked: true,
    hasFile: false,
    missingItems: ["Generated packet file"],
  }
}

function mapApprovedTimesheetToPacket(row: ApprovedTimesheetComplianceRow): ProviderCompliancePacketRow | null {
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
  const workerName = workerNameFromEmbed(workerProfile)

  return {
    id: `compliance-approved-${row.id}`,
    timesheetId: row.id,
    bookingId: row.booking_id,
    shiftId: booking.shift_id,
    siteId: shift.site_id,
    shiftTitle: `${workerName} · ${shiftTitle}`,
    siteName,
    shiftDate: `${dateLabel} · ${timeRange}`,
    status: "ready_for_packet",
    statusLabel: "Ready for packet generation",
    packetType: "Shift compliance packet",
    generatedAt: row.approved_at ?? undefined,
    isSimulated: false,
    isSupabaseBacked: true,
    hasFile: false,
    missingItems: [...APPROVED_PACKET_MISSING],
  }
}

function mapShiftToCompliancePacket(row: ShiftComplianceRow): ProviderCompliancePacketRow {
  const site = unwrap(row.care_sites)
  const siteName = site?.name?.trim() || "Care site"
  const shiftTitle = shiftTitleFromRow(row)
  const dateLabel = formatDateLabel(row.starts_at)
  const timeRange = formatTimeRange(row.starts_at, row.ends_at)
  const booked = ["booked", "confirmed", "clocked_in", "pending_approval", "approved", "invoiced", "completed"].includes(
    row.status,
  )

  return {
    id: `compliance-prep-${row.id}`,
    shiftId: row.id,
    siteId: row.site_id,
    shiftTitle,
    siteName,
    shiftDate: `${dateLabel} · ${timeRange}`,
    status: booked ? "pending_timesheet" : "pending_worker",
    statusLabel: booked ? "Pending timesheet" : "Pending booking",
    packetType: "Shift compliance packet",
    isSimulated: true,
    missingItems: [...PREP_MISSING_ITEMS],
  }
}

function buildComplianceSnapshot(
  row: ApprovedTimesheetComplianceRow,
  generatedAt: string,
): Record<string, unknown> {
  const booking = row.bookings!
  const shift = unwrap(booking.shifts)!
  const site = unwrap(shift.care_sites)
  const workerProfile = unwrap(booking.worker_profiles)
  const hours = calculateHours(row.clock_in_at, row.clock_out_at, row.break_minutes)

  return {
    version: 1,
    booking_id: row.booking_id,
    timesheet_id: row.id,
    generated_at: generatedAt,
    shift: {
      id: shift.id,
      title: shift.title,
      role: shift.role,
      starts_at: shift.starts_at,
      ends_at: shift.ends_at,
      hourly_rate: shift.hourly_rate,
    },
    site: site
      ? {
          id: site.id,
          name: site.name,
          address: formatSiteAddress(site),
        }
      : null,
    worker: workerProfile
      ? {
          id: workerProfile.id,
          name: workerNameFromEmbed(workerProfile),
          headline: workerProfile.headline,
        }
      : null,
    timesheet: {
      id: row.id,
      status: row.status ?? "approved",
      hours,
      clock_in_at: row.clock_in_at ?? null,
      clock_out_at: row.clock_out_at ?? null,
      break_minutes: row.break_minutes ?? 0,
      approved_at: row.approved_at,
      approved_by: row.approved_by,
      provider_notes: row.provider_notes ?? null,
    },
    limitations: [...SNAPSHOT_LIMITATIONS],
  }
}

export async function listProviderCompliancePacketsFromSupabase(): Promise<
  ApiResult<ProviderCompliancePacketRow[]>
> {
  try {
    const membershipResult = await loadProviderMembership()
    if (!membershipResult.ok) {
      return membershipResult
    }
    if (!membershipResult.data) {
      return ok([])
    }

    const providerId = membershipResult.data.providerId
    const supabase = getSupabaseClient()

    const { data: packetData, error: packetError } = await supabase
      .from("compliance_packets")
      .select(COMPLIANCE_PACKET_SELECT)
      .eq("bookings.shifts.provider_id", providerId)
      .order("generated_at", { ascending: false })

    if (packetError) {
      return fail(
        "compliance_packets_load",
        friendlyDbMessage(packetError, "Unable to load compliance packets."),
      )
    }

    const generatedPackets = ((packetData ?? []) as CompliancePacketDbRow[])
      .map(mapGeneratedPacketRow)
      .filter((r): r is ProviderCompliancePacketRow => r != null)

    const packetTimesheetIds = new Set(
      generatedPackets.map(p => p.timesheetId).filter((id): id is string => Boolean(id)),
    )
    const packetBookingIds = new Set(
      generatedPackets.map(p => p.bookingId).filter((id): id is string => Boolean(id)),
    )

    const { data: approvedData, error: approvedError } = await supabase
      .from("timesheets")
      .select(APPROVED_TIMESHEET_COMPLIANCE_SELECT)
      .eq("bookings.shifts.provider_id", providerId)
      .eq("status", "approved")
      .order("approved_at", { ascending: false })

    if (approvedError) {
      return fail(
        "compliance_approved_load",
        friendlyDbMessage(approvedError, "Unable to load approved timesheets for compliance."),
      )
    }

    const readyPackets = ((approvedData ?? []) as ApprovedTimesheetComplianceRow[])
      .filter(row => !packetTimesheetIds.has(row.id) && !packetBookingIds.has(row.booking_id))
      .map(mapApprovedTimesheetToPacket)
      .filter((r): r is ProviderCompliancePacketRow => r != null)

    const coveredShiftIds = new Set([
      ...generatedPackets.map(p => p.shiftId),
      ...readyPackets.map(p => p.shiftId),
    ])

    const { data: rows, error } = await supabase
      .from("shifts")
      .select(SHIFT_COMPLIANCE_SELECT)
      .eq("provider_id", providerId)
      .order("starts_at", { ascending: false })

    if (error) {
      return fail(
        "compliance_shifts_load",
        friendlyDbMessage(error, "Unable to load compliance readiness."),
      )
    }

    const prepPackets = ((rows ?? []) as ShiftComplianceRow[])
      .filter(row => !coveredShiftIds.has(row.id))
      .map(mapShiftToCompliancePacket)

    return ok([...generatedPackets, ...readyPackets, ...prepPackets])
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function generateProviderCompliancePacketFromApprovedTimesheetInSupabase(
  timesheetId: string,
): Promise<ApiResult<ProviderCompliancePacketGenerationResult>> {
  try {
    const membershipResult = await loadProviderMembership()
    if (!membershipResult.ok) return membershipResult
    if (!membershipResult.data) {
      return fail("no_provider", "Join or create a provider organization before generating packets.")
    }

    const forbidden = assertCanGeneratePackets(membershipResult.data)
    if (forbidden && !forbidden.ok) return forbidden

    const supabase = getSupabaseClient()
    const providerId = membershipResult.data.providerId

    const { data: timesheetRow, error: timesheetError } = await supabase
      .from("timesheets")
      .select(APPROVED_TIMESHEET_COMPLIANCE_SELECT)
      .eq("id", timesheetId)
      .eq("status", "approved")
      .eq("bookings.shifts.provider_id", providerId)
      .maybeSingle()

    if (timesheetError) {
      return fail(
        "timesheet_load",
        friendlyDbMessage(timesheetError, "Unable to load timesheet for packet generation."),
      )
    }

    if (!timesheetRow) {
      return fail(
        "timesheet_not_found",
        "Approved timesheet not found for your organization.",
      )
    }

    const row = timesheetRow as ApprovedTimesheetComplianceRow
    const booking = row.bookings
    if (!booking) {
      return fail("booking_missing", "Booking data is missing for this timesheet.")
    }

    const { data: existingByTimesheet } = await supabase
      .from("compliance_packets")
      .select("id, generated_at")
      .eq("timesheet_id", timesheetId)
      .maybeSingle()

    if (existingByTimesheet) {
      const existing = existingByTimesheet as { id: string; generated_at: string | null }
      return ok({
        packetId: existing.id,
        bookingId: row.booking_id,
        timesheetId,
        status: "generated",
        message: "A compliance packet snapshot already exists for this timesheet.",
        generatedAt: existing.generated_at ?? new Date().toISOString(),
        limitations: [...SNAPSHOT_LIMITATIONS],
      })
    }

    const { data: existingByBooking } = await supabase
      .from("compliance_packets")
      .select("id, generated_at, timesheet_id")
      .eq("booking_id", row.booking_id)
      .maybeSingle()

    if (existingByBooking) {
      const existing = existingByBooking as {
        id: string
        generated_at: string | null
        timesheet_id: string | null
      }
      return ok({
        packetId: existing.id,
        bookingId: row.booking_id,
        timesheetId: existing.timesheet_id ?? timesheetId,
        status: "generated",
        message: "A compliance packet snapshot already exists for this booking.",
        generatedAt: existing.generated_at ?? new Date().toISOString(),
        limitations: [...SNAPSHOT_LIMITATIONS],
      })
    }

    const now = new Date().toISOString()
    const snapshot = buildComplianceSnapshot(row, now)

    const { data: inserted, error: insertError } = await supabase
      .from("compliance_packets")
      .insert({
        booking_id: row.booking_id,
        timesheet_id: timesheetId,
        status: "generated",
        snapshot,
        generated_at: now,
        generated_by: membershipResult.data.userId,
        packet_version: 1,
      })
      .select("id, booking_id, status, generated_at")
      .single()

    if (insertError || !inserted) {
      return fail(
        "packet_insert",
        friendlyDbMessage(insertError ?? {}, "Unable to create compliance packet snapshot."),
      )
    }

    const packet = inserted as {
      id: string
      booking_id: string
      status: string
      generated_at: string
    }

    return ok({
      packetId: packet.id,
      bookingId: packet.booking_id,
      timesheetId,
      status: packet.status,
      message:
        "Compliance packet snapshot record created. PDF and file generation are not connected yet.",
      generatedAt: packet.generated_at ?? now,
      limitations: [...SNAPSHOT_LIMITATIONS],
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
