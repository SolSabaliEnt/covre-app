/** Resolve provider bill rate in cents (booking snapshot → shift bill → legacy hourly_rate). */

export function parseHourlyRate(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const n = typeof value === "number" ? value : Number.parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

export type BillRateShiftFields = {
  bill_rate_cents?: number | null
  hourly_rate?: number | string | null
}

export type BillRateBookingFields = {
  bill_rate_cents_snapshot?: number | null
}

export function resolveBillRateCents(
  shift: BillRateShiftFields,
  booking?: BillRateBookingFields | null,
): number | null {
  const snapshot = booking?.bill_rate_cents_snapshot
  if (snapshot != null && snapshot >= 0) return snapshot

  const bill = shift.bill_rate_cents
  if (bill != null && bill >= 0) return bill

  const hourly = parseHourlyRate(shift.hourly_rate)
  return hourly != null ? Math.round(hourly * 100) : null
}

export function billRateCentsToHourlyDollars(cents: number | null): number | undefined {
  if (cents == null) return undefined
  return cents / 100
}

export function estimateAmountFromBillRateCents(hours: number, billRateCents: number | null): number {
  if (billRateCents == null || hours <= 0) return 0
  return Math.round(hours * billRateCents) / 100
}

export function estimateShiftAmountFromBillRateCents(
  startsAt: string,
  endsAt: string,
  billRateCents: number | null,
): number {
  if (billRateCents == null) return 0
  const hours = (Date.parse(endsAt) - Date.parse(startsAt)) / (1000 * 60 * 60)
  if (!Number.isFinite(hours) || hours <= 0) return 0
  return Math.round(hours * billRateCents) / 100
}
