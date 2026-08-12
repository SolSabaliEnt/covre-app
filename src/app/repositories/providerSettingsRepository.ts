import type { ApiResult } from "../api/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  ProviderOrganizationSettingsUpdatePayload,
  ProviderSettingsActionResult,
  ProviderSettingsSummary,
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
    return "Settings access is blocked by database permissions (RLS). Apply provider onboarding policies (0003) on your Supabase project."
  }
  return raw
}

type ProviderOrgEmbed = {
  id: string
  name: string
  organization_type: string | null
  status: string
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

function accountNameFromMetadata(
  metadata: Record<string, unknown> | undefined,
  email: string | undefined,
): string | undefined {
  const contact =
    typeof metadata?.contact_name === "string" ? metadata.contact_name.trim() : ""
  const name = typeof metadata?.name === "string" ? metadata.name.trim() : ""
  if (contact) return contact
  if (name) return name
  return email?.trim() || undefined
}

function actionResult(status: string, message: string): ProviderSettingsActionResult {
  return {
    status,
    message,
    updatedAt: new Date().toISOString(),
  }
}

export async function getProviderSettingsSummaryFromSupabase(): Promise<
  ApiResult<ProviderSettingsSummary>
> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      return fail("not_authenticated", "Sign in with Supabase before loading settings.")
    }

    const accountEmail = session.user.email ?? undefined
    const accountName = accountNameFromMetadata(
      session.user.user_metadata as Record<string, unknown> | undefined,
      accountEmail,
    )

    const { data: rows, error } = await supabase
      .from("provider_members")
      .select(
        "provider_id, role, provider_organizations(id, name, organization_type, status)",
      )
      .eq("user_id", session.user.id)
      .limit(1)

    if (error) {
      return fail("provider_settings_load", friendlyDbMessage(error, "Unable to load settings."))
    }

    const row = (rows?.[0] ?? null) as MemberRow | null
    if (!row) {
      return ok({
        accountEmail,
        accountName,
        setupStatus: "incomplete",
        isSupabaseBacked: true,
      })
    }

    const org = resolveOrganization(row)
    if (!org?.name?.trim()) {
      return ok({
        memberRole: row.role,
        accountEmail,
        accountName,
        setupStatus: "incomplete",
        isSupabaseBacked: true,
      })
    }

    return ok({
      organizationName: org.name.trim(),
      organizationType: org.organization_type?.trim() || undefined,
      organizationStatus: org.status,
      memberRole: row.role,
      accountEmail,
      accountName,
      setupStatus: "complete",
      isSupabaseBacked: true,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function updateProviderOrganizationSettingsInSupabase(
  payload: ProviderOrganizationSettingsUpdatePayload,
): Promise<ApiResult<ProviderSettingsActionResult>> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      return fail("not_authenticated", "Sign in with Supabase before updating settings.")
    }

    const { data: rows, error: memberError } = await supabase
      .from("provider_members")
      .select("provider_id, role")
      .eq("user_id", session.user.id)
      .limit(1)

    if (memberError) {
      return fail(
        "provider_membership_load",
        friendlyDbMessage(memberError, "Unable to load provider membership."),
      )
    }

    const member = rows?.[0] as { provider_id: string; role: string } | undefined
    if (!member?.provider_id) {
      return fail("provider_setup_required", "Complete facility setup before updating settings.")
    }

    if (!["owner", "admin"].includes(member.role)) {
      return fail(
        "forbidden",
        "Only organization owners and admins can update organization settings.",
      )
    }

    const patch: Record<string, string> = {}
    const name = payload.organizationName?.trim()
    const orgType = payload.organizationType?.trim()
    if (name) patch.name = name
    if (orgType) patch.organization_type = orgType

    if (Object.keys(patch).length === 0) {
      return fail("validation", "No organization fields to update.")
    }

    const { error: updateError } = await supabase
      .from("provider_organizations")
      .update(patch)
      .eq("id", member.provider_id)

    if (updateError) {
      return fail(
        "organization_update",
        friendlyDbMessage(updateError, "Unable to update organization settings."),
      )
    }

    return ok(actionResult("updated", "Organization settings updated."))
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function updateProviderNotificationSettingsInSupabase(): Promise<
  ApiResult<ProviderSettingsActionResult>
> {
  return ok(
    actionResult(
      "simulated",
      "Notification preferences will be connected after messaging settings are wired.",
    ),
  )
}

export async function updateProviderBillingSettingsInSupabase(): Promise<
  ApiResult<ProviderSettingsActionResult>
> {
  return ok(
    actionResult(
      "simulated",
      "Billing settings will be connected after payment rails are wired.",
    ),
  )
}
