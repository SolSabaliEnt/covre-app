import type { ApiResult } from "../api/types"
import { getCurrentAdminRoleFromSupabase } from "../auth/supabaseAdminAuth"
import { getSupabaseClient } from "../lib/supabaseClient"
import {
  CREATE_PROVIDER_INVOICE_PAYMENT_INTENT_FUNCTION,
  isProviderInvoicePaymentIntentError,
  isProviderInvoicePaymentIntentLive,
} from "../lib/edgeFunctions"
import { isProviderInvoiceCollectionUiEnabled } from "../lib/providerInvoiceCollectionEnabled"
import type {
  AdminInvoiceIssueQueue,
  AdminInvoiceIssueRow,
  AdminProviderInvoiceCollectionQueue,
  AdminProviderInvoiceCollectionRow,
  ProviderInvoiceCollectionStartResult,
  ProviderInvoiceIssueResult,
  ProviderInvoicePaymentStatus,
} from "../services/types"

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function mapPaymentStatus(raw: unknown): ProviderInvoicePaymentStatus | undefined {
  if (typeof raw !== "string") return undefined
  const allowed: ProviderInvoicePaymentStatus[] = [
    "not_started",
    "requires_payment_method",
    "processing",
    "paid",
    "failed",
    "past_due",
    "void",
    "refunded",
    "disputed",
  ]
  return allowed.includes(raw as ProviderInvoicePaymentStatus)
    ? (raw as ProviderInvoicePaymentStatus)
    : undefined
}

function mapRpcIssueResult(row: Record<string, unknown>): ProviderInvoiceIssueResult {
  return {
    invoiceId: String(row.invoice_id ?? ""),
    invoiceNumber:
      typeof row.invoice_number === "string" ? row.invoice_number : undefined,
    status: typeof row.status === "string" ? row.status : "open",
    paymentStatus: mapPaymentStatus(row.payment_status),
    totalCents:
      typeof row.total_cents === "number"
        ? row.total_cents
        : Number.parseInt(String(row.total_cents ?? 0), 10) || 0,
    issuedAt:
      typeof row.issued_at === "string" ? row.issued_at : undefined,
    lockedAt:
      typeof row.locked_at === "string" ? row.locked_at : undefined,
    message:
      typeof row.message === "string"
        ? row.message
        : "Provider invoice issued.",
  }
}

const ISSUE_TOTAL_TOLERANCE_CENTS = 1

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function friendlyDbMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Admin invoice reads are blocked by database permissions (RLS). Apply admin read-only policies (0016) and invoice generation (0014) on your Supabase project."
  }
  if (/PGRST205|does not exist|42P01|total_cents/i.test(raw)) {
    return "Invoice lifecycle schema is not ready. Apply migration 0029 on your Supabase project."
  }
  return raw
}

function formatTotalDisplay(cents: number | undefined, currency = "usd"): string {
  if (cents == null || !Number.isFinite(cents)) return "—"
  const code = currency.toUpperCase()
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(cents / 100)
  } catch {
    return `$${(cents / 100).toFixed(2)}`
  }
}

function headerTotalCents(row: {
  total_cents: number | null
  total: number | string | null
}): number | null {
  if (typeof row.total_cents === "number" && Number.isFinite(row.total_cents)) {
    return row.total_cents
  }
  if (row.total != null) {
    const n = typeof row.total === "number" ? row.total : Number.parseFloat(String(row.total))
    if (Number.isFinite(n)) return Math.round(n * 100)
  }
  return null
}

function computeIssueReadiness(input: {
  status: string
  generatedAt: string | null
  paidAt: string | null
  lineCount: number
  lineTotalCents: number
  headerTotalCents: number | null
}): Pick<AdminInvoiceIssueRow, "canIssue" | "blockerReason"> {
  if (input.status === "paid" || input.paidAt) {
    return { canIssue: false, blockerReason: "Invoice has already been paid." }
  }
  if (input.status === "open") {
    return { canIssue: false, blockerReason: "Invoice is already open." }
  }
  if (input.status !== "draft" || !input.generatedAt) {
    return { canIssue: false, blockerReason: "Invoice is not in draft status." }
  }
  if (input.lineCount < 1) {
    return { canIssue: false, blockerReason: "Invoice has no lines." }
  }
  if (input.lineTotalCents <= 0) {
    return { canIssue: false, blockerReason: "Invoice total is invalid." }
  }
  if (input.headerTotalCents == null || input.headerTotalCents <= 0) {
    return { canIssue: false, blockerReason: "Invoice total is invalid." }
  }
  if (Math.abs(input.headerTotalCents - input.lineTotalCents) > ISSUE_TOTAL_TOLERANCE_CENTS) {
    return {
      canIssue: false,
      blockerReason: "Invoice line total does not match invoice total.",
    }
  }
  return { canIssue: true }
}

function friendlyIssueRpcMessage(
  err: { message?: string },
  fallback: string,
): string {
  const raw = err.message ?? fallback
  const code = raw.includes("not_authorized")
    ? "not_authorized"
    : raw.match(
          /invoice_not_found|invoice_not_draft|invoice_has_no_lines|invoice_total_invalid|invoice_total_mismatch|invoice_already_paid|payment_already_exists|invoice_schema_not_ready|invoice_number_conflict/,
        )?.[0]

  switch (code) {
    case "not_authorized":
      return "You are not authorized to issue invoices."
    case "invoice_not_found":
      return "Invoice not found."
    case "invoice_not_draft":
      return "Invoice is not in draft status."
    case "invoice_has_no_lines":
      return "Invoice has no lines."
    case "invoice_total_invalid":
      return "Invoice total is invalid."
    case "invoice_total_mismatch":
      return "Invoice line total does not match invoice total."
    case "invoice_already_paid":
      return "Invoice has already been paid."
    case "payment_already_exists":
      return "A payment already exists for this invoice."
    case "invoice_schema_not_ready":
      return "Invoice lifecycle schema is not ready."
    case "invoice_number_conflict":
      return "Invoice number conflict. Retry or contact support."
    default:
      if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
        return "Invoice issue is blocked by database permissions (RLS)."
      }
      if (/PGRST202|42883|does not exist/i.test(raw)) {
        return "Invoice issue RPC is not available yet. Apply migration 0030 on your Supabase project."
      }
      return "Could not issue invoice right now."
  }
}

type InvoiceIssueQueueDbRow = {
  id: string
  status: string
  payment_status: string | null
  total: number | string | null
  total_cents: number | null
  currency: string | null
  generated_at: string | null
  due_at: string | null
  invoice_number: string | null
  paid_at: string | null
  provider_organizations?: { name: string | null } | { name: string | null }[] | null
}

type InvoiceLineAggRow = {
  invoice_id: string
  amount_cents: number | null
}

/**
 * Admin-only read: draft/generated invoices ready for issue RPC (no writes).
 */
export async function listAdminInvoiceIssueQueueFromSupabase(): Promise<
  ApiResult<AdminInvoiceIssueQueue>
> {
  try {
    const supabase = getSupabaseClient()
    const adminCheck = await requireAdminSession(supabase)
    if (!adminCheck.ok) return adminCheck

    const { data: draftRows, error: draftError } = await supabase
      .from("invoices")
      .select(
        `
        id,
        status,
        payment_status,
        total,
        total_cents,
        currency,
        generated_at,
        due_at,
        invoice_number,
        paid_at,
        provider_organizations ( name )
      `,
      )
      .eq("status", "draft")
      .not("generated_at", "is", null)
      .order("generated_at", { ascending: false })

    if (draftError) {
      return fail(
        "invoice_queue_load",
        friendlyDbMessage(draftError, "Unable to load invoice issue queue."),
      )
    }

    const invoices = (draftRows ?? []) as InvoiceIssueQueueDbRow[]
    const invoiceIds = invoices.map(row => row.id)

    const lineAgg = new Map<string, { lineCount: number; lineTotalCents: number }>()
    if (invoiceIds.length > 0) {
      const { data: lineRows, error: lineError } = await supabase
        .from("invoice_lines")
        .select("invoice_id, amount_cents")
        .in("invoice_id", invoiceIds)

      if (lineError) {
        return fail(
          "invoice_lines_load",
          friendlyDbMessage(lineError, "Unable to load invoice lines for the issue queue."),
        )
      }

      for (const line of (lineRows ?? []) as InvoiceLineAggRow[]) {
        const cents =
          typeof line.amount_cents === "number"
            ? line.amount_cents
            : Number.parseInt(String(line.amount_cents ?? 0), 10) || 0
        const prev = lineAgg.get(line.invoice_id) ?? { lineCount: 0, lineTotalCents: 0 }
        prev.lineCount += 1
        prev.lineTotalCents += cents
        lineAgg.set(line.invoice_id, prev)
      }
    }

    const rows: AdminInvoiceIssueRow[] = invoices.map(row => {
      const agg = lineAgg.get(row.id) ?? { lineCount: 0, lineTotalCents: 0 }
      const currency = row.currency ?? "usd"
      const headerCents = headerTotalCents(row)
      const readiness = computeIssueReadiness({
        status: row.status,
        generatedAt: row.generated_at,
        paidAt: row.paid_at,
        lineCount: agg.lineCount,
        lineTotalCents: agg.lineTotalCents,
        headerTotalCents: headerCents,
      })
      const provider = unwrap(row.provider_organizations)

      return {
        invoiceId: row.id,
        providerName: provider?.name ?? undefined,
        invoiceNumber: row.invoice_number ?? undefined,
        status: row.status,
        paymentStatus: mapPaymentStatus(row.payment_status),
        totalCents: headerCents ?? undefined,
        totalDisplay: formatTotalDisplay(headerCents ?? undefined, currency),
        lineCount: agg.lineCount,
        lineTotalCents: agg.lineTotalCents,
        generatedAt: row.generated_at ?? undefined,
        dueAt: row.due_at ?? undefined,
        ...readiness,
      }
    })

    const { count: openCount, error: openError } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")

    if (openError) {
      return fail(
        "invoice_queue_load",
        friendlyDbMessage(openError, "Unable to count open invoices."),
      )
    }

    const readyToIssue = rows.filter(r => r.canIssue).length
    const blocked = rows.length - readyToIssue

    return ok({
      rows,
      summary: {
        draftInvoices: rows.length,
        readyToIssue,
        blocked,
        openInvoices: openCount ?? 0,
      },
      isSupabaseBacked: true,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

async function requireAdminSession(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<ApiResult<{ userId: string }>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return fail("not_authenticated", "Sign in at /auth/admin before issuing invoices.")
  }

  const roleResult = await getCurrentAdminRoleFromSupabase()
  if (!roleResult.ok) {
    return fail(roleResult.error.code, roleResult.error.message)
  }
  if (!roleResult.data.isAdmin) {
    return fail(
      "forbidden",
      roleResult.data.message ?? "This account does not have admin access.",
    )
  }

  return ok({ userId: session.user.id })
}

/** Admin-only: issue a generated draft invoice via `issue_provider_invoice` RPC. */
export async function issueProviderInvoiceInSupabase(
  invoiceId: string,
  reason?: string,
): Promise<ApiResult<ProviderInvoiceIssueResult>> {
  try {
    const supabase = getSupabaseClient()
    const adminCheck = await requireAdminSession(supabase)
    if (!adminCheck.ok) return adminCheck

    const trimmedReason = reason?.trim()
    const { data, error } = await supabase.rpc("issue_provider_invoice", {
      target_invoice_id: invoiceId,
      reason: trimmedReason && trimmedReason.length > 0 ? trimmedReason : null,
    })

    if (error) {
      return fail(
        "invoice_issue",
        friendlyIssueRpcMessage(error, "Unable to issue provider invoice."),
      )
    }

    if (!data || typeof data !== "object") {
      return fail("invoice_issue", "Invoice issue RPC returned an empty response.")
    }

    return ok(mapRpcIssueResult(data as Record<string, unknown>))
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

const INFLIGHT_PAYMENT_STATUSES = ["requires_payment_method", "processing"] as const

type CollectionInvoiceDbRow = {
  id: string
  provider_id: string
  status: string
  payment_status: string | null
  total_cents: number | null
  total: number | string | null
  currency: string | null
  locked_at: string | null
  issued_at: string | null
  due_at: string | null
  collection_started_at: string | null
  last_payment_attempt_at: string | null
  paid_at: string | null
  invoice_number: string | null
  provider_organizations?: { name: string | null } | { name: string | null }[] | null
}

type CollectionPaymentMethodRow = {
  id: string
  provider_id: string
  status: string
  brand: string | null
  last4: string | null
  is_default: boolean
}

type CollectionProviderPaymentRow = {
  id: string
  invoice_id: string | null
  status: string
  processor_payment_status: string | null
  updated_at: string
}

function friendlyCollectionEdgeMessage(
  code: string | undefined,
  fallback: string,
): string {
  switch (code) {
    case "not_authorized":
      return "You are not authorized to start invoice collection."
    case "invoice_not_payable":
      return "This invoice is not payable."
    case "payment_method_required":
      return "An active provider payment method is required."
    case "payment_already_processing":
      return "A payment attempt is already in progress for this invoice."
    case "processor_not_configured":
      return "Payment collection is not connected yet."
    case "processor_request_failed":
      return "Payment processing could not be started."
    default:
      return fallback
  }
}

function computeCollectionReadiness(input: {
  collectionUiEnabled: boolean
  status: string
  paymentStatus: ProviderInvoicePaymentStatus | undefined
  lockedAt: string | null
  totalCents: number | null
  currency: string | null
  paidAt: string | null
  hasActivePaymentMethod: boolean
  hasInflightPayment: boolean
}): Pick<AdminProviderInvoiceCollectionRow, "canCollect" | "blockerReason"> {
  if (!input.collectionUiEnabled) {
    return { canCollect: false, blockerReason: "Payment collection is not enabled." }
  }
  if (input.status === "paid" || input.paymentStatus === "paid" || input.paidAt) {
    return { canCollect: false, blockerReason: "Already paid." }
  }
  if (input.paymentStatus === "processing" || input.hasInflightPayment) {
    return { canCollect: false, blockerReason: "Already processing." }
  }
  if (input.status !== "open") {
    return { canCollect: false, blockerReason: "Invoice is not open." }
  }
  if (!input.lockedAt) {
    return { canCollect: false, blockerReason: "Invoice is not locked for collection." }
  }
  if (input.totalCents == null || input.totalCents <= 0) {
    return { canCollect: false, blockerReason: "Missing invoice amount." }
  }
  if (!input.currency?.trim()) {
    return { canCollect: false, blockerReason: "Missing invoice currency." }
  }
  if (!input.hasActivePaymentMethod) {
    return { canCollect: false, blockerReason: "Missing provider payment method." }
  }
  return { canCollect: true }
}

function pickDefaultMethod(
  methods: CollectionPaymentMethodRow[],
): CollectionPaymentMethodRow | null {
  const active = methods.filter(m => m.status === "active")
  return active.find(m => m.is_default) ?? active[0] ?? null
}

function latestPaymentByInvoice(
  rows: CollectionProviderPaymentRow[],
): Map<string, CollectionProviderPaymentRow> {
  const map = new Map<string, CollectionProviderPaymentRow>()
  for (const row of rows) {
    if (!row.invoice_id) continue
    const prev = map.get(row.invoice_id)
    if (!prev || Date.parse(row.updated_at) > Date.parse(prev.updated_at)) {
      map.set(row.invoice_id, row)
    }
  }
  return map
}

/**
 * Admin-only read: issued/open invoices for collection queue (no writes).
 */
export async function listAdminProviderInvoiceCollectionQueueFromSupabase(): Promise<
  ApiResult<AdminProviderInvoiceCollectionQueue>
> {
  try {
    const supabase = getSupabaseClient()
    const adminCheck = await requireAdminSession(supabase)
    if (!adminCheck.ok) return adminCheck

    const collectionUiEnabled = isProviderInvoiceCollectionUiEnabled()

    const { data: invoiceRows, error: invoiceError } = await supabase
      .from("invoices")
      .select(
        `
        id,
        provider_id,
        status,
        payment_status,
        total,
        total_cents,
        currency,
        locked_at,
        issued_at,
        due_at,
        collection_started_at,
        last_payment_attempt_at,
        paid_at,
        invoice_number,
        provider_organizations ( name )
      `,
      )
      .in("status", ["open", "paid"])
      .order("issued_at", { ascending: false, nullsFirst: false })

    if (invoiceError) {
      return fail(
        "collection_queue_load",
        friendlyDbMessage(invoiceError, "Unable to load invoice collection queue."),
      )
    }

    const invoices = (invoiceRows ?? []) as CollectionInvoiceDbRow[]
    const providerIds = [...new Set(invoices.map(row => row.provider_id))]
    const invoiceIds = invoices.map(row => row.id)

    const methodsByProvider = new Map<string, CollectionPaymentMethodRow[]>()
    if (providerIds.length > 0) {
      const { data: methodRows, error: methodError } = await supabase
        .from("provider_payment_methods")
        .select("id, provider_id, status, brand, last4, is_default")
        .in("provider_id", providerIds)
        .eq("status", "active")

      if (methodError) {
        return fail(
          "payment_methods_load",
          friendlyDbMessage(methodError, "Unable to load provider payment methods."),
        )
      }

      for (const method of (methodRows ?? []) as CollectionPaymentMethodRow[]) {
        const list = methodsByProvider.get(method.provider_id) ?? []
        list.push(method)
        methodsByProvider.set(method.provider_id, list)
      }
    }

    const latestPaymentMap = new Map<string, CollectionProviderPaymentRow>()
    const inflightInvoiceIds = new Set<string>()
    if (invoiceIds.length > 0) {
      const { data: paymentRows, error: paymentError } = await supabase
        .from("provider_payments")
        .select("id, invoice_id, status, processor_payment_status, updated_at")
        .in("invoice_id", invoiceIds)
        .order("updated_at", { ascending: false })

      if (paymentError) {
        return fail(
          "provider_payments_load",
          friendlyDbMessage(paymentError, "Unable to load provider payments."),
        )
      }

      const payments = (paymentRows ?? []) as CollectionProviderPaymentRow[]
      for (const [invoiceId, payment] of latestPaymentByInvoice(payments)) {
        latestPaymentMap.set(invoiceId, payment)
      }
      for (const payment of payments) {
        if (
          payment.invoice_id &&
          (INFLIGHT_PAYMENT_STATUSES as readonly string[]).includes(payment.status)
        ) {
          inflightInvoiceIds.add(payment.invoice_id)
        }
      }
    }

    const rows: AdminProviderInvoiceCollectionRow[] = invoices.map(row => {
      const currency = row.currency ?? "usd"
      const headerCents = headerTotalCents(row)
      const defaultMethod = pickDefaultMethod(methodsByProvider.get(row.provider_id) ?? [])
      const latestPayment = latestPaymentMap.get(row.id)
      const paymentStatus = mapPaymentStatus(row.payment_status)
      const readiness = computeCollectionReadiness({
        collectionUiEnabled,
        status: row.status,
        paymentStatus,
        lockedAt: row.locked_at,
        totalCents: headerCents,
        currency: row.currency,
        paidAt: row.paid_at,
        hasActivePaymentMethod: !!defaultMethod,
        hasInflightPayment: inflightInvoiceIds.has(row.id),
      })
      const provider = unwrap(row.provider_organizations)

      return {
        invoiceId: row.id,
        providerId: row.provider_id,
        providerName: provider?.name ?? undefined,
        invoiceNumber: row.invoice_number ?? undefined,
        status: row.status,
        paymentStatus,
        totalCents: headerCents ?? undefined,
        totalDisplay: formatTotalDisplay(headerCents ?? undefined, currency),
        currency,
        lockedAt: row.locked_at ?? undefined,
        issuedAt: row.issued_at ?? undefined,
        dueAt: row.due_at ?? undefined,
        collectionStartedAt: row.collection_started_at ?? undefined,
        lastPaymentAttemptAt: row.last_payment_attempt_at ?? undefined,
        paidAt: row.paid_at ?? undefined,
        hasActivePaymentMethod: !!defaultMethod,
        methodBrand: defaultMethod?.brand?.trim() || undefined,
        methodLast4: defaultMethod?.last4?.trim() || undefined,
        latestPaymentStatus: latestPayment?.status,
        latestProcessorPaymentStatus: latestPayment?.processor_payment_status ?? undefined,
        latestProviderPaymentId: latestPayment?.id,
        ...readiness,
      }
    })

    const openInvoices = rows.filter(r => r.status === "open").length
    const readyToCollect = rows.filter(r => r.canCollect).length
    const missingPaymentMethod = rows.filter(
      r => r.status === "open" && !r.hasActivePaymentMethod,
    ).length
    const processing = rows.filter(
      r => r.paymentStatus === "processing" || r.latestPaymentStatus === "processing",
    ).length
    const paid = rows.filter(r => r.paymentStatus === "paid" || r.status === "paid").length

    return ok({
      rows,
      summary: {
        openInvoices,
        readyToCollect,
        missingPaymentMethod,
        processing,
        paid,
      },
      isSupabaseBacked: true,
      collectionUiEnabled,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}

/** Admin-only: start collection via PaymentIntent Edge (no browser financial writes). */
export async function startAdminProviderInvoiceCollectionInSupabase(
  invoiceId: string,
): Promise<ApiResult<ProviderInvoiceCollectionStartResult>> {
  try {
    const supabase = getSupabaseClient()
    const adminCheck = await requireAdminSession(supabase)
    if (!adminCheck.ok) return adminCheck

    if (!isProviderInvoiceCollectionUiEnabled()) {
      return fail(
        "collection_disabled",
        "Payment collection is not enabled.",
      )
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return fail("not_authenticated", "Sign in at /auth/admin before starting collection.")
    }

    const attemptId = `admin-ui-${invoiceId}-${Date.now()}`
    const { data, error } = await supabase.functions.invoke(
      CREATE_PROVIDER_INVOICE_PAYMENT_INTENT_FUNCTION,
      {
        body: {
          invoice_id: invoiceId,
          attempt_id: attemptId,
        },
      },
    )

    if (isProviderInvoicePaymentIntentLive(data)) {
      return ok({
        providerPaymentId: data.providerPaymentId,
        invoiceId: data.invoiceId,
        processorPaymentIntentId: data.processorPaymentIntentId,
        processorPaymentStatus: data.processorPaymentStatus,
        status: data.status,
        amountCents: data.amountCents,
        currency: data.currency,
        duplicate: data.duplicate,
        message: data.duplicate
          ? "Existing payment processing attempt returned."
          : "Payment processing started. Stripe confirmation will update the invoice status.",
      })
    }

    if (isProviderInvoicePaymentIntentError(data)) {
      return fail(
        data.code,
        friendlyCollectionEdgeMessage(data.code, data.message),
      )
    }

    if (error) {
      const raw = error.message ?? ""
      if (/403|not_authorized|forbidden/i.test(raw)) {
        return fail("not_authorized", "You are not authorized to start invoice collection.")
      }
      if (/401|unauthorized/i.test(raw)) {
        return fail("not_authenticated", "Sign in at /auth/admin before starting collection.")
      }
      if (/501|not configured|processor_not_configured/i.test(raw)) {
        return fail("processor_not_configured", "Payment collection is not connected yet.")
      }
      return fail("collection_invoke", "Payment processing could not be started.")
    }

    return fail("collection_invoke", "Payment processing could not be started.")
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", message)
  }
}
