import type { ApiResult } from "../api/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import { getCurrentAdminRoleFromSupabase } from "../auth/supabaseAdminAuth"
import type {
  AdminMarketplaceActivityRow,
  AdminMarketplaceDashboardPayload,
  AdminMarketplaceSummary,
} from "../services/types"

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function countValue(result: ApiResult<number>): number {
  return result.ok ? result.data : 0
}

function friendlyDbMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Admin marketplace reads are blocked by database permissions (RLS). Apply admin read-only policies (0016) on your Supabase project."
  }
  return raw
}

const BOOKED_SHIFT_STATUSES = [
  "booked",
  "confirmed",
  "clocked_in",
  "pending_approval",
  "approved",
  "invoiced",
  "completed",
] as const

const CREDENTIAL_REVIEW_STATUSES = ["pending", "expiring_soon"] as const

async function countRows(
  table: string,
  options?: { eq?: { column: string; value: string }; in?: { column: string; values: string[] } },
): Promise<ApiResult<number>> {
  const supabase = getSupabaseClient()
  let query = supabase.from(table).select("*", { count: "exact", head: true })
  if (options?.eq) {
    query = query.eq(options.eq.column, options.eq.value)
  }
  if (options?.in) {
    query = query.in(options.in.column, options.in.values)
  }
  const { count, error } = await query
  if (error) {
    return fail(`${table}_count`, friendlyDbMessage(error, `Unable to count ${table}.`))
  }
  return ok(count ?? 0)
}

function formatWhen(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function shiftLabel(row: { title: string | null; role: string | null; status: string }): string {
  const title = row.title?.trim() || row.role?.trim() || "Shift"
  return `${title} · ${row.status}`
}

export async function getAdminMarketplaceDashboardFromSupabase(): Promise<
  ApiResult<AdminMarketplaceDashboardPayload>
> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return fail("not_authenticated", "Sign in at /auth/admin before loading the dashboard.")
    }

    const roleResult = await getCurrentAdminRoleFromSupabase()
    if (!roleResult.ok) {
      return roleResult
    }
    if (!roleResult.data.isAdmin) {
      return fail(
        "forbidden",
        roleResult.data.message ?? "This account does not have admin access.",
      )
    }

    const [
      providerCount,
      workerCount,
      openShiftCount,
      bookedShiftCount,
      bookingCount,
      submittedTimesheetCount,
      approvedTimesheetCount,
      invoiceDraftCount,
      compliancePacketCount,
      supportTicketCount,
      credentialReviewCount,
    ] = await Promise.all([
      countRows("provider_organizations"),
      countRows("worker_profiles"),
      countRows("shifts", { eq: { column: "status", value: "open" } }),
      countRows("shifts", { in: { column: "status", values: [...BOOKED_SHIFT_STATUSES] } }),
      countRows("bookings"),
      countRows("timesheets", { eq: { column: "status", value: "submitted" } }),
      countRows("timesheets", { eq: { column: "status", value: "approved" } }),
      countRows("invoices", { eq: { column: "status", value: "draft" } }),
      countRows("compliance_packets"),
      countRows("support_tickets"),
      countRows("worker_credentials", {
        in: { column: "status", values: [...CREDENTIAL_REVIEW_STATUSES] },
      }),
    ])

    const countResults = [
      providerCount,
      workerCount,
      openShiftCount,
      bookedShiftCount,
      bookingCount,
      submittedTimesheetCount,
      approvedTimesheetCount,
      invoiceDraftCount,
      compliancePacketCount,
      supportTicketCount,
      credentialReviewCount,
    ]

    for (const result of countResults) {
      if (!result.ok) {
        return result
      }
    }

    const summary: AdminMarketplaceSummary = {
      providerCount: countValue(providerCount),
      workerCount: countValue(workerCount),
      openShiftCount: countValue(openShiftCount),
      bookedShiftCount: countValue(bookedShiftCount),
      bookingCount: countValue(bookingCount),
      submittedTimesheetCount: countValue(submittedTimesheetCount),
      approvedTimesheetCount: countValue(approvedTimesheetCount),
      invoiceDraftCount: countValue(invoiceDraftCount),
      compliancePacketCount: countValue(compliancePacketCount),
      supportTicketCount: countValue(supportTicketCount),
      credentialReviewCount: countValue(credentialReviewCount),
    }

    const activityCandidates: { at: string; row: AdminMarketplaceActivityRow }[] = []

    const { data: shiftRows, error: shiftError } = await supabase
      .from("shifts")
      .select("id, title, role, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5)

    if (shiftError) {
      return fail("shifts_activity", friendlyDbMessage(shiftError, "Unable to load recent shifts."))
    }

    for (const row of shiftRows ?? []) {
      const at = String(row.created_at ?? "")
      activityCandidates.push({
        at,
        row: {
          id: row.id as string,
          type: "shift",
          label: shiftLabel(row as { title: string | null; role: string | null; status: string }),
          status: String(row.status),
          createdAt: formatWhen(at),
          href: `/admin/shifts/${row.id}`,
        },
      })
    }

    const { data: bookingRows, error: bookingError } = await supabase
      .from("bookings")
      .select("id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5)

    if (bookingError) {
      return fail(
        "bookings_activity",
        friendlyDbMessage(bookingError, "Unable to load recent bookings."),
      )
    }

    for (const row of bookingRows ?? []) {
      const at = String(row.created_at ?? "")
      activityCandidates.push({
        at,
        row: {
          id: row.id as string,
          type: "booking",
          label: `Booking · ${row.status}`,
          status: String(row.status),
          createdAt: formatWhen(at),
        },
      })
    }

    const { data: timesheetRows, error: timesheetError } = await supabase
      .from("timesheets")
      .select("id, status, submitted_at, created_at")
      .order("created_at", { ascending: false })
      .limit(5)

    if (timesheetError) {
      return fail(
        "timesheets_activity",
        friendlyDbMessage(timesheetError, "Unable to load recent timesheets."),
      )
    }

    for (const row of timesheetRows ?? []) {
      const at = String(row.submitted_at ?? row.created_at ?? "")
      activityCandidates.push({
        at,
        row: {
          id: row.id as string,
          type: "timesheet",
          label: `Timesheet · ${row.status}`,
          status: String(row.status),
          createdAt: formatWhen(at),
        },
      })
    }

    const { data: ticketRows, error: ticketError } = await supabase
      .from("support_tickets")
      .select("id, subject, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5)

    if (ticketError) {
      return fail(
        "support_activity",
        friendlyDbMessage(ticketError, "Unable to load recent support tickets."),
      )
    }

    for (const row of ticketRows ?? []) {
      const subject = (row.subject as string | null)?.trim() || "Support ticket"
      const at = String(row.created_at ?? "")
      activityCandidates.push({
        at,
        row: {
          id: row.id as string,
          type: "support",
          label: subject,
          status: String(row.status),
          createdAt: formatWhen(at),
          href: "/admin/support",
        },
      })
    }

    const activity = activityCandidates
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 12)
      .map(entry => entry.row)

    return ok({
      summary,
      activity,
      isSupabaseBacked: true,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
