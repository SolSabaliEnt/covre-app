import type { ApiResult } from "../api/types"
import {
  CREATE_WORKER_PAYOUT_METHOD_SETUP_SESSION_FUNCTION,
  type WorkerPayoutMethodSetupSessionPreviewResult,
  isWorkerPayoutMethodSetupNotConfigured,
} from "../lib/edgeFunctions"
import { getSupabaseClient } from "../lib/supabaseClient"

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

const SETUP_NOT_CONNECTED_MESSAGE = "Worker payout method setup is not connected yet."

/**
 * Preview invoke for worker payout setup-session Edge stub — safe when server returns 501.
 * Not wired from Worker Pay UI; setup button stays disabled until live integration.
 * Does not collect bank/card data; does not expect hosted_url or client_secret from stub.
 */
export async function createWorkerPayoutMethodSetupSessionPreview(options?: {
  returnUrl?: string
}): Promise<ApiResult<WorkerPayoutMethodSetupSessionPreviewResult>> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      return fail("unauthorized", "Sign in to start payout method setup.")
    }

    const { data, error } = await supabase.functions.invoke(
      CREATE_WORKER_PAYOUT_METHOD_SETUP_SESSION_FUNCTION,
      {
        body: options?.returnUrl ? { return_url: options.returnUrl } : {},
      },
    )

    if (isWorkerPayoutMethodSetupNotConfigured(data)) {
      return ok({
        configured: false,
        code: data.code,
        message: data.message,
        next: data.next,
      })
    }

    if (error) {
      const raw = error.message ?? ""
      if (/501|not configured|worker_payout_method_setup_not_configured/i.test(raw)) {
        return ok({
          configured: false,
          code: "worker_payout_method_setup_not_configured",
          message: SETUP_NOT_CONNECTED_MESSAGE,
        })
      }
      return fail("payout_method_setup_invoke", raw || SETUP_NOT_CONNECTED_MESSAGE)
    }

    return ok({
      configured: false,
      code: "worker_payout_method_setup_not_configured",
      message: SETUP_NOT_CONNECTED_MESSAGE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
