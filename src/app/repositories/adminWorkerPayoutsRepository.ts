import type { ApiResult } from "../api/types"
import { getCurrentAdminRoleFromSupabase } from "../auth/supabaseAdminAuth"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  AdminPayoutBatchGroup,
  AdminPayoutBatchQueue,
  WorkerPayoutBatchResult,
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
    return "Admin payout batch reads are blocked by database permissions (RLS). Apply admin read-only policies (0016) and payment ledger (0023) on your Supabase project."
  }
  if (/PGRST205|does not exist|42P01|create_worker_payout_batch/i.test(raw)) {
    return "Payout batching is not available yet. Apply migration 0028 on your Supabase project."
  }
  return raw
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function friendlyPayoutBatchRpcMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  const code = raw.match(/(?:P0001:\s*)?([a-z_]+)/i)?.[1]?.toLowerCase()

  switch (code) {
    case "not_authorized":
      return "You are not authorized to create payout batches."
    case "payout_batch_conflict":
      return "One or more earnings were already batched. Refresh and try again."
    case "payout_batch_line_mismatch":
      return "Payout batch could not be created due to an earning state mismatch."
    default:
      if (/function.*does not exist|create_worker_payout_batch/i.test(raw)) {
        return "Payout batching is not available yet. Apply migration 0028 on your Supabase project."
      }
      if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
        return "Payout batching is blocked by database permissions (RLS)."
      }
      return "Could not create payout batch right now."
  }
}

function mapRpcPayoutBatchResult(data: Record<string, unknown>): WorkerPayoutBatchResult {
  const payoutIdsRaw = data.payout_ids
  const payoutIds: string[] = []

  if (Array.isArray(payoutIdsRaw)) {
    for (const id of payoutIdsRaw) {
      if (id != null) payoutIds.push(String(id))
    }
  }

  return {
    ok: data.ok === true,
    payoutCount: Number(data.payout_count ?? 0),
    earningCount: Number(data.earning_count ?? 0),
    workerCount: Number(data.worker_count ?? 0),
    totalAmountCents: Number(data.total_amount_cents ?? 0),
    payoutIds,
    message: String(data.message ?? "Payout batch completed."),
  }
}

async function requireAdminSession(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<ApiResult<{ userId: string }>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return fail("not_authenticated", "Sign in at /auth/admin before managing payout batches.")
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

type EligibleEarningRow = {
  id: string
  worker_id: string
  net_earnings_cents: number
  currency: string
  worker_profiles?: { headline: string | null } | { headline: string | null }[] | null
}

const ELIGIBLE_EARNING_SELECT = `
  id,
  worker_id,
  net_earnings_cents,
  currency,
  worker_profiles ( id, headline )
`

export async function listAdminWorkerPayoutBatchQueueFromSupabase(): Promise<
  ApiResult<AdminPayoutBatchQueue>
> {
  try {
    const supabase = getSupabaseClient()
    const adminCheck = await requireAdminSession(supabase)
    if (!adminCheck.ok) return adminCheck

    const { data: lineRows, error: lineError } = await supabase
      .from("worker_payout_lines")
      .select("earning_id")

    if (lineError) {
      return fail(
        "payout_lines_load",
        friendlyDbMessage(lineError, "Unable to load payout line assignments."),
      )
    }

    const batchedEarningIds = new Set(
      ((lineRows ?? []) as { earning_id: string }[]).map(r => r.earning_id),
    )

    const { data: approvedRows, error: approvedError } = await supabase
      .from("worker_earnings")
      .select(ELIGIBLE_EARNING_SELECT)
      .eq("status", "approved")
      .gt("net_earnings_cents", 0)
      .order("created_at", { ascending: false })

    if (approvedError) {
      return fail(
        "eligible_earnings_load",
        friendlyDbMessage(approvedError, "Unable to load approved worker earnings."),
      )
    }

    const eligible = ((approvedRows ?? []) as EligibleEarningRow[]).filter(
      row => !batchedEarningIds.has(row.id),
    )

    const groupMap = new Map<string, AdminPayoutBatchGroup>()

    for (const row of eligible) {
      const currency = (row.currency ?? "usd").toLowerCase()
      const key = `${row.worker_id}:${currency}`
      const profile = unwrap(row.worker_profiles)
      const existing = groupMap.get(key)

      if (existing) {
        existing.earningCount += 1
        existing.amountCents += row.net_earnings_cents
        existing.earningIds.push(row.id)
      } else {
        groupMap.set(key, {
          workerId: row.worker_id,
          workerName: profile?.headline?.trim() || undefined,
          earningCount: 1,
          amountCents: row.net_earnings_cents,
          currency,
          earningIds: [row.id],
        })
      }
    }

    const groupedByWorker = [...groupMap.values()].sort((a, b) => {
      const nameA = a.workerName ?? a.workerId
      const nameB = b.workerName ?? b.workerId
      return nameA.localeCompare(nameB)
    })

    const { count: queuedCount, error: queuedError } = await supabase
      .from("worker_earnings")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued")

    if (queuedError) {
      return fail(
        "queued_earnings_load",
        friendlyDbMessage(queuedError, "Unable to load queued earnings count."),
      )
    }

    const { count: createdPayoutCount, error: payoutError } = await supabase
      .from("worker_payouts")
      .select("id", { count: "exact", head: true })
      .eq("status", "created")

    if (payoutError) {
      return fail(
        "created_payouts_load",
        friendlyDbMessage(payoutError, "Unable to load created payout batches."),
      )
    }

    const readyEarnings = eligible.length
    const totalEligibleCents = eligible.reduce((sum, r) => sum + r.net_earnings_cents, 0)
    const workerIds = new Set(groupedByWorker.map(g => g.workerId))

    return ok({
      groupedByWorker,
      summary: {
        readyEarnings,
        workerCount: workerIds.size,
        totalEligibleCents,
        createdPayouts: createdPayoutCount ?? 0,
        queuedEarnings: queuedCount ?? 0,
      },
      isSupabaseBacked: true,
      message:
        readyEarnings === 0
          ? "No approved earnings are ready for payout batching."
          : undefined,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function createWorkerPayoutBatchInSupabase(
  targetWorkerId?: string,
): Promise<ApiResult<WorkerPayoutBatchResult>> {
  try {
    const supabase = getSupabaseClient()
    const adminCheck = await requireAdminSession(supabase)
    if (!adminCheck.ok) return adminCheck

    const { data, error } = await supabase.rpc("create_worker_payout_batch", {
      target_worker_id: targetWorkerId ?? null,
    })

    if (error) {
      return fail(
        "payout_batch",
        friendlyPayoutBatchRpcMessage(error, "Unable to create payout batch."),
      )
    }

    if (!data || typeof data !== "object") {
      return fail("payout_batch", "Payout batch RPC returned an empty response.")
    }

    return ok(mapRpcPayoutBatchResult(data as Record<string, unknown>))
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
