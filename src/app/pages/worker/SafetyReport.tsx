import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { submitSafetyReport } from '../../services';

const ISSUE_TYPES = [
  'Unsafe conditions',
  'Unexpected duties',
  'Injury',
  'Harassment',
  'Medication concern',
  'Pay issue',
  'Other',
] as const;

export default function SafetyReport() {
  const [issueType, setIssueType] = useState<(typeof ISSUE_TYPES)[number] | null>(null);
  const [details, setDetails] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueType) {
      toast.error('Select an issue type');
      return;
    }
    setSubmitting(true);
    const result = await submitSafetyReport({
      issueType: issueType as string,
      details,
      urgent,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(result.data.message);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-[100svh] w-full max-w-full bg-[#F7FAFA] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 text-[#10283D]">
        <header className="mb-6">
          <Link
            to="/worker/active-shift"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to active shift
          </Link>
          <h1 className="text-2xl font-semibold text-[#13334F]">Report received</h1>
          <p className="mt-2 text-[#607583]">
            Thanks — Covre has recorded your safety report{urgent ? ' and flagged it for urgent follow-up' : ''}.
          </p>
        </header>
        <Link
          to="/worker/active-shift"
          className="inline-flex w-full items-center justify-center rounded-xl bg-[#53B59F] px-6 py-4 font-medium text-white transition-colors hover:bg-[#2F8E7A] sm:w-auto"
        >
          Return to active shift
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 text-[#10283D]">
      <header className="mb-6">
        <Link
          to="/worker/active-shift"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to active shift
        </Link>
        <h1 className="text-2xl font-semibold text-[#13334F]">Report a safety issue</h1>
        <p className="mt-2 text-[#607583]">
          Tell Covre what happened so we can help protect you and document the shift.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="space-y-2">
          <legend className="sr-only">Issue type</legend>
          <p id="issue-type-label" className="text-sm font-medium text-[#13334F]">
            Issue type
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="group" aria-labelledby="issue-type-label">
            {ISSUE_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setIssueType(type)}
                className={`rounded-2xl border-2 px-4 py-4 text-left text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] ${
                  issueType === type
                    ? 'border-[#53B59F] bg-white text-[#13334F] shadow-sm'
                    : 'border-[#DDE7E8] bg-white text-[#607583] hover:border-[#B8C6CC]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="safety-details" className="text-sm font-medium text-[#13334F]">
            Details
          </label>
          <textarea
            id="safety-details"
            value={details}
            onChange={e => setDetails(e.target.value)}
            rows={5}
            placeholder="What happened? Include times, people involved, and anything we should know."
            className="mt-2 w-full max-w-full rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-[#10283D] placeholder:text-[#9AAAB3] focus:border-[#53B59F] focus:outline-none focus:ring-2 focus:ring-[#53B59F]/30"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#DDE7E8] bg-white p-4">
          <input
            type="checkbox"
            checked={urgent}
            onChange={e => setUrgent(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-[#DDE7E8] text-[#53B59F] focus:ring-[#53B59F]"
          />
          <span className="text-sm text-[#13334F]">
            I need Covre support to contact me urgently.
          </span>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-[#13334F] px-6 py-4 font-medium text-white transition-colors hover:bg-[#0B243A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#13334F] disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit report'}
        </button>
      </form>
    </div>
  );
}
