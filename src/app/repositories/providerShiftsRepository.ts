import type { ApiResult } from "../api/types"
import type { Role, Shift, ShiftLifecycleStatus } from "../data/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  ProviderShiftCreatePayload,
  ProviderShiftCreateResult,
} from "../services/types"

export type ProviderShiftListRow = Shift & { assignedWorkerName: string | null }

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(
  err: { message?: string; code?: string },
  fallback: string,
  context: "post" | "load" = "post",
): string {
  const raw = err.message ?? fallback
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return context === "load"
      ? "Loading shifts is blocked by database permissions (RLS). Apply provider shifts policies (0004) on your Supabase project."
      : "Shift posting is blocked by database permissions (RLS). Apply provider shifts policies (0004) on your Supabase project."
  }
  return raw
}

type ProviderMembership = {
  providerId: string
}

async function loadProviderMembership(options?: {
  notAuthenticatedMessage?: string
  dbContext?: "post" | "load"
}): Promise<ApiResult<ProviderMembership | null>> {
  const supabase = getSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return fail(
      "not_authenticated",
      options?.notAuthenticatedMessage ??
        "Sign in with Supabase before posting a shift.",
    )
  }

  const dbContext = options?.dbContext ?? "post"
  const { data: rows, error } = await supabase
    .from("provider_members")
    .select("provider_id")
    .eq("user_id", session.user.id)
    .limit(1)

  if (error) {
    return fail(
      "provider_membership_load",
      friendlyDbMessage(error, "Unable to load provider membership.", dbContext),
    )
  }

  const row = rows?.[0] as { provider_id: string } | undefined
  if (!row?.provider_id) {
    return ok(null)
  }

  return ok({ providerId: row.provider_id })
}

type CareSiteEmbed = {
  id: string
  name: string
  site_type: string | null
  city: string | null
  state: string | null
  address_line1: string | null
  address_line2: string | null
}

type ShiftListRow = {
  id: string
  provider_id: string
  site_id: string
  title: string | null
  role: string | null
  starts_at: string
  ends_at: string
  hourly_rate: number | string | null
  status: string
  is_urgent: boolean
  care_sites: CareSiteEmbed | CareSiteEmbed[] | null
}

function asWorkRole(role: string | null | undefined): Role {
  const r = role?.trim() ?? ""
  const known: Role[] = ["DSP", "CNA", "Medication Aide", "LPN", "RN", "Caregiver"]
  if (known.includes(r as Role)) return r as Role
  return "Caregiver"
}

function formatSiteAddress(site: CareSiteEmbed | null | undefined): string {
  if (!site) return "—"
  const parts = [
    site.address_line1,
    site.address_line2,
    [site.city, site.state].filter(Boolean).join(", "),
  ].filter((p): p is string => Boolean(p?.trim()))
  return parts.join(", ").trim() || "—"
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

function parseHourlyRate(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const n = typeof value === "number" ? value : Number.parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

function formatHourlyPayDisplay(rate: number | null): string {
  if (rate == null) return "—"
  return `$${rate.toFixed(2)}/hr`
}

function formatEstimatedTotal(startsAt: string, endsAt: string, rate: number | null): string {
  if (rate == null) return "—"
  const hours = (Date.parse(endsAt) - Date.parse(startsAt)) / (1000 * 60 * 60)
  if (!Number.isFinite(hours) || hours <= 0) return "—"
  return `$${Math.round(hours * rate)}`
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
  return map[dbStatus] ?? "Open"
}

function mapProviderBoardStatus(
  dbStatus: string,
  isUrgent: boolean,
): Shift["providerBoardStatus"] {
  if (isUrgent && ["open", "requested", "draft"].includes(dbStatus)) return "urgent"
  if (
    ["booked", "confirmed", "clocked_in", "completed", "approved", "invoiced"].includes(
      dbStatus,
    )
  ) {
    return "covered"
  }
  return "pending"
}

function unwrapCareSite(embed: CareSiteEmbed | CareSiteEmbed[] | null): CareSiteEmbed | null {
  if (!embed) return null
  return Array.isArray(embed) ? embed[0] ?? null : embed
}

type CredentialEmbed = {
  id: string
  name: string
  credential_type: string | null
}

type ShiftRequirementRow = {
  credential_id: string
  required: boolean | null
  credentials: CredentialEmbed | CredentialEmbed[] | null
}

function unwrapCredential(
  embed: CredentialEmbed | CredentialEmbed[] | null,
): CredentialEmbed | null {
  if (!embed) return null
  return Array.isArray(embed) ? embed[0] ?? null : embed
}

function extractDutyNotes(title: string | null, role: string | null): string | undefined {
  const t = title?.trim()
  if (!t || !t.includes(":")) return undefined
  const roleBase = role?.trim() ? `${role.trim()} shift` : null
  if (roleBase && t.toLowerCase().startsWith(roleBase.toLowerCase())) {
    const rest = t.slice(t.indexOf(":") + 1).trim()
    return rest || undefined
  }
  const rest = t.split(":").slice(1).join(":").trim()
  return rest || undefined
}

function mapShiftRow(
  row: ShiftListRow,
  options?: { credentialNames?: string[]; forDetail?: boolean },
): ProviderShiftListRow {
  const site = unwrapCareSite(row.care_sites)
  const credentialNames = options?.credentialNames ?? []
  const dutyNotes = options?.forDetail ? extractDutyNotes(row.title, row.role) : undefined
  const roleTitle = options?.forDetail
    ? row.role?.trim() || row.title?.trim()?.split(":")[0]?.trim() || "Shift"
    : row.title?.trim() || row.role?.trim() || "Shift"
  const workRole = asWorkRole(row.role)
  const rate = parseHourlyRate(row.hourly_rate)

  return {
    id: row.id,
    roleTitle,
    workRole,
    siteId: row.site_id,
    siteName: site?.name?.trim() || "Care site",
    providerOrgId: row.provider_id,
    providerName: "",
    dateLabel: formatDateLabel(row.starts_at),
    timeRange: formatTimeRange(row.starts_at, row.ends_at),
    hourlyPayDisplay: formatHourlyPayDisplay(rate),
    estimatedTotalDisplay: formatEstimatedTotal(row.starts_at, row.ends_at, rate),
    distanceMiles: "—",
    credentialTags: credentialNames,
    workerFeedCardStatus: "ready",
    providerBoardStatus: mapProviderBoardStatus(row.status, row.is_urgent),
    assignedWorkerId: null,
    assignedWorkerName: null,
    lifecycleStatus: mapLifecycleStatus(row.status),
    showOnWorkerFeed: false,
    facilitySettingLabel: site?.site_type?.trim() || "Care site",
    streetAddress: formatSiteAddress(site),
    duties: dutyNotes ? [dutyNotes] : [],
    requiredCredentialsDisplayed: credentialNames,
    isUrgent: row.is_urgent,
  }
}

function mapShiftListRow(row: ShiftListRow): ProviderShiftListRow {
  return mapShiftRow(row)
}

async function loadShiftCredentialNames(
  supabase: ReturnType<typeof getSupabaseClient>,
  shiftId: string,
): Promise<ApiResult<string[]>> {
  const { data: rows, error } = await supabase
    .from("shift_requirements")
    .select(
      `
      credential_id,
      required,
      credentials (
        id,
        name,
        credential_type
      )
    `,
    )
    .eq("shift_id", shiftId)

  if (error) {
    return fail(
      "shift_requirements_load",
      friendlyDbMessage(error, "Unable to load shift credential requirements.", "load"),
    )
  }

  const names = ((rows ?? []) as ShiftRequirementRow[])
    .map(r => unwrapCredential(r.credentials)?.name?.trim())
    .filter((n): n is string => Boolean(n))

  return ok(names)
}

const SHIFT_LIST_SELECT = `
  id,
  provider_id,
  site_id,
  title,
  role,
  starts_at,
  ends_at,
  hourly_rate,
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
`

function buildShiftTitle(payload: ProviderShiftCreatePayload): string {
  const base = payload.title.trim() || payload.role.trim()
  const notes = payload.notes?.trim()
  if (!notes) return base
  const combined = `${base}: ${notes}`
  return combined.length > 500 ? combined.slice(0, 497) + "…" : combined
}

export async function createProviderShiftInSupabase(
  payload: ProviderShiftCreatePayload,
): Promise<ApiResult<ProviderShiftCreateResult>> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      return fail("not_authenticated", "Sign in with Supabase before posting a shift.")
    }

    const membershipResult = await loadProviderMembership()
    if (!membershipResult.ok) {
      return membershipResult
    }
    if (!membershipResult.data) {
      return fail(
        "provider_setup_required",
        "Complete provider setup before posting a shift.",
      )
    }

    const providerId = membershipResult.data.providerId
    const siteId = payload.siteId?.trim()
    if (!siteId) {
      return fail("validation", "Select a care site for this shift.")
    }

    const role = payload.role?.trim()
    if (!role) {
      return fail("validation", "Select a role for this shift.")
    }

    const startsAt = payload.startsAt?.trim()
    const endsAt = payload.endsAt?.trim()
    if (!startsAt || !endsAt) {
      return fail("validation", "Start and end date/time are required.")
    }

    const startMs = Date.parse(startsAt)
    const endMs = Date.parse(endsAt)
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return fail("validation", "Enter valid start and end date/time values.")
    }
    if (endMs <= startMs) {
      return fail("validation", "End time must be after start time.")
    }

    const hourlyRate = payload.hourlyRate
    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
      return fail("validation", "Enter a valid provider bill rate.")
    }

    const { data: siteRow, error: siteError } = await supabase
      .from("care_sites")
      .select("id")
      .eq("id", siteId)
      .eq("provider_id", providerId)
      .maybeSingle()

    if (siteError) {
      return fail("care_site_verify", friendlyDbMessage(siteError, "Unable to verify care site."))
    }
    if (!siteRow) {
      return fail("care_site_invalid", "Selected site is not available for your organization.")
    }

    const billRateCents = Math.round(hourlyRate * 100)

    const { data: shiftRow, error: shiftError } = await supabase
      .from("shifts")
      .insert({
        provider_id: providerId,
        site_id: siteId,
        title: buildShiftTitle(payload),
        role,
        starts_at: startsAt,
        ends_at: endsAt,
        hourly_rate: hourlyRate,
        bill_rate_cents: billRateCents,
        currency: "usd",
        rate_type: "hourly",
        status: "open",
        is_urgent: payload.isUrgent ?? false,
        created_by: session.user.id,
      })
      .select("id, status, created_at")
      .single()

    if (shiftError || !shiftRow) {
      return fail(
        "shift_insert",
        friendlyDbMessage(shiftError ?? { message: "Unknown error" }, "Unable to post shift."),
      )
    }

    const shiftId = (shiftRow as { id: string }).id
    const createdAt = (shiftRow as { created_at: string }).created_at
    const status = (shiftRow as { status: string }).status || "open"

    const credentialIds = payload.requiredCredentialIds?.filter(Boolean) ?? []
    if (credentialIds.length > 0) {
      const requirementRows = credentialIds.map(credentialId => ({
        shift_id: shiftId,
        credential_id: credentialId,
        required: true,
      }))

      const { error: reqError } = await supabase.from("shift_requirements").insert(requirementRows)

      if (reqError) {
        return fail(
          "shift_requirements_insert",
          friendlyDbMessage(
            reqError,
            "Shift was posted but required credentials could not be saved. Update requirements in Supabase or try again.",
          ),
        )
      }
    }

    return ok({
      shiftId,
      status,
      message: "Shift posted",
      createdAt,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function listProviderShiftsFromSupabase(): Promise<
  ApiResult<ProviderShiftListRow[]>
> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      return fail("not_authenticated", "Sign in with Supabase before loading shifts.")
    }

    const membershipResult = await loadProviderMembership({
      notAuthenticatedMessage: "Sign in with Supabase before loading shifts.",
      dbContext: "load",
    })
    if (!membershipResult.ok) {
      return membershipResult
    }
    if (!membershipResult.data) {
      return ok([])
    }

    const { data: rows, error } = await supabase
      .from("shifts")
      .select(SHIFT_LIST_SELECT)
      .eq("provider_id", membershipResult.data.providerId)
      .order("starts_at", { ascending: true })

    if (error) {
      return fail(
        "shifts_list",
        friendlyDbMessage(error, "Unable to load shifts.", "load"),
      )
    }

    const shifts = ((rows ?? []) as ShiftListRow[]).map(mapShiftListRow)
    return ok(shifts)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function getProviderShiftFromSupabase(
  shiftId: string,
): Promise<ApiResult<ProviderShiftListRow | null>> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      return fail("not_authenticated", "Sign in with Supabase before loading this shift.")
    }

    const membershipResult = await loadProviderMembership({
      notAuthenticatedMessage: "Sign in with Supabase before loading this shift.",
      dbContext: "load",
    })
    if (!membershipResult.ok) {
      return membershipResult
    }
    if (!membershipResult.data) {
      return ok(null)
    }

    const { data: row, error } = await supabase
      .from("shifts")
      .select(SHIFT_LIST_SELECT)
      .eq("id", shiftId)
      .eq("provider_id", membershipResult.data.providerId)
      .maybeSingle()

    if (error) {
      return fail(
        "shift_load",
        friendlyDbMessage(error, "Unable to load shift.", "load"),
      )
    }
    if (!row) {
      return ok(null)
    }

    const credResult = await loadShiftCredentialNames(supabase, shiftId)
    if (!credResult.ok) {
      return credResult
    }

    return ok(
      mapShiftRow(row as ShiftListRow, {
        credentialNames: credResult.data,
        forDetail: true,
      }),
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
