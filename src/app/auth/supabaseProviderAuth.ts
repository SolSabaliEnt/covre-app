import type { ApiError, ApiResult } from "../api/types"
import {
  getUserMetadata,
  hasProviderMetadataEvidence,
  hasWorkerOnlyMetadataEvidence,
  metadataRole,
  rejectSignInAndSignOut,
  userHasProviderMembership,
} from "./authRoleGate"
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient"

export type ProviderEmailAuthPayload = {
  email: string
  password: string
  organizationName?: string
  contactName?: string
}

export type ProviderEmailAuthSuccess = {
  userId: string
  email: string
  message: string
  /** When false (e.g. email confirmation flow), caller should not assume a session exists yet. */
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
      message:
        "Email confirmation required. Confirm your email, then sign in to continue setup.",
    }
  }
  if (
    c === "user_already_exists" ||
    c === "signup_disabled" ||
    m.includes("user already registered") ||
    m.includes("already been registered")
  ) {
    return { code: "user_already_exists", message: "An account with this email already exists. Try signing in." }
  }
  if (c === "weak_password" || m.includes("password")) {
    return { code: "weak_password", message: "Password does not meet requirements. Use at least 6 characters." }
  }
  if (raw.length > 0) {
    return { code, message: raw }
  }
  return { code: "auth_error", message: "Sign-in failed. Try again." }
}

export async function signUpProviderWithEmail(
  payload: ProviderEmailAuthPayload,
): Promise<ApiResult<ProviderEmailAuthSuccess>> {
  if (!isSupabaseConfigured) {
    return fail("supabase_not_configured", "Supabase is not configured")
  }

  const email = payload.email.trim()
  const password = payload.password
  if (!email || !password) {
    return fail("validation", "Email and password are required.")
  }

  const organizationName = payload.organizationName?.trim()
  const contactName = payload.contactName?.trim()

  try {
    const supabase = getSupabaseClient()
    const meta: Record<string, unknown> = {
      role: "provider",
      provider_onboarding_complete: false,
    }
    if (organizationName) meta.organization_name = organizationName
    if (contactName) meta.contact_name = contactName

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
      ? "Provider account created. Continuing to workspace setup."
      : "Check your email to confirm your account, then sign in to continue setup."

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

export async function signInProviderWithEmail(
  payload: ProviderEmailAuthPayload,
): Promise<ApiResult<ProviderEmailAuthSuccess>> {
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
    const providerMember = await userHasProviderMembership(supabase, user.id)
    const providerEvidence = hasProviderMetadataEvidence(meta) || providerMember

    if (role === "worker") {
      await rejectSignInAndSignOut(supabase)
      return fail(
        "wrong_workspace",
        "This account is registered as a worker. Use /apply to sign in.",
      )
    }

    if (hasWorkerOnlyMetadataEvidence(meta) && !providerEvidence) {
      await rejectSignInAndSignOut(supabase)
      return fail(
        "wrong_workspace",
        "This account is registered as a worker. Use /apply to sign in.",
      )
    }

    if (!providerEvidence) {
      await rejectSignInAndSignOut(supabase)
      return fail(
        "wrong_workspace",
        "This account is not registered as a facility account. Sign up at /facillities to continue.",
      )
    }

    if (role !== "provider") {
      await supabase.auth.updateUser({ data: { role: "provider" } })
    }

    return ok({
      userId: user.id,
      email: user.email ?? email,
      message: "Signed in. Continuing to workspace setup.",
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
