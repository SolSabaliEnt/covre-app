import { useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CalendarX,
  CreditCard,
  ShieldAlert,
  Stethoscope,
  MessageSquareText,
} from 'lucide-react';
import { toast } from 'sonner';

import { listProviderSupportOptions, submitProviderSupportRequest } from '../../services';
import type { ProviderSupportTopicOption } from '../../services/types';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';

const TOPIC_ICONS: Record<ProviderSupportTopicOption['id'], typeof CalendarX> = {
  shift: CalendarX,
  noshow: AlertTriangle,
  payment: CreditCard,
  credential: ShieldAlert,
  safety: Stethoscope,
};

export default function Support() {
  const { data: options, error, loading, reload } = useAsyncResource(() => listProviderSupportOptions(), []);
  const topics = useMemo(
    () =>
      (options ?? []).map(o => ({
        ...o,
        icon: TOPIC_ICONS[o.id] ?? MessageSquareText,
        accent:
          o.id === 'noshow'
            ? 'text-[#A93636]'
            : o.id === 'credential'
              ? 'text-[#9B6419]'
              : 'text-[#257665]',
      })),
    [options],
  );

  const [topicId, setTopicId] = useState<(typeof topics)[number]['id'] | null>(null);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const supabaseMode = isSupabaseBackendEnabled();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Tell us what happened');
      return;
    }
    if (!topicId) {
      toast.error('Choose a topic');
      return;
    }
    setSubmitting(true);
    const result = await submitProviderSupportRequest({ topicId, message: message.trim() });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success('Support request submitted');
    setSubmittedTicketId(result.data.id);
    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6 pb-8">
        <div className="mx-auto w-full min-w-0 max-w-full rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
          <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6 pb-8">
        <div className="mx-auto w-full min-w-0 max-w-full rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
          <p className="text-center text-sm text-[#607583]">{error.message}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0B243A]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6 pb-8">
        <div className="mx-auto w-full min-w-0 max-w-full space-y-4">
          <div className="rounded-2xl border border-[#DDE7E8] bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#E6F6F2] text-[#257665]">
              <MessageSquareText className="h-6 w-6" aria-hidden />
            </div>
            <h1 className="text-xl font-semibold text-[#13334F]">We received your request</h1>
            <p className="mt-2 text-sm text-[#607583]">
              {supabaseMode
                ? 'Your request is queued in Covre. The team will follow up using your account contact. No email or chat automation runs in this pass.'
                : 'The Covre team will follow up using your account contact.'}
            </p>
            {submittedTicketId && (
              <p className="mt-2 text-xs text-[#9AAAB3]">
                Reference: {supabaseMode ? submittedTicketId : `case ${submittedTicketId}`}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setSubmittedTicketId(null);
                setMessage('');
                setTopicId(null);
              }}
              className="mt-6 w-full rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm font-medium text-[#13334F] transition-colors hover:bg-[#F7FAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
            >
              Submit another request
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6 pb-8">
      <div className="mx-auto w-full min-w-0 max-w-full space-y-6">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-[#13334F]">Support</h1>
          <p className="mt-1 text-sm text-[#607583]">
            Get help with shifts, workers, payments, and compliance.
          </p>
          {supabaseMode && (
            <p className="mt-3 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm leading-relaxed text-[#607583]">
              Support requests are saved to your facility account when database policies (0005) are
              applied. Admin triage remains mock-only until admin Supabase is wired.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#607583]">What do you need?</p>
            {topics.map(({ id, label, hint, icon: Icon, accent }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTopicId(id)}
                className={`flex w-full max-w-full items-center gap-3 overflow-hidden rounded-xl border bg-white p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] ${
                  topicId === id
                    ? 'border-[#53B59F] shadow-sm ring-1 ring-[#53B59F]/20'
                    : 'border-[#DDE7E8] hover:border-[#53B59F]/40'
                }`}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#F7FAFA] ${accent}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[#13334F]">{label}</div>
                  <div className="text-sm text-[#607583]">{hint}</div>
                </div>
                {topicId === id && (
                  <span className="shrink-0 text-xs font-medium text-[#53B59F]">Selected</span>
                )}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="support-details" className="mb-2 block text-sm font-medium text-[#13334F]">
              Tell us what happened
            </label>
            <textarea
              id="support-details"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              placeholder="Include dates, times, worker names, or ticket numbers if you have them."
              className="w-full min-w-0 max-w-full resize-y rounded-xl border border-[#DDE7E8] bg-white px-3 py-2.5 text-sm text-[#10283D] placeholder:text-[#9AAAB3] focus:border-[#53B59F] focus:outline-none focus:ring-2 focus:ring-[#53B59F]/25"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#53B59F] px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#13334F] disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit Support Request'}
          </button>
        </form>
      </div>
    </div>
  );
}
