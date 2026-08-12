import type { ApiResult } from "../api/types"
import { getCurrentAdminRoleFromSupabase } from "../auth/supabaseAdminAuth"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  AdminIncidentQueuePayload,
  AdminIncidentRow,
  AdminIncidentSeverity,
  AdminIncidentStatus,
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
    return "Admin incident reads are blocked by database permissions (RLS). Apply migration 0022 on your Supabase project."
  }
  return raw
}

async function requireAdminSession(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<ApiResult<{ userId: string }>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return fail("not_authenticated", "Sign in at /auth/admin before viewing incidents.")
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

function parseSeverity(raw: string | null | undefined): AdminIncidentSeverity {
  switch (raw) {
    case "low":
    case "medium":
    case "high":
    case "critical":
      return raw
    default:
      return "medium"
  }
}

function parseIncidentStatus(raw: string | null | undefined): AdminIncidentStatus {
  switch (raw) {
    case "open":
    case "under_review":
    case "awaiting_statement":
    case "resolved":
    case "escalated":
      return raw
    default:
      return "open"
  }
}

function mapSafetyStatus(raw: string | null | undefined): AdminIncidentStatus {
  switch (raw) {
    case "under_review":
      return "under_review"
    case "resolved":
      return "resolved"
    case "submitted":
    default:
      return "open"
  }
}

function severityRank(severity: AdminIncidentSeverity): number {
  switch (severity) {
    case "critical":
      return 4
    case "high":
      return 3
    case "medium":
      return 2
    default:
      return 1
  }
}

function statusRank(status: AdminIncidentStatus): number {
  switch (status) {
    case "open":
      return 4
    case "escalated":
      return 3
    case "under_review":
    case "awaiting_statement":
      return 2
    default:
      return 0
  }
}

function sortRows(rows: AdminIncidentRow[]): AdminIncidentRow[] {
  return [...rows].sort((a, b) => {
    const sev = severityRank(b.severity) - severityRank(a.severity)
    if (sev !== 0) return sev
    const st = statusRank(b.status) - statusRank(a.status)
    if (st !== 0) return st
    const aTime = a.updatedAt ?? a.createdAt ?? ""
    const bTime = b.updatedAt ?? b.createdAt ?? ""
    return bTime.localeCompare(aTime)
  })
}

function shiftLabelFromEmbed(shift: {
  title?: string | null
  role?: string | null
  starts_at?: string | null
} | null | undefined): string | undefined {
  if (!shift) return undefined
  const role = shift.role?.trim() || shift.title?.trim()
  if (shift.starts_at) {
    const d = new Date(shift.starts_at)
    if (!Number.isNaN(d.getTime())) {
      const when = d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
      return role ? `${role} · ${when}` : when
    }
  }
  return role || undefined
}

type IncidentDbRow = {
  id: string
  shift_id: string | null
  worker_id: string | null
  provider_id: string | null
  site_id: string | null
  severity: string
  status: string
  incident_type: string | null
  summary: string | null
  created_at: string
  updated_at: string
  worker_profiles?: { headline?: string | null } | null
  provider_organizations?: { name?: string | null } | null
  shifts?: { title?: string | null; role?: string | null; starts_at?: string | null } | null
}

type SafetyReportDbRow = {
  id: string
  worker_id: string
  shift_id: string | null
  issue_type: string | null
  details: string | null
  urgent_contact_requested: boolean
  status: string
  created_at: string
  updated_at: string
  worker_profiles?: { headline?: string | null } | null
  shifts?: { title?: string | null; role?: string | null; starts_at?: string | null } | null
}

function mapIncidentRow(row: IncidentDbRow): AdminIncidentRow {
  const incidentType = row.incident_type?.trim()
  const summary = row.summary?.trim()
  return {
    id: row.id,
    source: "incident",
    title: incidentType || summary?.slice(0, 80) || "Incident",
    summary: summary || undefined,
    severity: parseSeverity(row.severity),
    status: parseIncidentStatus(row.status),
    incidentType: incidentType || undefined,
    workerId: row.worker_id ?? undefined,
    providerId: row.provider_id ?? undefined,
    siteId: row.site_id ?? undefined,
    shiftId: row.shift_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isSupabaseBacked: true,
    workerLabel: row.worker_profiles?.headline?.trim() || undefined,
    providerLabel: row.provider_organizations?.name?.trim() || undefined,
    shiftLabel: shiftLabelFromEmbed(row.shifts),
  }
}

function mapSafetyRow(row: SafetyReportDbRow): AdminIncidentRow {
  const issueType = row.issue_type?.trim()
  const details = row.details?.trim()
  return {
    id: row.id,
    source: "safety_report",
    title: issueType || "Safety report",
    summary: details || undefined,
    severity: row.urgent_contact_requested ? "critical" : "medium",
    status: mapSafetyStatus(row.status),
    incidentType: issueType || undefined,
    workerId: row.worker_id,
    shiftId: row.shift_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isSupabaseBacked: true,
    workerLabel: row.worker_profiles?.headline?.trim() || undefined,
    shiftLabel: shiftLabelFromEmbed(row.shifts),
  }
}

function buildPayload(rows: AdminIncidentRow[]): AdminIncidentQueuePayload {
  const sorted = sortRows(rows)
  return {
    rows: sorted,
    openCount: sorted.filter(r => r.status === "open").length,
    criticalCount: sorted.filter(
      r => r.severity === "critical" || r.severity === "high",
    ).length,
    escalatedCount: sorted.filter(r => r.status === "escalated").length,
    isSupabaseBacked: true,
  }
}

const INCIDENT_SELECT = `
  id,
  shift_id,
  worker_id,
  provider_id,
  site_id,
  severity,
  status,
  incident_type,
  summary,
  created_at,
  updated_at,
  worker_profiles ( headline ),
  provider_organizations ( name ),
  shifts ( title, role, starts_at )
`

const INCIDENT_SELECT_FALLBACK =
  "id, shift_id, worker_id, provider_id, site_id, severity, status, incident_type, summary, created_at, updated_at"

const SAFETY_SELECT = `
  id,
  worker_id,
  shift_id,
  issue_type,
  details,
  urgent_contact_requested,
  status,
  created_at,
  updated_at,
  worker_profiles ( headline ),
  shifts ( title, role, starts_at )
`

const SAFETY_SELECT_FALLBACK =
  "id, worker_id, shift_id, issue_type, details, urgent_contact_requested, status, created_at, updated_at"

export async function listAdminIncidentQueueFromSupabase(): Promise<
  ApiResult<AdminIncidentQueuePayload>
> {
  try {
    const supabase = getSupabaseClient()
    const sessionResult = await requireAdminSession(supabase)
    if (!sessionResult.ok) {
      return sessionResult
    }

    const { data: incidentData, error: incidentError } = await supabase
      .from("incidents")
      .select(INCIDENT_SELECT)
      .order("updated_at", { ascending: false })

    let incidentRows: AdminIncidentRow[] = []
    if (incidentError) {
      const fallback = await supabase
        .from("incidents")
        .select(INCIDENT_SELECT_FALLBACK)
        .order("updated_at", { ascending: false })
      if (fallback.error) {
        return fail(
          "incidents_load",
          friendlyDbMessage(fallback.error, "Unable to load incidents."),
        )
      }
      incidentRows = (fallback.data as IncidentDbRow[]).map(mapIncidentRow)
    } else {
      incidentRows = ((incidentData ?? []) as IncidentDbRow[]).map(mapIncidentRow)
    }

    const { data: safetyData, error: safetyError } = await supabase
      .from("safety_reports")
      .select(SAFETY_SELECT)
      .order("updated_at", { ascending: false })

    let safetyRows: AdminIncidentRow[] = []
    if (safetyError) {
      const fallback = await supabase
        .from("safety_reports")
        .select(SAFETY_SELECT_FALLBACK)
        .order("updated_at", { ascending: false })
      if (fallback.error) {
        return fail(
          "safety_reports_load",
          friendlyDbMessage(fallback.error, "Unable to load safety reports."),
        )
      }
      safetyRows = (fallback.data as SafetyReportDbRow[]).map(mapSafetyRow)
    } else {
      safetyRows = ((safetyData ?? []) as SafetyReportDbRow[]).map(mapSafetyRow)
    }

    return ok(buildPayload([...incidentRows, ...safetyRows]))
  } catch (e) {
    const errMessage = e instanceof Error ? e.message : "Unable to load incident queue."
    return fail("unexpected", errMessage)
  }
}
