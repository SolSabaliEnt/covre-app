import type { ApiResult } from "../api/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  WorkerCredentialReadinessRow,
  WorkerCredentialReadinessStatus,
  WorkerCredentialSaveResult,
} from "../services/types"

type CredentialRow = {
  id: string
  name: string
  credential_type: string | null
}

type WorkerCredentialRow = {
  credential_id: string
  status: string
  expires_at: string | null
}

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Credential access is blocked by database permissions (RLS). Apply worker credentials policies (0006) on your Supabase project."
  }
  return raw
}

function mapReadinessStatus(
  dbStatus: string | undefined,
  expiresAt: string | null | undefined,
): { status: WorkerCredentialReadinessStatus; statusLabel: string } {
  if (!dbStatus || dbStatus === "missing") {
    return { status: "missing", statusLabel: "Missing" }
  }
  if (expiresAt) {
    const exp = new Date(expiresAt)
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
      return { status: "expired", statusLabel: "Expired" }
    }
    if (dbStatus === "expiring_soon") {
      return { status: "expired", statusLabel: "Expiring soon" }
    }
  }
  if (dbStatus === "verified") {
    return { status: "verified", statusLabel: "Verified" }
  }
  if (dbStatus === "pending") {
    return { status: "pending", statusLabel: "Pending review" }
  }
  if (dbStatus === "rejected") {
    return { status: "missing", statusLabel: "Needs update" }
  }
  return { status: "pending", statusLabel: "Pending review" }
}

export async function listWorkerCredentialReadinessFromSupabase(): Promise<
  ApiResult<WorkerCredentialReadinessRow[]>
> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      return fail(
        "not_authenticated",
        "Sign in with Supabase before loading credentials.",
      )
    }

    const { data: catalog, error: catalogErr } = await supabase
      .from("credentials")
      .select("id, name, credential_type")
      .order("name", { ascending: true })

    if (catalogErr) {
      return fail("credentials_load", friendlyDbMessage(catalogErr, "Unable to load credentials."))
    }

    const { data: workerProfile } = await supabase
      .from("worker_profiles")
      .select("id")
      .eq("user_id", session.user.id)
      .maybeSingle()

    const workerId = (workerProfile as { id: string } | null)?.id
    let workerCreds: WorkerCredentialRow[] = []

    if (workerId) {
      const { data: wcRows, error: wcErr } = await supabase
        .from("worker_credentials")
        .select("credential_id, status, expires_at")
        .eq("worker_id", workerId)

      if (wcErr) {
        return fail(
          "worker_credentials_load",
          friendlyDbMessage(wcErr, "Unable to load your credentials."),
        )
      }
      workerCreds = (wcRows ?? []) as WorkerCredentialRow[]
    }

    const byCredentialId = new Map(workerCreds.map(w => [w.credential_id, w]))

    const rows: WorkerCredentialReadinessRow[] = ((catalog ?? []) as CredentialRow[]).map(c => {
      const wc = byCredentialId.get(c.id)
      const { status, statusLabel } = mapReadinessStatus(wc?.status, wc?.expires_at)
      return {
        credentialId: c.id,
        name: c.name,
        category: c.credential_type ?? undefined,
        status,
        statusLabel,
        expiresAt: wc?.expires_at ?? undefined,
      }
    })

    return ok(rows)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

export async function selfAttestWorkerCredentialInSupabase(
  credentialId: string,
): Promise<ApiResult<WorkerCredentialSaveResult>> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      return fail(
        "not_authenticated",
        "Sign in with Supabase before loading credentials.",
      )
    }

    const { data: workerProfile, error: profileErr } = await supabase
      .from("worker_profiles")
      .select("id")
      .eq("user_id", session.user.id)
      .maybeSingle()

    if (profileErr) {
      return fail("worker_profile_load", friendlyDbMessage(profileErr, "Unable to load profile."))
    }

    const workerId = (workerProfile as { id: string } | null)?.id
    if (!workerId) {
      return fail(
        "profile_required",
        "Complete your worker profile before adding credentials.",
      )
    }

    const { data: existing } = await supabase
      .from("worker_credentials")
      .select("id")
      .eq("worker_id", workerId)
      .eq("credential_id", credentialId)
      .maybeSingle()

    const updatedAt = new Date().toISOString()

    if (existing?.id) {
      const { error: updateErr } = await supabase
        .from("worker_credentials")
        .update({ status: "pending", updated_at: updatedAt })
        .eq("id", existing.id)

      if (updateErr) {
        return fail(
          "worker_credential_update",
          friendlyDbMessage(updateErr, "Unable to update credential."),
        )
      }
    } else {
      const { error: insertErr } = await supabase.from("worker_credentials").insert({
        worker_id: workerId,
        credential_id: credentialId,
        status: "pending",
      })

      if (insertErr) {
        return fail(
          "worker_credential_insert",
          friendlyDbMessage(insertErr, "Unable to add credential."),
        )
      }
    }

    return ok({
      credentialId,
      status: "pending",
      message: "Credential added for review",
      updatedAt,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
