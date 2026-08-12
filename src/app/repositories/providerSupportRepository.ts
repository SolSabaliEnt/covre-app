import type { ApiResult } from "../api/types"
import { getSupabaseClient } from "../lib/supabaseClient"
import type {
  ProviderSupportRequestPayload,
  ProviderSupportTopicOption,
} from "../services/types"

function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function friendlyDbMessage(err: { message?: string }, fallback: string): string {
  const raw = err.message ?? fallback
  if (/row-level security|RLS|permission denied|42501/i.test(raw)) {
    return "Submitting support requests is blocked by database permissions (RLS). Apply provider support ticket policies (0005) on your Supabase project."
  }
  return raw
}

const PROVIDER_SUPPORT_TOPICS: ProviderSupportTopicOption[] = [
  { id: "shift", label: "Shift issue", hint: "Scheduling or coverage disputes" },
  { id: "noshow", label: "Worker no-show", hint: "Immediate escalation options" },
  { id: "payment", label: "Payment question", hint: "Rates, invoices, and payouts" },
  {
    id: "credential",
    label: "Credential / compliance issue",
    hint: "Med pass, training, or documentation",
  },
  { id: "safety", label: "Safety or incident report", hint: "Workplace safety and serious events" },
]

function subjectForTopic(topicId: string): string {
  const topic = PROVIDER_SUPPORT_TOPICS.find(t => t.id === topicId)
  return topic?.label ?? "Provider support request"
}

type ProviderMembership = {
  providerId: string
}

async function loadProviderMembership(): Promise<ApiResult<ProviderMembership | null>> {
  const supabase = getSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return fail("not_authenticated", "Sign in with Supabase before contacting support.")
  }

  const { data: rows, error } = await supabase
    .from("provider_members")
    .select("provider_id")
    .eq("user_id", session.user.id)
    .limit(1)

  if (error) {
    return fail(
      "provider_membership_load",
      friendlyDbMessage(error, "Unable to load provider membership."),
    )
  }

  const row = rows?.[0] as { provider_id: string } | undefined
  if (!row?.provider_id) {
    return ok(null)
  }

  return ok({ providerId: row.provider_id })
}

export async function listProviderSupportTopicsFromSupabase(): Promise<
  ApiResult<ProviderSupportTopicOption[]>
> {
  return ok([...PROVIDER_SUPPORT_TOPICS])
}

export async function submitProviderSupportRequestToSupabase(
  payload: ProviderSupportRequestPayload,
): Promise<ApiResult<{ id: string; status: "queued" }>> {
  try {
    const message = payload.message?.trim()
    if (!message) {
      return fail("validation", "Tell us what happened.")
    }
    if (!payload.topicId?.trim()) {
      return fail("validation", "Choose a topic.")
    }

    const membershipResult = await loadProviderMembership()
    if (!membershipResult.ok) {
      return membershipResult
    }
    if (!membershipResult.data) {
      return fail("provider_setup_required", "Complete facility setup before contacting support.")
    }

    const supabase = getSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      return fail("not_authenticated", "Sign in with Supabase before contacting support.")
    }

    const { data: row, error } = await supabase
      .from("support_tickets")
      .insert({
        requester_user_id: session.user.id,
        requester_type: "provider",
        ticket_type: payload.topicId.trim(),
        subject: subjectForTopic(payload.topicId),
        description: message,
        priority: "normal",
        status: "open",
      })
      .select("id, status")
      .single()

    if (error) {
      return fail(
        "support_ticket_insert",
        friendlyDbMessage(error, "Unable to submit support request."),
      )
    }

    const id = (row as { id: string; status: string } | null)?.id
    if (!id) {
      return fail("support_ticket_insert", "Support request was not saved.")
    }

    return ok({ id, status: "queued" })
  } catch (e) {
    const errMessage = e instanceof Error ? e.message : "Request failed."
    return fail("unexpected", errMessage)
  }
}
