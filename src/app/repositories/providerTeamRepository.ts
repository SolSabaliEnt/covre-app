import type { ApiResult } from "../api/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  ProviderInvitePayload,
  ProviderInviteResult,
  ProviderMemberActionResult,
  ProviderMemberRole,
  ProviderTeamMember,
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
    return "Team access is blocked by database permissions (RLS). Apply provider onboarding policies (0003) on your Supabase project."
  }
  return raw
}

const MEMBER_ROLES: ProviderMemberRole[] = [
  "owner",
  "admin",
  "scheduler",
  "billing",
  "viewer",
]

function asMemberRole(value: string | null | undefined): ProviderMemberRole {
  const r = value?.trim() ?? ""
  if (MEMBER_ROLES.includes(r as ProviderMemberRole)) {
    return r as ProviderMemberRole
  }
  return "viewer"
}

type ProviderMembership = {
  providerId: string
  memberId: string
  role: ProviderMemberRole
}

type ProviderMemberRow = {
  id: string
  user_id: string
  provider_id: string
  role: string
  created_at: string
}

async function loadCurrentProviderMembership(): Promise<
  ApiResult<ProviderMembership | null>
> {
  const supabase = getSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return fail(
      "not_authenticated",
      "Sign in with Supabase before loading team members.",
    )
  }

  const { data: rows, error } = await supabase
    .from("provider_members")
    .select("id, provider_id, role")
    .eq("user_id", session.user.id)
    .limit(1)

  if (error) {
    return fail(
      "provider_membership_load",
      friendlyDbMessage(error, "Unable to load provider membership."),
    )
  }

  const row = rows?.[0] as { id: string; provider_id: string; role: string } | undefined
  if (!row?.provider_id) {
    return ok(null)
  }

  return ok({
    providerId: row.provider_id,
    memberId: row.id,
    role: asMemberRole(row.role),
  })
}

function displayNameForCurrentUser(session: {
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }
}): string {
  const meta = session.user.user_metadata ?? {}
  const fromMeta =
    (typeof meta.display_name === "string" && meta.display_name.trim()) ||
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.organization_name === "string" && meta.organization_name.trim()) ||
    (typeof meta.contact_name === "string" && meta.contact_name.trim())
  if (fromMeta) return fromMeta
  const email = session.user.email?.trim()
  if (email) {
    const local = email.split("@")[0]?.replace(/[._+-]/g, " ").trim() ?? "You"
    return local.replace(/\b\w/g, c => c.toUpperCase())
  }
  return "You"
}

function mapMemberRow(
  row: ProviderMemberRow,
  sessionUserId: string,
  sessionEmail: string | null | undefined,
  sessionDisplayName: string,
): ProviderTeamMember {
  const isSelf = row.user_id === sessionUserId
  return {
    id: row.id,
    role: asMemberRole(row.role),
    status: "active",
    name: isSelf ? sessionDisplayName : "Team member",
    email: isSelf ? (sessionEmail?.trim() || "—") : "—",
    lastActiveAt: row.created_at,
  }
}

export async function listProviderTeamMembersFromSupabase(): Promise<
  ApiResult<ProviderTeamMember[]>
> {
  try {
    const membershipResult = await loadCurrentProviderMembership()
    if (!membershipResult.ok) {
      return membershipResult
    }
    if (!membershipResult.data) {
      return ok([])
    }

    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      return fail(
        "not_authenticated",
        "Sign in with Supabase before loading team members.",
      )
    }

    const { data: rows, error } = await supabase
      .from("provider_members")
      .select("id, user_id, provider_id, role, created_at")
      .eq("provider_id", membershipResult.data.providerId)
      .order("created_at", { ascending: true })

    if (error) {
      return fail(
        "team_members_load",
        friendlyDbMessage(error, "Unable to load team members."),
      )
    }

    const displayName = displayNameForCurrentUser(session)
    const members = ((rows ?? []) as ProviderMemberRow[]).map(row =>
      mapMemberRow(row, session.user.id, session.user.email, displayName),
    )
    return ok(members)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function inviteProviderMemberInSupabase(
  payload: ProviderInvitePayload,
): Promise<ApiResult<ProviderInviteResult>> {
  void payload
  const membershipResult = await loadCurrentProviderMembership()
  if (!membershipResult.ok) {
    return membershipResult
  }
  if (!membershipResult.data) {
    return fail("no_provider_membership", "Complete facility setup before inviting staff.")
  }
  if (!["owner", "admin"].includes(membershipResult.data.role)) {
    return fail("forbidden", "Only owners and admins can invite team members.")
  }

  const email = payload.email.trim().toLowerCase()
  const id = `invite-queued-${Date.now()}`
  return ok({
    id,
    email,
    role: payload.role,
    status: "queued",
    message:
      "Invite queued. Real email invitations require the invite service.",
    invitedAt: new Date().toISOString(),
  })
}

export async function updateProviderMemberRoleInSupabase(
  memberId: string,
  role: ProviderMemberRole,
): Promise<ApiResult<ProviderMemberActionResult>> {
  if (role === "owner") {
    return fail(
      "owner_role_blocked",
      "Owner roles cannot be changed from this screen yet.",
    )
  }

  const membershipResult = await loadCurrentProviderMembership()
  if (!membershipResult.ok) {
    return membershipResult
  }
  if (!membershipResult.data) {
    return fail("no_provider_membership", "No facility membership found.")
  }
  if (!["owner", "admin"].includes(membershipResult.data.role)) {
    return fail("forbidden", "Only owners and admins can update member roles.")
  }
  if (memberId === membershipResult.data.memberId && role !== membershipResult.data.role) {
    return fail("self_role", "You cannot change your own role from this screen.")
  }

  const supabase = getSupabaseClient()
  const { data: target, error: loadError } = await supabase
    .from("provider_members")
    .select("id, role, provider_id")
    .eq("id", memberId)
    .eq("provider_id", membershipResult.data.providerId)
    .maybeSingle()

  if (loadError) {
    return fail(
      "member_load",
      friendlyDbMessage(loadError, "Unable to load team member."),
    )
  }
  if (!target) {
    return fail("not_found", "Member not found.")
  }

  const currentRole = asMemberRole((target as { role: string }).role)
  if (currentRole === "owner") {
    return fail(
      "owner_role_blocked",
      "Owner roles cannot be changed from this screen yet.",
    )
  }

  const { error: updateError } = await supabase
    .from("provider_members")
    .update({ role })
    .eq("id", memberId)
    .eq("provider_id", membershipResult.data.providerId)

  if (updateError) {
    return fail(
      "member_role_update",
      friendlyDbMessage(updateError, "Unable to update member role."),
    )
  }

  return ok({
    id: memberId,
    status: "role_updated",
    message: `Role updated to ${role}.`,
    updatedAt: new Date().toISOString(),
  })
}

export async function disableProviderMemberInSupabase(
  memberId: string,
): Promise<ApiResult<ProviderMemberActionResult>> {
  void memberId
  const membershipResult = await loadCurrentProviderMembership()
  if (!membershipResult.ok) {
    return membershipResult
  }
  return ok({
    id: memberId,
    status: "unsupported",
    message:
      "Disable access will be connected after member status tracking is added.",
    updatedAt: new Date().toISOString(),
  })
}

export async function resendProviderInviteInSupabase(
  memberId: string,
): Promise<ApiResult<ProviderMemberActionResult>> {
  void memberId
  const membershipResult = await loadCurrentProviderMembership()
  if (!membershipResult.ok) {
    return membershipResult
  }
  return ok({
    id: memberId,
    status: "simulated",
    message: "Invite resend will be connected after email invitations are wired.",
    updatedAt: new Date().toISOString(),
  })
}
