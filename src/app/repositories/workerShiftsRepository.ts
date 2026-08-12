import type { ApiResult } from "../api/types"
import type { CareSite, Role, Shift, ShiftLifecycleStatus } from "../data/types"
import {
  formatEstimatedTotalFromWorkerRate,
  formatWorkerPayDisplay,
} from "../lib/workerRateCents"
import { getSupabaseClient } from "../lib/supabaseClient"
import type { WorkerShiftReadiness } from "../services/types"

type CareSiteEmbed = {
  id: string
  name: string
  site_type: string | null
  city: string | null
  state: string | null
  address_line1: string | null
  address_line2: string | null
}

type ShiftRow = {
  id: string
  provider_id: string
  site_id: string
  title: string | null
  role: string | null
  starts_at: string
  ends_at: string
  worker_rate_cents: number | null
  currency: string | null
  rate_type: string | null
  status: string
  is_urgent: boolean
  care_sites: CareSiteEmbed | CareSiteEmbed[] | null
}

const OPEN_SHIFT_SELECT = `
  id,
  provider_id,
  site_id,
  title,
  role,
  starts_at,
  ends_at,
  worker_rate_cents,
  currency,
  rate_type,
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

type CredentialEmbed = {
  id: string
  name: string
  credential_type: string | null
}

type ShiftRequirementRow = {
  shift_id: string
  credential_id: string
  required: boolean | null
  credentials: CredentialEmbed | CredentialEmbed[] | null
}

type WorkerCredentialStatusRow = {
  credential_id: string
  status: string
}

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (/worker_rate_cents|bill_rate_cents|column.*does not exist|42703/i.test(raw)) {
    return "Worker pay rates are not available yet. Apply the worker/bill rate migration first."
  }
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Loading shifts is blocked by database permissions (RLS). Apply worker shift discovery policies (0007) on your Supabase project."
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
  if (!site) return "Address available after booking"
  const parts = [
    site.address_line1,
    site.address_line2,
    [site.city, site.state].filter(Boolean).join(", "),
  ].filter((p): p is string => Boolean(p?.trim()))
  return parts.join(", ").trim() || "Address available after booking"
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

function credentialSatisfiesRequirement(status: string | undefined): boolean {
  return status === "verified" || status === "pending" || status === "expiring_soon"
}

function computeReadiness(
  requiredNames: string[],
  workerCredById: Map<string, string>,
  requirementIds: string[],
  credentialNameById: Map<string, string>,
): WorkerShiftReadiness {
  if (requirementIds.length === 0) {
    return {
      isReady: true,
      missingCredentialNames: [],
      matchedCredentialNames: [],
      statusLabel: "No required credentials listed",
    }
  }

  if (workerCredById.size === 0) {
    return {
      isReady: false,
      missingCredentialNames: requiredNames,
      matchedCredentialNames: [],
      statusLabel: "Complete your profile to check readiness.",
    }
  }

  const matched: string[] = []
  const missing: string[] = []

  for (const credId of requirementIds) {
    const name = credentialNameById.get(credId) ?? "Credential"
    const status = workerCredById.get(credId)
    if (credentialSatisfiesRequirement(status)) {
      matched.push(name)
    } else {
      missing.push(name)
    }
  }

  const isReady = missing.length === 0
  return {
    isReady,
    missingCredentialNames: missing,
    matchedCredentialNames: matched,
    statusLabel: isReady
      ? "Ready to apply (credentials on file)"
      : `Missing: ${missing.join(", ")}`,
  }
}

function mapShiftRow(
  row: ShiftRow,
  credentialNames: string[],
  readiness: WorkerShiftReadiness,
): Shift | null {
  const workerRateCents = row.worker_rate_cents
  if (workerRateCents == null || workerRateCents < 0) {
    return null
  }

  const payDisplay = formatWorkerPayDisplay(workerRateCents, row.rate_type)
  if (!payDisplay) {
    return null
  }

  const site = unwrap(row.care_sites)
  const roleTitle = row.title?.trim() || row.role?.trim() || "Open shift"

  return {
    id: row.id,
    roleTitle,
    workRole: asWorkRole(row.role),
    siteId: row.site_id,
    siteName: site?.name?.trim() || "Care site",
    providerOrgId: row.provider_id,
    providerName: "Facility partner",
    dateLabel: formatDateLabel(row.starts_at),
    timeRange: formatTimeRange(row.starts_at, row.ends_at),
    hourlyPayDisplay: payDisplay,
    workerRateCents,
    currency: row.currency ?? undefined,
    rateType: row.rate_type ?? undefined,
    workerPayDisplay: payDisplay,
    estimatedTotalDisplay: formatEstimatedTotalFromWorkerRate(
      row.starts_at,
      row.ends_at,
      workerRateCents,
      row.rate_type,
    ),
    distanceMiles: "—",
    credentialTags: credentialNames,
    workerFeedCardStatus: readiness.isReady ? "ready" : "preferred",
    providerBoardStatus: row.is_urgent ? "urgent" : "pending",
    assignedWorkerId: null,
    lifecycleStatus: mapLifecycleStatus(row.status),
    showOnWorkerFeed: true,
    facilitySettingLabel: site?.site_type?.trim() || "Care site",
    streetAddress: formatSiteAddress(site),
    duties: [],
    requiredCredentialsDisplayed: credentialNames,
    isUrgent: row.is_urgent,
    isReadyMatch: readiness.isReady,
    workerShiftReadiness: readiness,
    isSupabaseDiscovery: true,
  }
}

function mapCareSite(
  site: CareSiteEmbed | null,
  siteId: string,
  providerOrgId: string,
): CareSite | undefined {
  if (!site) return undefined
  return {
    id: siteId,
    name: site.name,
    facilityType: site.site_type ?? "Care site",
    providerOrgId,
    address: formatSiteAddress(site),
    residents: 0,
    preferredWorkerSlots: 0,
    operationalStatus: "active",
  }
}

async function loadWorkerCredentialMap(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string | undefined,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!userId) return map

  const { data: workerProfile } = await supabase
    .from("worker_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  const workerId = (workerProfile as { id: string } | null)?.id
  if (!workerId) return map

  const { data: wcRows } = await supabase
    .from("worker_credentials")
    .select("credential_id, status")
    .eq("worker_id", workerId)

  for (const row of (wcRows ?? []) as WorkerCredentialStatusRow[]) {
    map.set(row.credential_id, row.status)
  }
  return map
}

async function loadRequirementsForShifts(
  supabase: ReturnType<typeof getSupabaseClient>,
  shiftIds: string[],
): Promise<Map<string, { names: string[]; ids: string[] }>> {
  const result = new Map<string, { names: string[]; ids: string[] }>()
  if (shiftIds.length === 0) return result

  const { data: reqRows, error } = await supabase
    .from("shift_requirements")
    .select("shift_id, credential_id, required, credentials(id, name, credential_type)")
    .in("shift_id", shiftIds)

  if (error) return result

  for (const raw of (reqRows ?? []) as ShiftRequirementRow[]) {
    if (raw.required === false) continue
    const cred = unwrap(raw.credentials)
    if (!cred) continue
    const entry = result.get(raw.shift_id) ?? { names: [], ids: [] }
    entry.names.push(cred.name)
    entry.ids.push(raw.credential_id)
    result.set(raw.shift_id, entry)
  }
  return result
}

export async function listWorkerShiftsFromSupabase(): Promise<ApiResult<Shift[]>> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const { data: shiftRows, error: shiftErr } = await supabase
      .from("shifts")
      .select(OPEN_SHIFT_SELECT)
      .eq("status", "open")
      .not("worker_rate_cents", "is", null)
      .order("starts_at", { ascending: true })

    if (shiftErr) {
      return fail("shifts_load", friendlyDbMessage(shiftErr, "Unable to load open shifts."))
    }

    const rows = (shiftRows ?? []) as ShiftRow[]
    const shiftIds = rows.map(r => r.id)
    const requirementsByShift = await loadRequirementsForShifts(supabase, shiftIds)
    const workerCredById = await loadWorkerCredentialMap(supabase, session?.user?.id)

    const credentialNameById = new Map<string, string>()
    for (const req of requirementsByShift.values()) {
      req.ids.forEach((id, i) => {
        credentialNameById.set(id, req.names[i] ?? "Credential")
      })
    }

    const shifts = rows
      .map(row => {
        const req = requirementsByShift.get(row.id) ?? { names: [], ids: [] }
        const readiness = computeReadiness(
          req.names,
          workerCredById,
          req.ids,
          credentialNameById,
        )
        return mapShiftRow(row, req.names, readiness)
      })
      .filter((s): s is Shift => s != null)

    return ok(shifts)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function getWorkerShiftFromSupabase(
  shiftId: string,
): Promise<ApiResult<{ shift: Shift; site: CareSite | undefined } | null>> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const { data: row, error: shiftErr } = await supabase
      .from("shifts")
      .select(OPEN_SHIFT_SELECT)
      .eq("id", shiftId)
      .eq("status", "open")
      .not("worker_rate_cents", "is", null)
      .maybeSingle()

    if (shiftErr) {
      return fail("shift_load", friendlyDbMessage(shiftErr, "Unable to load shift."))
    }

    if (!row) {
      return ok(null)
    }

    const shiftRow = row as ShiftRow
    const requirementsByShift = await loadRequirementsForShifts(supabase, [shiftId])
    const req = requirementsByShift.get(shiftId) ?? { names: [], ids: [] }
    const workerCredById = await loadWorkerCredentialMap(supabase, session?.user?.id)
    const credentialNameById = new Map<string, string>()
    req.ids.forEach((id, i) => credentialNameById.set(id, req.names[i] ?? "Credential"))

    const readiness = computeReadiness(req.names, workerCredById, req.ids, credentialNameById)
    const shift = mapShiftRow(shiftRow, req.names, readiness)
    if (!shift) {
      return ok(null)
    }

    const site = mapCareSite(unwrap(shiftRow.care_sites), shiftRow.site_id, shiftRow.provider_id)

    return ok({ shift, site })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
