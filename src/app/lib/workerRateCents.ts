import type { Shift } from "../data/types"

export const WORKER_RATE_SNAPSHOT_UNAVAILABLE = "Rate snapshot unavailable"

/** Format worker pay from explicit cents — never bill rate or legacy hourly_rate. */
export function formatWorkerPayDisplay(
  workerRateCents: number | null | undefined,
  rateType: string | null | undefined,
): string | null {
  if (workerRateCents == null || workerRateCents < 0) return null
  const dollars = (workerRateCents / 100).toFixed(2)
  const rt = (rateType ?? "hourly").toLowerCase()
  if (rt === "flat") return `$${dollars} flat`
  return `$${dollars}/hr`
}

/** Format booked pay from booking snapshot — missing snapshot returns safe unavailable copy. */
export function formatWorkerPayDisplayFromSnapshot(
  workerRateCentsSnapshot: number | null | undefined,
  rateTypeSnapshot: string | null | undefined,
): string {
  return (
    formatWorkerPayDisplay(workerRateCentsSnapshot, rateTypeSnapshot) ??
    WORKER_RATE_SNAPSHOT_UNAVAILABLE
  )
}

export function formatEstimatedTotalFromWorkerRate(
  startsAt: string,
  endsAt: string,
  workerRateCents: number,
  rateType: string | null | undefined,
): string {
  const rt = (rateType ?? "hourly").toLowerCase()
  if (rt === "flat") {
    return `$${(workerRateCents / 100).toFixed(2)}`
  }
  const hours = (Date.parse(endsAt) - Date.parse(startsAt)) / (1000 * 60 * 60)
  if (!Number.isFinite(hours) || hours <= 0) return "—"
  return `$${Math.round((hours * workerRateCents) / 100)}`
}

/** Worker-facing pay string — Supabase uses worker_rate_cents; mock uses demo hourlyPayDisplay. */
export function displayWorkerPay(shift: Shift): string {
  if (shift.isSupabaseDiscovery) {
    return shift.workerPayDisplay ?? "—"
  }
  return shift.hourlyPayDisplay
}

export function workerPayRateLabel(shift: Shift, supabaseMode: boolean): string {
  if (!supabaseMode) return "Hourly Rate"
  if (shift.rateType?.toLowerCase() === "flat") return "Flat pay"
  return "Pay rate"
}

/** Booked/active pay — Supabase uses booking snapshot; mock uses demo hourlyPayDisplay. */
export function displayAcceptedWorkerPay(shift: Shift): string {
  if (shift.isSupabaseDiscovery) {
    return shift.workerPayDisplay ?? WORKER_RATE_SNAPSHOT_UNAVAILABLE
  }
  return shift.hourlyPayDisplay
}

export function acceptedPayRateLabel(
  supabaseMode: boolean,
  rateType?: string | null,
): string {
  if (!supabaseMode) return "Hourly Rate"
  if (rateType?.toLowerCase() === "flat") return "Accepted pay (flat)"
  return "Accepted pay"
}

export function hasWorkerRateSnapshot(shift: Shift): boolean {
  return shift.workerRateCentsSnapshot != null && shift.workerRateCentsSnapshot >= 0
}
