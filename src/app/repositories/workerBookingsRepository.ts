import type { ApiResult } from "../api/types"
import type { Role, Shift, ShiftLifecycleStatus } from "../data/types"
import {
  formatEstimatedTotalFromWorkerRate,
  formatWorkerPayDisplayFromSnapshot,
} from "../lib/workerRateCents"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  WorkerBookingCard,
  WorkerBookingStatus,
  WorkerBookingsPayload,
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
  confirmed_at: string | null
  created_at: string
  worker_rate_cents_snapshot: number | null
  currency_snapshot: string | null
  rate_type_snapshot: string | null
  rate_snapshot_at: string | null
  shifts: ShiftEmbed | ShiftEmbed[] | null
}

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Loading bookings is blocked by database permissions (RLS). Apply booking policies (0010) and worker bookings shift read (0011) on your Supabase project."
  }
  return raw
}

function unwrap<T>(embed: T | T[] | null): T | null {
  if (!embed) return null
  return Array.isArray(embed) ? embed[0] ?? null : embed
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

function parseWorkerRateCentsSnapshot(value: number | null | undefined): number | null {
  if (value == null || value < 0) return null
  return value
}

function mapShiftForBooking(shift: ShiftEmbed, snapshot: BookingRateSnapshot): Shift {
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

function statusDisplayLabel(status: WorkerBookingStatus): string {
  switch (status) {
    case "confirmed":
      return "Confirmed"
    case "pending":
      return "Pending"
    case "cancelled_by_worker":
      return "Cancelled by you"
    case "cancelled_by_provider":
      return "Cancelled by facility"
    case "completed":
      return "Completed"
    case "no_show":
      return "No show"
    case "disputed":
      return "Disputed"
    default:
      return "Booking"
  }
}

function isUpcomingBooking(
  bookingStatus: WorkerBookingStatus,
  endsAt: string,
): boolean {
  if (
    bookingStatus === "cancelled_by_worker" ||
    bookingStatus === "cancelled_by_provider" ||
    bookingStatus === "completed" ||
    bookingStatus === "no_show" ||
    bookingStatus === "disputed"
  ) {
    return false
  }
  const end = Date.parse(endsAt)
  if (!Number.isFinite(end)) return bookingStatus === "confirmed" || bookingStatus === "pending"
  return end >= Date.now()
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

type ParsedBooking = {
  card: WorkerBookingCard
  startsAt: string
  endsAt: string
  bookingStatus: WorkerBookingStatus
}

function parseBookingRow(row: BookingRow): ParsedBooking | null {
  const shift = unwrap(row.shifts)
  if (!shift) return null

  const bookingStatus = mapBookingStatus(row.status)
  const shiftMapped = mapShiftForBooking(shift, {
    workerRateCentsSnapshot: row.worker_rate_cents_snapshot,
    currencySnapshot: row.currency_snapshot,
    rateTypeSnapshot: row.rate_type_snapshot,
  })

  return {
    card: {
      shift: shiftMapped,
      statusDisplay: statusDisplayLabel(bookingStatus),
    },
    startsAt: shift.starts_at,
    endsAt: shift.ends_at,
    bookingStatus,
  }
}

export async function listWorkerBookingsFromSupabase(): Promise<
  ApiResult<WorkerBookingsPayload>
> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return fail(
        "not_authenticated",
        "Sign in with Supabase before loading bookings.",
      )
    }

    const profileRes = await resolveWorkerProfileId(supabase, session.user.id)
    if (!profileRes.ok) return profileRes
    if (!profileRes.data) {
      return ok({ upcoming: [], completed: [] })
    }

    const workerId = profileRes.data

    const { data: rows, error } = await supabase
      .from("bookings")
      .select(
        `
        id,
        shift_id,
        worker_id,
        status,
        confirmed_at,
        created_at,
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
      `,
      )
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false })

    if (error) {
      return fail("bookings_load", friendlyDbMessage(error, "Unable to load bookings."))
    }

    const upcomingParsed: ParsedBooking[] = []
    const completedParsed: ParsedBooking[] = []

    for (const row of (rows ?? []) as BookingRow[]) {
      const parsed = parseBookingRow(row)
      if (!parsed) continue
      if (isUpcomingBooking(parsed.bookingStatus, parsed.endsAt)) {
        upcomingParsed.push(parsed)
      } else {
        completedParsed.push(parsed)
      }
    }

    upcomingParsed.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    completedParsed.sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))

    return ok({
      upcoming: upcomingParsed.map(p => p.card),
      completed: completedParsed.map(p => p.card),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function getWorkerBookingForShiftFromSupabase(
  shiftId: string,
): Promise<ApiResult<{ bookingId: string; status: WorkerBookingStatus } | null>> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return ok(null)
    }

    const profileRes = await resolveWorkerProfileId(supabase, session.user.id)
    if (!profileRes.ok || !profileRes.data) {
      return ok(null)
    }

    const { data, error } = await supabase
      .from("bookings")
      .select("id, status")
      .eq("shift_id", shiftId)
      .eq("worker_id", profileRes.data)
      .maybeSingle()

    if (error) {
      return fail(
        "booking_load",
        friendlyDbMessage(error, "Unable to load booking."),
      )
    }

    if (!data) {
      return ok(null)
    }

    const row = data as { id: string; status: string }
    return ok({
      bookingId: row.id,
      status: mapBookingStatus(row.status),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
