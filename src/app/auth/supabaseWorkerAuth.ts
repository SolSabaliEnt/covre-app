import type { ApiError, ApiResult } from "../api/types"
import {
  getUserMetadata,
  hasProviderMetadataEvidence,
  hasWorkerMetadataEvidence,
  metadataRole,
  rejectSignInAndSignOut,
  userHasAdminConsoleRole,
  userHasWorkerProfile,
} from "./authRoleGate"
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient"

export type WorkerEmailAuthPayload = {
  email: string
  password: string
  fullName?: string
  phone?: string
}

export type WorkerEmailAuthSuccess = {
  userId: string
  email: string
  message: string
  sessionEstablished: boolean
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function fail(code: string, message: string): ApiResult<never> {
  return { ok: false, error: { code, message } }
}

function mapAuthError(err: { message?: string; code?: string }): ApiError {
  const code = err.code ?? "auth_error"
  const raw = (err.message ?? "").trim()
  const c = code.toLowerCase()
  const m = raw.toLowerCase()

  if (c === "invalid_credentials" || m.includes("invalid login credentials")) {
    return { code: "invalid_credentials", message: "Invalid login credentials" }
  }
  if (
    c === "email_not_confirmed" ||
    m.includes("email not confirmed") ||
    m.includes("email address not confirmed")
  ) {
    return {
      code: "email_not_confirmed",
      message: "Email confirmation required. Confirm your email, then sign in.",
    }
  }
  if (
    c === "user_already_exists" ||
    c === "signup_disabled" ||
    m.includes("user already registered") ||
    m.includes("already been registered")
  ) {
    return {
      code: "user_already_exists",
      message: "An account with this email already exists. Try signing in.",
    }
  }
  if (c === "weak_password" || (m.includes("password") && m.includes("6"))) {
    return {
      code: "weak_password",
      message: "Password should be at least 6 characters",
    }
  }
  if (raw.length > 0) {
    return { code, message: raw }
  }
  return { code: "auth_error", message: "Sign-in failed. Try again." }
}

export async function signUpWorkerWithEmail(
  payload: WorkerEmailAuthPayload,
): Promise<ApiResult<WorkerEmailAuthSuccess>> {
  if (!isSupabaseConfigured) {
    return fail("supabase_not_configured", "Supabase is not configured")
  }

  const email = payload.email.trim()
  const password = payload.password
  if (!email || !password) {
    return fail("validation", "Email and password are required.")
  }

  const fullName = payload.fullName?.trim()
  const phone = payload.phone?.trim()

  try {
    const supabase = getSupabaseClient()
    const meta: Record<string, unknown> = {
      role: "worker",
      worker_onboarding_complete: false,
    }
    if (fullName) meta.full_name = fullName
    if (phone) meta.phone = phone

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: meta,
      },
    })

    if (error) {
      return { ok: false, error: mapAuthError(error) }
    }

    const user = data.user
    if (!user) {
      return fail("signup_no_user", "Could not create account. Try again.")
    }

    const sessionEstablished = Boolean(data.session)
    const message = sessionEstablished
      ? "Worker account created"
      : "Check your email to confirm your account, then sign in to continue applying for shifts."

    return ok({
      userId: user.id,
      email: user.email ?? email,
      message,
      sessionEstablished,
    })
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Request failed."
    if (/not configured/i.test(raw)) {
      return fail("supabase_not_configured", "Supabase is not configured")
    }
    return fail("unexpected", raw)
  }
}

export async function signInWorkerWithEmail(
  payload: WorkerEmailAuthPayload,
): Promise<ApiResult<WorkerEmailAuthSuccess>> {
  if (!isSupabaseConfigured) {
    return fail("supabase_not_configured", "Supabase is not configured")
  }

  const email = payload.email.trim()
  const password = payload.password
  if (!email || !password) {
    return fail("validation", "Email and password are required.")
  }

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return { ok: false, error: mapAuthError(error) }
    }

    const user = data.user
    if (!user) {
      return fail("signin_no_user", "Sign-in failed. Try again.")
    }

    const meta = getUserMetadata(user)
    const role = metadataRole(meta)
    const workerProfile = await userHasWorkerProfile(supabase, user.id)
    const workerEvidence = hasWorkerMetadataEvidence(meta) || workerProfile

    if (role === "provider") {
      await rejectSignInAndSignOut(supabase)
      return fail(
        "wrong_workspace",
        "This account is registered as a facility account. Use /facillities to sign in.",
      )
    }

    if (await userHasAdminConsoleRole(supabase, user.id)) {
      await rejectSignInAndSignOut(supabase)
      return fail(
        "wrong_workspace",
        "This account has admin access. Use /auth/admin to sign in.",
      )
    }

    if (hasProviderMetadataEvidence(meta) && !workerEvidence) {
      await rejectSignInAndSignOut(supabase)
      return fail(
        "wrong_workspace",
        "This account is registered as a facility account. Use /facillities to sign in.",
      )
    }

    if (!workerEvidence) {
      await rejectSignInAndSignOut(supabase)
      return fail(
        "wrong_workspace",
        "This account is not registered as a worker account. Sign up at /apply to continue.",
      )
    }

    if (role !== "worker") {
      await supabase.auth.updateUser({ data: { role: "worker" } })
    }

    return ok({
      userId: user.id,
      email: user.email ?? email,
      message: "Signed in",
      sessionEstablished: true,
    })
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Request failed."
    if (/not configured/i.test(raw)) {
      return fail("supabase_not_configured", "Supabase is not configured")
    }
    return fail("unexpected", raw)
  }
}
