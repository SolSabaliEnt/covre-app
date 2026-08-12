import type { ApiResult } from "../api/types"
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient"

export type AdminEmailAuthPayload = {
  email: string
  password: string
}

export type AdminRoleCheck = {
  isAdmin: boolean
  role?: string
  message?: string
}

/** Roles that may access `/admin`. Only `admin` exists in `0001` check constraint until a future migration. */
export const ADMIN_CONSOLE_ROLE_VALUES = [
  "admin",
  "ops",
  "support",
  "finance",
  "compliance",
] as const

export type AdminConsoleRole = (typeof ADMIN_CONSOLE_ROLE_VALUES)[number]

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function fail(code: string, message: string): ApiResult<never> {
  return { ok: false, error: { code, message } }
}

function friendlyRoleError(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Unable to verify admin role. Confirm your account has an assigned operations role."
  }
  return raw
}

function isAllowedAdminConsoleRole(role: string): role is AdminConsoleRole {
  return (ADMIN_CONSOLE_ROLE_VALUES as readonly string[]).includes(role)
}

async function loadOwnAdminConsoleRole(): Promise<ApiResult<AdminRoleCheck>> {
  if (!isSupabaseConfigured) {
    return ok({ isAdmin: false, message: "Supabase is not configured." })
  }

  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return ok({ isAdmin: false, message: "Not signed in." })
    }

    const { data: rows, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)

    if (error) {
      return fail(
        "admin_role_load",
        friendlyRoleError(error, "Unable to verify admin access."),
      )
    }

    const match = (rows ?? []).find(
      (row): row is { role: string } =>
        typeof row.role === "string" && isAllowedAdminConsoleRole(row.role),
    )

    if (!match) {
      return ok({
        isAdmin: false,
        message: "This account does not have admin access.",
      })
    }

    return ok({
      isAdmin: true,
      role: match.role,
      message: "Admin access confirmed.",
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unable to verify admin access."
    return fail("unexpected", message)
  }
}

export async function getCurrentAdminRoleFromSupabase(): Promise<ApiResult<AdminRoleCheck>> {
  return loadOwnAdminConsoleRole()
}

export async function signInAdminWithEmail(
  payload: AdminEmailAuthPayload,
): Promise<ApiResult<{ message: string; role?: string }>> {
  if (!isSupabaseConfigured) {
    return fail("supabase_not_configured", "Supabase is not configured.")
  }

  const email = payload.email.trim()
  const password = payload.password
  if (!email || !password) {
    return fail("validation", "Email and password are required.")
  }

  try {
    const supabase = getSupabaseClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      const raw = signInError.message ?? "Sign-in failed."
      if (/invalid login credentials/i.test(raw)) {
        return fail("invalid_credentials", "Invalid login credentials.")
      }
      return fail(signInError.code ?? "auth_error", raw)
    }

    const roleResult = await loadOwnAdminConsoleRole()
    if (!roleResult.ok) {
      await supabase.auth.signOut()
      return roleResult
    }

    if (!roleResult.data.isAdmin) {
      await supabase.auth.signOut()
      return fail(
        "admin_access_denied",
        roleResult.data.message ?? "This account does not have admin access.",
      )
    }

    return ok({
      message: "Admin access confirmed.",
      role: roleResult.data.role,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sign-in failed."
    return fail("unexpected", message)
  }
}
