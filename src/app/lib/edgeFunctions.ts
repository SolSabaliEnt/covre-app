/** Supabase Edge Function names — server-side payment setup boundary (stubs return 501 until configured). */

export const CREATE_PROVIDER_PAYMENT_METHOD_SETUP_SESSION_FUNCTION =
  "create-provider-payment-method-setup-session"

export const PROVIDER_PAYMENT_METHOD_WEBHOOK_FUNCTION = "provider-payment-method-webhook"

export const CREATE_WORKER_PAYOUT_METHOD_SETUP_SESSION_FUNCTION =
  "create-worker-payout-method-setup-session"

export const WORKER_PAYOUT_METHOD_WEBHOOK_FUNCTION = "worker-payout-method-webhook"

export const REFRESH_WORKER_PAYOUT_METHOD_STATUS_FUNCTION =
  "refresh-worker-payout-method-status"

export const CREATE_PROVIDER_INVOICE_PAYMENT_INTENT_FUNCTION =
  "create-provider-invoice-payment-intent"

/** Stub / not-yet-configured response from setup-session Edge Function. */
export type PaymentSetupNotConfiguredResponse = {
  ok: false
  configured?: false
  code: string
  message: string
  next?: string
  requiresConfiguration?: readonly string[]
}

/** Live setup session from Edge (hosted Checkout — no secrets in browser). */
export type PaymentSetupSessionLiveResponse = {
  ok: true
  configured: true
  processor: string
  setupSessionId: string
  hostedUrl?: string
  expiresAt?: string
  provider_id?: string
}

/** @deprecated Use PaymentSetupSessionLiveResponse */
export type PaymentSetupSessionResponse = {
  ok: true
  setupSessionId: string
  expiresAt: string
  providerId: string
}

export type PaymentSetupSessionPreviewResult = {
  configured: boolean
  code?: string
  message: string
  next?: string
  requiresConfiguration?: readonly string[]
  processor?: string
  setupSessionId?: string
  hostedUrl?: string
  expiresAt?: string
}

export function isPaymentSetupSessionLive(
  payload: unknown,
): payload is PaymentSetupSessionLiveResponse {
  if (!payload || typeof payload !== "object") return false
  const p = payload as PaymentSetupSessionLiveResponse
  return (
    p.ok === true &&
    p.configured === true &&
    typeof p.setupSessionId === "string" &&
    p.setupSessionId.length > 0
  )
}

export function isPaymentSetupNotConfigured(
  payload: unknown,
): payload is PaymentSetupNotConfiguredResponse {
  if (!payload || typeof payload !== "object") return false
  const p = payload as PaymentSetupNotConfiguredResponse
  return (
    p.ok === false &&
    (p.code === "provider_payment_method_setup_not_configured" ||
      p.code === "payment_setup_not_configured" ||
      p.code === "provider_payment_processor_adapter_not_implemented" ||
      p.code === "provider_payment_stripe_setup_adapter_not_implemented" ||
      p.code === "provider_payment_stripe_webhook_adapter_not_implemented" ||
      p.code === "provider_payment_stripe_setup_failed" ||
      p.code === "provider_auth_not_configured")
  )
}

/** Stub / not-yet-configured response from worker payout setup-session Edge Function. */
export type WorkerPayoutMethodSetupNotConfiguredResponse = {
  ok: false
  code: string
  message: string
  next?: string
}

/** Preview result while setup Edge returns 501 — no hosted_url or client_secret. */
export type WorkerPayoutMethodSetupSessionPreviewResult = {
  configured: false
  code: string
  message: string
  next?: string
}

export function isWorkerPayoutMethodSetupNotConfigured(
  payload: unknown,
): payload is WorkerPayoutMethodSetupNotConfiguredResponse {
  if (!payload || typeof payload !== "object") return false
  const p = payload as WorkerPayoutMethodSetupNotConfiguredResponse
  return p.ok === false && p.code === "worker_payout_method_setup_not_configured"
}

/** Live PaymentIntent creation from Edge (no client_secret). */
export type ProviderInvoicePaymentIntentLiveResponse = {
  ok: true
  configured: true
  processor: string
  providerPaymentId: string
  invoiceId: string
  processorPaymentIntentId: string
  processorPaymentStatus: string
  status: string
  amountCents: number
  currency: string
  duplicate?: boolean
}

export type ProviderInvoicePaymentIntentErrorResponse = {
  ok: false
  code: string
  message: string
  configured?: boolean
  providerPaymentId?: string
}

export function isProviderInvoicePaymentIntentLive(
  payload: unknown,
): payload is ProviderInvoicePaymentIntentLiveResponse {
  if (!payload || typeof payload !== "object") return false
  const p = payload as ProviderInvoicePaymentIntentLiveResponse
  return (
    p.ok === true &&
    p.configured === true &&
    typeof p.providerPaymentId === "string" &&
    typeof p.processorPaymentIntentId === "string"
  )
}

export function isProviderInvoicePaymentIntentError(
  payload: unknown,
): payload is ProviderInvoicePaymentIntentErrorResponse {
  if (!payload || typeof payload !== "object") return false
  const p = payload as ProviderInvoicePaymentIntentErrorResponse
  return p.ok === false && typeof p.code === "string"
}
