import type { SupabaseClient, User } from "@supabase/supabase-js"
import { getSupabaseClient } from "../lib/supabaseClient"
import { authDebug } from "./authDebug"
import type { AuthAdapter, AuthRole, AuthSession } from "./types"

type AppRole = AuthRole

export type ResolvedSupabaseRole =
  | { ok: true; role: AppRole }
  | { ok: false; reason: "missing_role" | "lookup_error"; message: string }

const emptySession: AuthSession = {
  isAuthenticated: false,
  name: "",
  isLoading: false,
}

const isAppRole = (value: unknown): value is AppRole =>
  value === "worker" || value === "provider" || value === "admin"

export async function resolveSupabaseAppRole(
  supabase: SupabaseClient,
  user: User,
): Promise<ResolvedSupabaseRole> {
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("primary_role")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    authDebug("[auth] user_profiles role lookup failed", {
      code: error.code,
      message: error.message,
    })
  }

  const candidates = [
    profile?.primary_role,
    user.user_metadata?.primary_role,
    user.user_metadata?.role,
    user.user_metadata?.active_role,
    user.user_metadata?.account_type,
    user.app_metadata?.primary_role,
    user.app_metadata?.role,
  ]

  const role = candidates.find(isAppRole)
  if (role) {
    return { ok: true, role }
  }

  if (error) {
    return {
      ok: false,
      reason: "lookup_error",
      message: "We couldn't verify your workspace role. Please try again.",
    }
  }

  return {
    ok: false,
    reason: "missing_role",
    message: "No workspace role found for this account.",
  }
}

function displayNameFromUser(user: User): string {
  const meta = user.user_metadata ?? {}
  if (typeof meta.display_name === "string" && meta.display_name.trim()) {
    return meta.display_name.trim()
  }
  if (typeof meta.contact_name === "string" && meta.contact_name.trim()) {
    return meta.contact_name.trim()
  }
  if (typeof meta.full_name === "string" && meta.full_name.trim()) {
    return meta.full_name.trim()
  }
  return user.email?.trim() ?? ""
}

async function mapUserToSession(
  supabase: SupabaseClient,
  user: User,
): Promise<AuthSession> {
  const resolved = await resolveSupabaseAppRole(supabase, user)

  const base = {
    isAuthenticated: true as const,
    userId: user.id,
    email: user.email ?? undefined,
    name: displayNameFromUser(user),
    isLoading: false,
  }

  if (!resolved.ok) {
    authDebug("[auth] unresolved app role", {
      reason: resolved.reason,
      userId: user.id,
    })
    return {
      ...base,
      authError: resolved.message,
    }
  }

  const appSession: AuthSession = {
    ...base,
    role: resolved.role,
  }

  authDebug("[auth] resolved app session", {
    role: appSession.role,
    userId: appSession.userId,
  })

  return appSession
}

export const supabaseAuthAdapter: AuthAdapter = {
  async getSession(): Promise<AuthSession> {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) {
      return { ...emptySession }
    }
    return mapUserToSession(supabase, user)
  },

  loginAs(_role: AuthRole): void {
    if (_role === "admin") {
      throw new Error("Use /auth/admin to sign in with an approved operations account.")
    }
    throw new Error(
      "Supabase auth sign-in is not connected yet. Use mock mode or the worker/provider entry screens.",
    )
  },

  async logout(): Promise<void> {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
  },

  switchRole(_role: AuthRole): void {
    throw new Error(
      "Role switching requires role management and is not connected yet.",
    )
  },
}
