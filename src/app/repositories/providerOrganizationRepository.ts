import type { ApiResult } from "../api/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import type { ProviderOrganizationSummary } from "../services/types"

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyLoadMessage(err: { message?: string; code?: string }): string {
  const raw = err.message ?? "Unable to load provider workspace."
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Organization details are blocked by database permissions (RLS)."
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
  if (Array.isArray(embedded)) return embedded[0] ?? null
  return embedded
}

export async function getCurrentProviderOrganizationFromSupabase(): Promise<
  ApiResult<ProviderOrganizationSummary | null>
> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      return ok(null)
    }

    const { data: rows, error } = await supabase
      .from("provider_members")
      .select(
        "provider_id, role, provider_organizations(id, name, organization_type, status)",
      )
      .eq("user_id", session.user.id)
      .limit(1)

    if (error) {
      return fail("provider_org_load", friendlyLoadMessage(error))
    }

    const row = (rows?.[0] ?? null) as MemberRow | null
    if (!row) {
      return ok(null)
    }

    const org = resolveOrganization(row)
    if (!org?.name?.trim()) {
      return ok(null)
    }

    return ok({
      providerId: row.provider_id,
      organizationName: org.name.trim(),
      organizationType: org.organization_type?.trim() || undefined,
      status: org.status,
      memberRole: row.role,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
