import type { ApiResult } from "../api/types"
import { PROVIDER_REFERRAL_TIERS } from "../data/referrals"
import { getSupabaseClient } from "../lib/supabaseClient"
import type { ReferralActionResult, ReferralDashboard } from "../services/types"

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Referral data is blocked by database permissions (RLS). Referral tables are not exposed to providers in this pass."
  }
  return raw
}

function providerReferralLink(providerId: string): string {
  return `https://covre.health/r/provider/${providerId}`
}

function emptySimulatedDashboard(overrides: Partial<ReferralDashboard> = {}): ReferralDashboard {
  return {
    referralLink: "",
    totalPending: 0,
    totalQualified: 0,
    totalPaidOrCredited: 0,
    tiers: PROVIDER_REFERRAL_TIERS,
    records: [],
    isSupabaseBacked: true,
    isSimulated: true,
    ...overrides,
  }
}

type ProviderOrgEmbed = {
  id: string
  name: string
}

type MemberRow = {
  provider_id: string
  role: string
  provider_organizations: ProviderOrgEmbed | ProviderOrgEmbed[] | null
}

function resolveOrganization(row: MemberRow): ProviderOrgEmbed | null {
  const embedded = row.provider_organizations
  if (!embedded) return null
  return Array.isArray(embedded) ? embedded[0] ?? null : embedded
}

export async function getProviderReferralDashboardFromSupabase(): Promise<
  ApiResult<ReferralDashboard>
> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      return fail("not_authenticated", "Sign in with Supabase before loading referrals.")
    }

    const { data: rows, error } = await supabase
      .from("provider_members")
      .select("provider_id, role, provider_organizations(id, name)")
      .eq("user_id", session.user.id)
      .limit(1)

    if (error) {
      return fail(
        "provider_referrals_load",
        friendlyDbMessage(error, "Unable to load referral dashboard."),
      )
    }

    const row = (rows?.[0] ?? null) as MemberRow | null
    if (!row?.provider_id) {
      return ok(
        emptySimulatedDashboard({
          setupStatus: "incomplete",
        }),
      )
    }

    const org = resolveOrganization(row)
    if (!org?.name?.trim()) {
      return ok(
        emptySimulatedDashboard({
          providerId: row.provider_id,
          setupStatus: "incomplete",
        }),
      )
    }

    // referrals / referral_rewards have RLS enabled but no provider policies yet — simulated ledger only.
    return ok({
      referralLink: providerReferralLink(row.provider_id),
      providerId: row.provider_id,
      organizationName: org.name.trim(),
      setupStatus: "complete",
      totalPending: 0,
      totalQualified: 0,
      totalPaidOrCredited: 0,
      tiers: PROVIDER_REFERRAL_TIERS,
      records: [],
      isSupabaseBacked: true,
      isSimulated: true,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function copyProviderReferralLinkFromSupabase(): Promise<
  ApiResult<ReferralActionResult>
> {
  const dashboardResult = await getProviderReferralDashboardFromSupabase()
  if (!dashboardResult.ok) {
    return dashboardResult
  }
  if (!dashboardResult.data.referralLink) {
    return fail(
      "provider_setup_required",
      "Complete facility setup before copying your referral link.",
    )
  }
  return ok({
    id: dashboardResult.data.providerId ?? "provider",
    status: "ready",
    message: "Referral link ready to copy",
    updatedAt: new Date().toISOString(),
  })
}
