import type { ApiResult } from "../api/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  ProviderOnboardingDraft,
  ProviderOnboardingResult,
  ProviderOnboardingStatusPayload,
  ProviderOnboardingStep,
} from "../services/types"

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function logSanitizedFailure(scope: string, err: { message?: string; code?: string }) {
  if (import.meta.env.DEV) {
    console.warn(`[provider-onboarding] ${scope}`, {
      code: err.code ?? "unknown",
      message: err.message ?? "unknown",
    })
  }
}

function friendlyAuthOrDbMessage(
  err: { message?: string; code?: string },
  context: "save" | "load" = "save",
): string {
  const raw = err.message ?? ""
  const code = (err.code ?? "").toLowerCase()

  if (code === "not_authenticated" || /not authenticated|jwt expired|invalid jwt/i.test(raw)) {
    return "Your session expired. Please sign in again."
  }
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return context === "save"
      ? "Workspace setup needs permission to create your organization."
      : "Organization details are blocked by database permissions (RLS)."
  }
  if (raw.trim().length > 0 && !/internal server error/i.test(raw)) {
    return raw
  }
  return context === "save"
    ? "We couldn't save your workspace yet. Please try again."
    : "Unable to load provider setup."
}

function suggestedOnboardingStepFromDraft(
  d: Partial<ProviderOnboardingDraft>,
  onboardingComplete: boolean,
): ProviderOnboardingStep {
  if (onboardingComplete) return "complete"
  if (!d.organizationName?.trim()) return "organization"
  if (!d.siteName?.trim()) return "site"
  if (!d.rolesNeeded?.length) return "staffing"
  if (!d.billingEmail?.trim()) return "billing"
  return "complete"
}

function displayNameForProvider(
  draft: Partial<ProviderOnboardingDraft>,
  sessionUser: { email?: string | null; user_metadata?: Record<string, unknown> },
): string {
  const fromDraft = draft.contactName?.trim()
  if (fromDraft) return fromDraft
  const metaName =
    typeof sessionUser.user_metadata?.contact_name === "string"
      ? sessionUser.user_metadata.contact_name.trim()
      : ""
  if (metaName) return metaName
  const email = sessionUser.email?.trim()
  if (email?.includes("@")) return email.split("@")[0] ?? "Provider"
  return "Provider"
}

async function upsertProviderUserProfile(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
  email: string | undefined,
  draft: Partial<ProviderOnboardingDraft>,
  sessionUser: { email?: string | null; user_metadata?: Record<string, unknown> },
): Promise<ApiResult<void>> {
  const { error } = await supabase.from("user_profiles").upsert(
    {
      id: userId,
      display_name: displayNameForProvider(draft, sessionUser),
      email: email ?? null,
      phone: draft.contactPhone?.trim() || null,
      primary_role: "provider",
    },
    { onConflict: "id" },
  )
  if (error) {
    logSanitizedFailure("user_profile_upsert", error)
    return fail("user_profile_upsert", friendlyAuthOrDbMessage(error))
  }
  return ok(undefined)
}

async function findExistingProviderId(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
): Promise<ApiResult<string | null>> {
  const { data: rows, error } = await supabase
    .from("provider_members")
    .select("provider_id")
    .eq("user_id", userId)
    .limit(1)

  if (error) {
    logSanitizedFailure("provider_member_lookup", error)
    return fail("provider_member_lookup", friendlyAuthOrDbMessage(error))
  }
  const row = rows?.[0] as { provider_id?: string } | undefined
  return ok(row?.provider_id ?? null)
}

/** Idempotent Step 1 persistence: org + owner membership + user profile. */
async function persistProviderOrganizationStep(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
  email: string | undefined,
  draft: Partial<ProviderOnboardingDraft>,
  sessionUser: { email?: string | null; user_metadata?: Record<string, unknown> },
): Promise<ApiResult<{ providerId: string }>> {
  const name = draft.organizationName?.trim()
  if (!name) {
    return fail("validation", "Organization name is required.")
  }

  const profileRes = await upsertProviderUserProfile(supabase, userId, email, draft, sessionUser)
  if (!profileRes.ok) return profileRes

  const orgPayload = {
    name,
    organization_type: draft.organizationType?.trim() || null,
    phone: draft.contactPhone?.trim() || null,
    status: "pending" as const,
  }

  const existingRes = await findExistingProviderId(supabase, userId)
  if (!existingRes.ok) return existingRes
  const existingProviderId = existingRes.data

  if (existingProviderId) {
    const { error: updateErr } = await supabase
      .from("provider_organizations")
      .update(orgPayload)
      .eq("id", existingProviderId)
    if (updateErr) {
      logSanitizedFailure("provider_org_update", updateErr)
      return fail("provider_org_update", friendlyAuthOrDbMessage(updateErr))
    }
    return ok({ providerId: existingProviderId })
  }

  const { data: orgRow, error: orgErr } = await supabase
    .from("provider_organizations")
    .insert(orgPayload)
    .select("id")
    .single()

  if (orgErr || !orgRow) {
    logSanitizedFailure("provider_org_insert", orgErr ?? { message: "Unknown error" })
    return fail(
      "provider_org_insert",
      friendlyAuthOrDbMessage(orgErr ?? { message: "Unknown error" }),
    )
  }

  const providerId = orgRow.id as string

  const { error: memberErr } = await supabase.from("provider_members").insert({
    provider_id: providerId,
    user_id: userId,
    role: "owner",
  })
  if (memberErr) {
    logSanitizedFailure("provider_member_insert", memberErr)
    return fail("provider_member_insert", friendlyAuthOrDbMessage(memberErr))
  }

  return ok({ providerId })
}

function shouldPersistOrganizationStep(draft: Partial<ProviderOnboardingDraft>): boolean {
  return Boolean(draft.organizationName?.trim())
}

async function mergeProviderOnboardingMetadata(
  supabase: ReturnType<typeof getSupabaseClient>,
  sessionUser: { user_metadata?: Record<string, unknown> },
  draft: Partial<ProviderOnboardingDraft>,
): Promise<ApiResult<void>> {
  const prev =
    (sessionUser.user_metadata?.provider_onboarding_draft as
      | Partial<ProviderOnboardingDraft>
      | undefined) ?? {}
  const merged: Partial<ProviderOnboardingDraft> = { ...prev, ...draft }
  const { error } = await supabase.auth.updateUser({
    data: {
      role: "provider",
      provider_onboarding_complete: false,
      provider_onboarding_draft: merged,
    },
  })
  if (error) {
    logSanitizedFailure("auth_update_failed", error)
    return fail("auth_update_failed", friendlyAuthOrDbMessage(error))
  }
  return ok(undefined)
}

export async function getProviderOnboardingStatusFromSupabase(): Promise<
  ApiResult<ProviderOnboardingStatusPayload>
> {
  try {
    const supabase = getSupabaseClient()
    await supabase.auth.refreshSession().catch(() => undefined)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      return fail(
        "not_authenticated",
        "Your session expired. Please sign in again.",
      )
    }
    const meta = session.user.user_metadata ?? {}
    const lastDraft =
      (meta.provider_onboarding_draft as Partial<ProviderOnboardingDraft> | undefined) ?? {}
    const onboardingComplete = Boolean(meta.provider_onboarding_complete)
    const suggestedStep = suggestedOnboardingStepFromDraft(lastDraft, onboardingComplete)
    return ok({
      onboardingComplete,
      suggestedStep,
      lastDraft,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

/** Persists draft: Step 1 fields write org/member/profile; all steps merge auth metadata draft. */
export async function saveProviderOnboardingDraftToSupabase(
  draft: Partial<ProviderOnboardingDraft>,
): Promise<ApiResult<{ saved: true }>> {
  try {
    const supabase = getSupabaseClient()
    await supabase.auth.refreshSession().catch(() => undefined)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      return fail(
        "not_authenticated",
        "Your session expired. Please sign in again.",
      )
    }

    if (shouldPersistOrganizationStep(draft)) {
      const orgRes = await persistProviderOrganizationStep(
        supabase,
        session.user.id,
        session.user.email ?? undefined,
        draft,
        session.user,
      )
      if (!orgRes.ok) return orgRes
    }

    const metaRes = await mergeProviderOnboardingMetadata(supabase, session.user, draft)
    if (!metaRes.ok) return metaRes

    return ok({ saved: true as const })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function completeProviderOnboardingInSupabase(
  draft: ProviderOnboardingDraft,
): Promise<ApiResult<ProviderOnboardingResult>> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      return fail(
        "not_authenticated",
        "Your session expired. Please sign in again.",
      )
    }
    const userId = session.user.id

    if (!draft.organizationName?.trim()) {
      return fail("validation", "Organization name is required.")
    }
    if (!draft.siteName?.trim()) {
      return fail("validation", "Site name is required.")
    }
    if (!draft.rolesNeeded?.length) {
      return fail("validation", "Select at least one role you need covered.")
    }

    const completedAt = new Date().toISOString()

    const stepRes = await persistProviderOrganizationStep(
      supabase,
      userId,
      session.user.email ?? undefined,
      draft,
      session.user,
    )
    if (!stepRes.ok) return stepRes

    const providerId = stepRes.data.providerId

    const { error: orgActivateErr } = await supabase
      .from("provider_organizations")
      .update({
        name: draft.organizationName.trim(),
        organization_type: draft.organizationType?.trim() || null,
        billing_email: draft.billingEmail?.trim() || null,
        phone: draft.contactPhone?.trim() || null,
        status: "active",
      })
      .eq("id", providerId)

    if (orgActivateErr) {
      logSanitizedFailure("provider_org_activate", orgActivateErr)
      return fail("provider_org_activate", friendlyAuthOrDbMessage(orgActivateErr))
    }

    const residentParsed = Number.parseInt(String(draft.residentCount ?? "").trim(), 10)
    const residentCount = Number.isFinite(residentParsed) ? residentParsed : null

    const { data: siteRow, error: siteErr } = await supabase
      .from("care_sites")
      .insert({
        provider_id: providerId,
        name: draft.siteName.trim(),
        site_type: draft.siteType?.trim() || null,
        address_line1: draft.siteAddress?.trim() || null,
        address_line2: null,
        city: draft.city?.trim() || null,
        state: draft.state?.trim() || null,
        postal_code: null,
        resident_count: residentCount,
        status: "needs_review",
      })
      .select("id")
      .single()

    if (siteErr || !siteRow) {
      logSanitizedFailure("care_site_insert", siteErr ?? { message: "Unknown error" })
      return fail("care_site_insert", friendlyAuthOrDbMessage(siteErr ?? { message: "Unknown error" }))
    }

    const siteId = siteRow.id as string

    const hasContact =
      Boolean(draft.contactName?.trim()) ||
      Boolean(draft.contactEmail?.trim()) ||
      Boolean(draft.contactPhone?.trim())
    if (hasContact) {
      const { error: contactErr } = await supabase.from("site_contacts").insert({
        site_id: siteId,
        name: draft.contactName?.trim() || null,
        title: null,
        phone: draft.contactPhone?.trim() || null,
        email: draft.contactEmail?.trim() || null,
        is_primary: true,
      })
      if (contactErr) {
        logSanitizedFailure("site_contact_insert", contactErr)
        return fail("site_contact_insert", friendlyAuthOrDbMessage(contactErr))
      }
    }

    const overviewLines = [
      draft.rolesNeeded?.length ? `Roles needed: ${draft.rolesNeeded.join(", ")}` : null,
      draft.shiftTypes?.length ? `Shift types: ${draft.shiftTypes.join(", ")}` : null,
    ].filter(Boolean)
    const overview = overviewLines.length > 0 ? overviewLines.join("\n") : "Orientation to be completed."

    const { error: orientErr } = await supabase.from("site_orientation").insert({
      site_id: siteId,
      overview,
      parking_notes: "",
      door_access: "",
      house_rules: "",
      emergency_protocol: "",
      med_pass_notes: "",
    })
    if (orientErr) {
      logSanitizedFailure("site_orientation_insert", orientErr)
      return fail("site_orientation_insert", friendlyAuthOrDbMessage(orientErr))
    }

    const { error: metaErr } = await supabase.auth.updateUser({
      data: {
        role: "provider",
        provider_onboarding_complete: true,
        provider_onboarding_draft: null,
      },
    })
    if (metaErr) {
      logSanitizedFailure("auth_update_failed", metaErr)
      return fail("auth_update_failed", friendlyAuthOrDbMessage(metaErr))
    }

    return ok({
      providerId,
      siteId,
      status: "complete",
      message: "Provider workspace created",
      completedAt,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
