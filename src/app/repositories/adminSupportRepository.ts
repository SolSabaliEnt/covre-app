import type { ApiResult } from "../api/types"
import { getCurrentAdminRoleFromSupabase } from "../auth/supabaseAdminAuth"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  AdminSupportTicketActionResult,
  AdminSupportTicketPayload,
  AdminSupportTicketPriority,
  AdminSupportTicketRow,
  AdminSupportTicketStatus,
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
    return "Admin support reads are blocked by database permissions (RLS). Apply admin read-only policies (0016) on your Supabase project."
  }
  return raw
}

function friendlyRpcMessage(err: { message?: string }, fallback: string): string {
  const raw = (err.message ?? fallback).trim()
  const lower = raw.toLowerCase()
  if (/only admin users|admin users can update support/i.test(lower)) {
    return "Only admin users can triage support tickets."
  }
  if (/invalid support ticket status/i.test(lower)) {
    return "That status is not allowed for support tickets."
  }
  if (/support ticket not found|could not be updated/i.test(lower)) {
    return "Support ticket could not be updated."
  }
  if (/already has this status/i.test(lower)) {
    return "This ticket already has that status."
  }
  if (/update_support_ticket_status|function.*does not exist/i.test(lower)) {
    return "Support triage is not available yet. Apply migration 0021 on your Supabase project."
  }
  if (raw.length > 0 && raw.length < 200) {
    return raw
  }
  return fallback
}

async function requireAdminSession(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<ApiResult<{ userId: string }>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return fail("not_authenticated", "Sign in at /auth/admin before triaging support tickets.")
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

function parseStatus(raw: string | null | undefined): AdminSupportTicketStatus {
  switch (raw) {
    case "open":
    case "assigned":
    case "resolved":
    case "closed":
      return raw
    default:
      return "open"
  }
}

function parsePriority(raw: string | null | undefined): AdminSupportTicketPriority {
  switch (raw) {
    case "low":
    case "normal":
    case "high":
    case "urgent":
      return raw
    default:
      return "normal"
  }
}

function requesterLabel(
  requesterType: string,
  subject: string | null | undefined,
  ticketType: string | null | undefined,
): string {
  const typeLabel = requesterType.charAt(0).toUpperCase() + requesterType.slice(1)
  const detail = subject?.trim() || ticketType?.trim()
  return detail ? `${typeLabel} · ${detail}` : `${typeLabel} requester`
}

function relatedLineFromRow(row: {
  related_shift_id?: string | null
  description?: string | null
  subject?: string | null
  shifts?: { title?: string | null; role?: string | null; care_sites?: { name?: string | null } | null } | null
}): string | undefined {
  const shift = row.shifts
  if (shift) {
    const site = shift.care_sites?.name?.trim()
    const role = shift.role?.trim() || shift.title?.trim()
    if (site && role) {
      return `${site} · ${role}`
    }
    return site || role || undefined
  }
  if (row.related_shift_id) {
    return `Shift ${row.related_shift_id.slice(0, 8)}`
  }
  const desc = row.description?.trim()
  if (desc) {
    return desc.length > 80 ? `${desc.slice(0, 77)}…` : desc
  }
  return row.subject?.trim() || undefined
}

type SupportTicketDbRow = {
  id: string
  requester_user_id: string
  requester_type: string
  related_shift_id: string | null
  ticket_type: string | null
  priority: string
  status: string
  subject: string | null
  description: string | null
  created_at: string
  updated_at: string
  shifts?: {
    title?: string | null
    role?: string | null
    care_sites?: { name?: string | null } | null
  } | null
}

function mapRows(data: unknown[]): AdminSupportTicketRow[] {
  return (data as SupportTicketDbRow[]).map(row => ({
    id: row.id,
    requesterUserId: row.requester_user_id,
    requesterType:
      row.requester_type === "worker" || row.requester_type === "admin"
        ? row.requester_type
        : "provider",
    requesterLabel: requesterLabel(row.requester_type, row.subject, row.ticket_type),
    ticketType: row.ticket_type ?? undefined,
    subject: row.subject ?? undefined,
    description: row.description ?? undefined,
    priority: parsePriority(row.priority),
    status: parseStatus(row.status),
    relatedShiftId: row.related_shift_id ?? undefined,
    relatedLine: relatedLineFromRow(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isSupabaseBacked: true,
  }))
}

function buildPayload(rows: AdminSupportTicketRow[]): AdminSupportTicketPayload {
  return {
    rows: [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    openCount: rows.filter(r => r.status === "open").length,
    assignedCount: rows.filter(r => r.status === "assigned").length,
    resolvedCount: rows.filter(r => r.status === "resolved").length,
    closedCount: rows.filter(r => r.status === "closed").length,
    urgentCount: rows.filter(r => r.priority === "urgent" || r.priority === "high").length,
    isSupabaseBacked: true,
  }
}

type RpcTicketResult = {
  id?: string
  status?: string
  updated_at?: string
  message?: string
}

function mapRpcResult(
  ticketId: string,
  payload: RpcTicketResult | null,
  fallbackMessage: string,
): AdminSupportTicketActionResult {
  return {
    ticketId: payload?.id ?? ticketId,
    status: payload?.status ?? "unknown",
    message: payload?.message ?? fallbackMessage,
    updatedAt: payload?.updated_at ?? new Date().toISOString(),
  }
}

export async function listAdminSupportTicketsFromSupabase(): Promise<
  ApiResult<AdminSupportTicketPayload>
> {
  try {
    const supabase = getSupabaseClient()
    const sessionResult = await requireAdminSession(supabase)
    if (!sessionResult.ok) {
      return sessionResult
    }

    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        `
        id,
        requester_user_id,
        requester_type,
        related_shift_id,
        ticket_type,
        priority,
        status,
        subject,
        description,
        created_at,
        updated_at,
        shifts ( title, role, care_sites ( name ) )
      `,
      )
      .order("updated_at", { ascending: false })

    if (error) {
      const fallback = await supabase
        .from("support_tickets")
        .select(
          "id, requester_user_id, requester_type, related_shift_id, ticket_type, priority, status, subject, description, created_at, updated_at",
        )
        .order("updated_at", { ascending: false })

      if (fallback.error) {
        return fail(
          "support_tickets_load",
          friendlyDbMessage(fallback.error, "Unable to load support tickets."),
        )
      }

      return ok(buildPayload(mapRows(fallback.data ?? [])))
    }

    return ok(buildPayload(mapRows(data ?? [])))
  } catch (e) {
    const errMessage = e instanceof Error ? e.message : "Unable to load support tickets."
    return fail("unexpected", errMessage)
  }
}

export async function updateAdminSupportTicketStatusInSupabase(
  ticketId: string,
  nextStatus: AdminSupportTicketStatus,
  note?: string,
): Promise<ApiResult<AdminSupportTicketActionResult>> {
  try {
    const supabase = getSupabaseClient()
    const sessionResult = await requireAdminSession(supabase)
    if (!sessionResult.ok) {
      return sessionResult
    }

    const { data, error } = await supabase.rpc("update_support_ticket_status", {
      target_ticket_id: ticketId,
      next_status: nextStatus,
      admin_note: note?.trim() || null,
    })

    if (error) {
      return fail(
        "support_ticket_update",
        friendlyRpcMessage(error, "Support ticket could not be updated."),
      )
    }

    return ok(
      mapRpcResult(ticketId, data as RpcTicketResult | null, "Support ticket updated."),
    )
  } catch (e) {
    const errMessage = e instanceof Error ? e.message : "Support ticket could not be updated."
    return fail("unexpected", errMessage)
  }
}
