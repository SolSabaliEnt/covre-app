import type { SupabaseClient, User } from "@supabase/supabase-js"
import { ADMIN_CONSOLE_ROLE_VALUES } from "./supabaseAdminAuth"

type UserMetadata = Record<string, unknown>

export function getUserMetadata(user: User): UserMetadata {
  return user.user_metadata ?? {}
}

export function metadataRole(meta: UserMetadata): string | undefined {
  const raw = meta.role
  return typeof raw === "string" ? raw : undefined
}

export function hasProviderMetadataEvidence(meta: UserMetadata): boolean {
  if (metadataRole(meta) === "provider") {
    return true
  }
  if (meta.provider_onboarding_complete !== undefined) {
    return true
  }
  if (typeof meta.organization_name === "string" && meta.organization_name.trim().length > 0) {
    return true
  }
  if (typeof meta.contact_name === "string" && meta.contact_name.trim().length > 0) {
    return true
  }
  return false
}

export function hasWorkerMetadataEvidence(meta: UserMetadata): boolean {
  if (metadataRole(meta) === "worker") {
    return true
  }
  if (meta.worker_onboarding_complete !== undefined) {
    return true
  }
  if (meta.worker_profile_draft !== undefined) {
    return true
  }
  return false
}

export function hasWorkerOnlyMetadataEvidence(meta: UserMetadata): boolean {
  return hasWorkerMetadataEvidence(meta) && !hasProviderMetadataEvidence(meta)
}

export function hasProviderOnlyMetadataEvidence(meta: UserMetadata): boolean {
  return hasProviderMetadataEvidence(meta) && !hasWorkerMetadataEvidence(meta)
}

export async function userHasProviderMembership(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("provider_members")
    .select("provider_id")
    .eq("user_id", userId)
    .limit(1)

  if (error) {
    return false
  }
  return (data?.length ?? 0) > 0
}

export async function userHasWorkerProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("worker_profiles")
    .select("id")
    .eq("user_id", userId)
    .limit(1)

  if (error) {
    return false
  }
  return (data?.length ?? 0) > 0
}

export async function userHasAdminConsoleRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)

  if (error) {
    return false
  }

  return (data ?? []).some(
    row =>
      typeof row.role === "string" &&
      (ADMIN_CONSOLE_ROLE_VALUES as readonly string[]).includes(row.role),
  )
}

export async function rejectSignInAndSignOut(supabase: SupabaseClient): Promise<void> {
  await supabase.auth.signOut()
}
