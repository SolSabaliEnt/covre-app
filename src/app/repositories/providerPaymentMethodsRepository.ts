import type { ApiResult } from "../api/types"
import {
  CREATE_PROVIDER_PAYMENT_METHOD_SETUP_SESSION_FUNCTION,
  isPaymentSetupNotConfigured,
  isPaymentSetupSessionLive,
  type PaymentSetupSessionPreviewResult,
} from "../lib/edgeFunctions"
import { getSupabaseClient } from "../lib/supabaseClient"
import { getCurrentProviderOrganizationFromSupabase } from "./providerOrganizationRepository"
import type {
  ProviderPaymentMethodReadiness,
  ProviderPaymentMethodStatus,
  ProviderPaymentMethodSummary,
} from "../services/types"

type PaymentMethodRow = {
  id: string
  provider_id: string
  processor: string
  status: string
  brand: string | null
  last4: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

const STATUS_ORDER: Record<ProviderPaymentMethodStatus, number> = {
  active: 0,
  pending: 1,
  inactive: 2,
  failed: 3,
  removed: 4,
}

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(err: { message?: string; code?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (err.code === "PGRST205" || /does not exist|42P01/i.test(raw)) {
    return "Payment method visibility is not available yet. Apply the payment ledger migration first."
  }
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Payment method visibility is blocked by database permissions (RLS). Apply payment ledger policies (0023) on your Supabase project."
  }
  return raw
}

function mapStatus(raw: string): ProviderPaymentMethodStatus {
  if (
    raw === "pending" ||
    raw === "active" ||
    raw === "inactive" ||
    raw === "failed" ||
    raw === "removed"
  ) {
    return raw
  }
  return "pending"
}

function rowToSummary(row: PaymentMethodRow): ProviderPaymentMethodSummary {
  return {
    id: row.id,
    processor: row.processor,
    status: mapStatus(row.status),
    brand: row.brand?.trim() || undefined,
    last4: row.last4?.trim() || undefined,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isSupabaseBacked: true,
  }
}

function sortMethods(methods: ProviderPaymentMethodSummary[]): ProviderPaymentMethodSummary[] {
  return [...methods].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (statusDiff !== 0) return statusDiff
    const aTime = Date.parse(a.createdAt ?? "")
    const bTime = Date.parse(b.createdAt ?? "")
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0)
  })
}

function buildReadiness(methods: ProviderPaymentMethodSummary[]): ProviderPaymentMethodReadiness {
  const sorted = sortMethods(methods)
  const defaultMethod = sorted.find(m => m.isDefault && m.status === "active") ?? sorted.find(m => m.status === "active")
  const hasActiveMethod = sorted.some(m => m.status === "active")

  return {
    methods: sorted,
    defaultMethod,
    hasActiveMethod,
    isSupabaseBacked: true,
    message:
      sorted.length === 0
        ? "No payment method is on file yet. Setup will be connected through the secure payment flow."
        : undefined,
  }
}

export async function listProviderPaymentMethodsFromSupabase(): Promise<
  ApiResult<ProviderPaymentMethodReadiness>
> {
  try {
    const orgResult = await getCurrentProviderOrganizationFromSupabase()
    if (!orgResult.ok) {
      return orgResult
    }

    if (!orgResult.data?.providerId) {
      return ok({
        methods: [],
        hasActiveMethod: false,
        isSupabaseBacked: true,
        message:
          "Complete facility setup before payment methods can be loaded for your organization.",
      })
    }

    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return ok({
        methods: [],
        hasActiveMethod: false,
        isSupabaseBacked: true,
        message: "Sign in to view payment methods for your organization.",
      })
    }

    const { data: rows, error } = await supabase
      .from("provider_payment_methods")
      .select(
        "id, provider_id, processor, status, brand, last4, is_default, created_at, updated_at",
      )
      .eq("provider_id", orgResult.data.providerId)

    if (error) {
      return fail("payment_methods_load", friendlyDbMessage(error, "Unable to load payment methods."))
    }

    const methods = ((rows ?? []) as PaymentMethodRow[]).map(rowToSummary)
    return ok(buildReadiness(methods))
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

const SETUP_NOT_CONNECTED_MESSAGE = "Secure payment setup is not connected yet."

/**
 * Invoke setup-session Edge function — returns hosted Checkout URL when configured.
 * Wired from provider Settings/Billing when `VITE_PROVIDER_PAYMENT_METHOD_SETUP_ENABLED=true`.
 */
export async function createProviderPaymentMethodSetupSessionPreview(options?: {
  returnUrl?: string
  attemptId?: string
}): Promise<ApiResult<PaymentSetupSessionPreviewResult>> {
  try {
    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      return fail("unauthorized", "Sign in to start secure payment setup.")
    }

    const body: Record<string, string> = {}
    if (options?.returnUrl) body.return_url = options.returnUrl
    if (options?.attemptId) body.attemptId = options.attemptId
    if (!options?.attemptId && typeof crypto !== "undefined" && crypto.randomUUID) {
      body.attemptId = crypto.randomUUID()
    }

    const { data, error } = await supabase.functions.invoke(
      CREATE_PROVIDER_PAYMENT_METHOD_SETUP_SESSION_FUNCTION,
      {
        body,
      },
    )

    if (data && typeof data === "object") {
      const payload = data as { code?: string; message?: string }
      if (payload.code === "forbidden") {
        return fail("forbidden", payload.message ?? "You do not have permission to manage payment methods.")
      }
      if (payload.code === "unauthorized") {
        return fail("unauthorized", payload.message ?? "Sign in to start secure payment setup.")
      }
    }

    if (isPaymentSetupNotConfigured(data)) {
      return ok({
        configured: false,
        code: data.code,
        message: data.message,
        next: data.next,
        requiresConfiguration: data.requiresConfiguration,
      })
    }

    if (isPaymentSetupSessionLive(data)) {
      return ok({
        configured: true,
        processor: data.processor,
        setupSessionId: data.setupSessionId,
        hostedUrl: data.hostedUrl,
        expiresAt: data.expiresAt,
        message: "Secure payment setup session is ready.",
      })
    }

    if (error) {
      const raw = error.message ?? ""
      if (/403|forbidden|cannot manage payment methods/i.test(raw)) {
        return fail("forbidden", "You do not have permission to manage payment methods.")
      }
      if (/401|unauthorized/i.test(raw)) {
        return fail("unauthorized", "Sign in to start secure payment setup.")
      }
      if (/501|not configured|provider_payment_method_setup_not_configured|provider_payment_processor_adapter_not_implemented|provider_payment_stripe_setup_adapter_not_implemented|provider_auth_not_configured|payment_setup_not_configured/i.test(raw)) {
        return ok({
          configured: false,
          code: "provider_payment_method_setup_not_configured",
          message: SETUP_NOT_CONNECTED_MESSAGE,
        })
      }
      return fail("payment_setup_invoke", raw || SETUP_NOT_CONNECTED_MESSAGE)
    }

    return ok({
      configured: false,
      code: "provider_payment_method_setup_not_configured",
      message: SETUP_NOT_CONNECTED_MESSAGE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
