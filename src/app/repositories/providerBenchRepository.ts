import type { ApiResult } from "../api/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import type { ProviderBenchPayload, ProviderBenchWorker } from "../services/types"

type ProviderMembership = { providerId: string }

type WorkerProfileEmbed = { id: string; headline: string | null } | null

type BookingBenchRow = {
  id: string
  worker_id: string
  status: string
  created_at: string
  confirmed_at: string | null
  shifts: { role: string | null } | { role: string | null }[] | null
  worker_profiles: WorkerProfileEmbed | WorkerProfileEmbed[]
}

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(err: { message?: string; code?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Loading bench is blocked by database permissions (RLS). Apply booking lifecycle policies (0010) on your Supabase project."
  }
  return raw
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

async function loadProviderMembership(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<ApiResult<ProviderMembership | null>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return fail(
      "not_authenticated",
      "Sign in with Supabase before loading your bench.",
    )
  }

  const { data: rows, error } = await supabase
    .from("provider_members")
    .select("provider_id")
    .eq("user_id", session.user.id)
    .limit(1)

  if (error) {
    return fail(
      "provider_membership_load",
      friendlyDbMessage(error, "Unable to load provider membership."),
    )
  }

  const row = rows?.[0] as { provider_id: string } | undefined
  if (!row?.provider_id) {
    return ok(null)
  }

  return ok({ providerId: row.provider_id })
}

function formatLastWorkedAt(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function aggregateBookedWorkers(rows: BookingBenchRow[]): ProviderBenchWorker[] {
  const byWorker = new Map<
    string,
    { name: string; roleLabel?: string; count: number; lastAt: string | null }
  >()

  for (const row of rows) {
    const workerId = row.worker_id
    if (!workerId) continue

    const profile = unwrap(row.worker_profiles)
    const shift = unwrap(row.shifts)
    const name = profile?.headline?.trim() || "Care worker"
    const roleLabel = shift?.role?.trim() || undefined
    const workedAt = row.confirmed_at ?? row.created_at
    const existing = byWorker.get(workerId)

    if (!existing) {
      byWorker.set(workerId, {
        name,
        roleLabel,
        count: 1,
        lastAt: workedAt,
      })
      continue
    }

    existing.count += 1
    if (workedAt && (!existing.lastAt || workedAt > existing.lastAt)) {
      existing.lastAt = workedAt
    }
    if (!existing.roleLabel && roleLabel) {
      existing.roleLabel = roleLabel
    }
  }

  return [...byWorker.entries()]
    .map(([id, agg]) => ({
      id,
      name: agg.name,
      roleLabel: agg.roleLabel,
      completedShiftCount: agg.count,
      lastWorkedAt: formatLastWorkedAt(agg.lastAt),
      isSupabaseBacked: true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function listProviderBenchFromSupabase(): Promise<ApiResult<ProviderBenchPayload>> {
  try {
    const supabase = getSupabaseClient()
    const membershipRes = await loadProviderMembership(supabase)
    if (!membershipRes.ok) return membershipRes

    if (!membershipRes.data) {
      return ok({
        sections: [],
        isSupabaseBacked: true,
        message:
          "Complete provider workspace setup before your bench can load booked workers.",
      })
    }

    const { providerId } = membershipRes.data

    const { data: bookingRows, error: bookingError } = await supabase
      .from("bookings")
      .select(
        `
        id,
        worker_id,
        status,
        created_at,
        confirmed_at,
        shifts!inner (
          provider_id,
          role
        ),
        worker_profiles ( id, headline )
      `,
      )
      .eq("shifts.provider_id", providerId)
      .in("status", ["confirmed", "accepted", "completed"])
      .order("created_at", { ascending: false })

    if (bookingError) {
      return fail(
        "bench_bookings_load",
        friendlyDbMessage(bookingError, "Unable to load booked workers."),
      )
    }

    const workers = aggregateBookedWorkers((bookingRows ?? []) as BookingBenchRow[])

    if (workers.length === 0) {
      return ok({
        sections: [],
        isSupabaseBacked: true,
        message:
          "Workers you book or save will appear here once bench management is connected.",
      })
    }

    return ok({
      sections: [{ title: "Workers you've booked", workers }],
      isSupabaseBacked: true,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
