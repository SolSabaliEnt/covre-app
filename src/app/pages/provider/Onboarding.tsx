import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import {
  completeProviderOnboarding,
  getCurrentProviderOrganization,
  getProviderOnboardingStatus,
  saveProviderOnboardingDraft,
} from '../../services';
import type { ProviderOnboardingDraft, ProviderOnboardingStep } from '../../services';

const ORGANIZATION_TYPES = [
  'Group Home / Residential Care',
  'Assisted Living',
  'Memory Care',
  'Skilled Nursing',
  'Home Care Agency',
  'Hospital / Large Facility',
] as const;

const SITE_TYPES = [
  'Group Home',
  'Memory Care',
  'Assisted Living',
  'Skilled Nursing',
  'Residential Care',
  'Home Care',
] as const;

const ROLE_OPTIONS = ['DSP', 'CNA', 'Medication Aide', 'LPN', 'RN', 'Caregiver'] as const;

const SHIFT_TYPE_OPTIONS = ['AM', 'PM', 'Overnight', 'Weekend', 'On-call / urgent coverage'] as const;

const STEP_LABELS = ['Organization', 'First site', 'Staffing', 'Billing', 'Review'] as const;

function stepIndexFromSuggested(suggested: ProviderOnboardingStep): number {
  switch (suggested) {
    case 'organization':
      return 0;
    case 'site':
      return 1;
    case 'staffing':
      return 2;
    case 'billing':
      return 3;
    case 'complete':
      return 4;
    default:
      return 0;
  }
}

function validateStepFields(stepIndex: number, draft: ProviderOnboardingDraft): string | null {
  if (stepIndex === 0) {
    if (!draft.organizationName?.trim()) return 'Organization name is required.';
    if (!draft.organizationType?.trim()) return 'Organization type is required.';
    if (!draft.contactName?.trim()) return 'Primary contact name is required.';
    if (!draft.contactEmail?.trim()) return 'Contact email is required.';
    if (!draft.contactPhone?.trim()) return 'Contact phone is required.';
  }
  if (stepIndex === 1) {
    if (!draft.siteName?.trim()) return 'Site name is required.';
  }
  return null;
}

export default function ProviderOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProviderOnboardingDraft>({
    rolesNeeded: [],
    shiftTypes: [],
  });
  /** True only immediately after completing setup in this session (not on revisit). */
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);
  const [loading, setLoading] = useState(isSupabaseBackendEnabled());
  const [submitting, setSubmitting] = useState(false);

  const update = useCallback((patch: Partial<ProviderOnboardingDraft>) => {
    setDraft(prev => ({ ...prev, ...patch }));
  }, []);

  const toggleInList = useCallback(
    (key: 'rolesNeeded' | 'shiftTypes', value: string) => {
      setDraft(prev => {
        const cur = new Set(prev[key] ?? []);
        if (cur.has(value)) cur.delete(value);
        else cur.add(value);
        return { ...prev, [key]: [...cur] };
      });
    },
    [],
  );

  useEffect(() => {
    if (!isSupabaseBackendEnabled()) {
      let cancelled = false;
      void (async () => {
        const statusRes = await getProviderOnboardingStatus();
        if (cancelled) return;
        if (statusRes.ok && statusRes.data.onboardingComplete && !showCompletionScreen) {
          navigate('/provider', { replace: true });
          return;
        }
        if (statusRes.ok && !statusRes.data.onboardingComplete) {
          setDraft(prev => ({ ...prev, ...statusRes.data.lastDraft }));
        }
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }
    let cancelled = false;
    (async () => {
      const [statusRes, orgRes] = await Promise.all([
        getProviderOnboardingStatus(),
        getCurrentProviderOrganization(),
      ]);
      if (cancelled) return;

      if (statusRes.ok) {
        if (statusRes.data.onboardingComplete && !showCompletionScreen) {
          navigate('/provider', { replace: true });
          return;
        }
        if (!statusRes.data.onboardingComplete) {
          setDraft(prev => ({ ...prev, ...statusRes.data.lastDraft }));
          setStep(stepIndexFromSuggested(statusRes.data.suggestedStep));
        }
      } else if (statusRes.error.code !== 'not_authenticated') {
        toast.error(statusRes.error.message);
      }

      if (orgRes.ok && orgRes.data) {
        setDraft(prev => ({
          ...prev,
          organizationName: prev.organizationName?.trim() || orgRes.data!.organizationName,
          organizationType: prev.organizationType?.trim() || orgRes.data!.organizationType,
        }));
      } else if (!orgRes.ok && orgRes.error.code !== 'not_authenticated') {
        toast.error(orgRes.error.message);
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, showCompletionScreen]);

  const persistDraft = useCallback(async (): Promise<boolean> => {
    const res = await saveProviderOnboardingDraft(draft);
    if (!res.ok) {
      toast.error(res.error.message);
      return false;
    }
    return true;
  }, [draft]);

  const goNext = async () => {
    const validationMessage = validateStepFields(step, draft);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    setSubmitting(true);
    const saved = await persistDraft();
    setSubmitting(false);
    if (!saved) return;
    setStep(s => Math.min(s + 1, STEP_LABELS.length - 1));
  };

  const goBack = () => {
    setStep(s => Math.max(s - 1, 0));
  };

  const handleComplete = async () => {
    if (!draft.organizationName?.trim()) {
      toast.error('Organization name is required.');
      return;
    }
    if (!draft.siteName?.trim()) {
      toast.error('Site name is required.');
      return;
    }
    if (!draft.rolesNeeded?.length) {
      toast.error('Select at least one role you need covered.');
      return;
    }
    setSubmitting(true);
    const res = await completeProviderOnboarding(draft);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(res.data.message);
    setShowCompletionScreen(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#F7FAFA] px-4 py-12 text-sm text-[#607583]">
        Loading workspace setup…
      </div>
    );
  }

  if (showCompletionScreen) {
    return (
      <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-6">
        <div className="mx-auto w-full min-w-0 max-w-lg space-y-6">
          <div className="min-w-0 rounded-2xl border border-[#DDE7E8] bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-[#13334F]">You&apos;re set up</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#607583]">
              Your provider workspace is ready. Add more sites anytime or post your first shift.
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <Link
              to="/provider"
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#53B59F] px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#13334F] no-underline"
            >
              Go to Dashboard
            </Link>
            <Link
              to="/provider/sites"
              className="flex min-h-12 w-full items-center justify-center rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-center text-sm font-semibold text-[#13334F] shadow-sm transition-colors hover:border-[#53B59F]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] no-underline"
            >
              View care sites
            </Link>
            <Link
              to="/provider/team"
              className="flex min-h-12 w-full items-center justify-center rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-center text-sm font-semibold text-[#13334F] shadow-sm transition-colors hover:border-[#53B59F]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] no-underline"
            >
              Invite Team
            </Link>
            <Link
              to="/provider/sites/new"
              className="flex min-h-12 w-full items-center justify-center rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-center text-sm font-semibold text-[#13334F] shadow-sm transition-colors hover:border-[#53B59F]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] no-underline"
            >
              Add another Site
            </Link>
            <Link
              to="/provider/post-shift"
              className="flex min-h-12 w-full items-center justify-center rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-center text-sm font-semibold text-[#13334F] shadow-sm transition-colors hover:border-[#53B59F]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] no-underline"
            >
              Post First Shift
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-6">
      <div className="mx-auto w-full min-w-0 max-w-lg space-y-6">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[#53B59F]">
            Step {step + 1} of {STEP_LABELS.length}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E8EEF2]">
            <div
              className="h-full rounded-full bg-[#53B59F] transition-[width] duration-200"
              style={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }}
            />
          </div>
          <h1 className="mt-4 break-words text-2xl font-semibold text-[#13334F]">
            Set up your provider workspace
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#607583]">
            Add your organization, first care site, and staffing needs so Covre can help fill shifts.
          </p>
        </div>

        <div className="rounded-2xl border border-[#DDE7E8] bg-white p-4 shadow-sm sm:p-6">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[#13334F]">Organization</h2>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Organization name</span>
                <input
                  type="text"
                  value={draft.organizationName ?? ''}
                  onChange={e => update({ organizationName: e.target.value })}
                  className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
                  placeholder="e.g. your organization name"
                  autoComplete="organization"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Organization type</span>
                <select
                  value={draft.organizationType ?? ''}
                  onChange={e => update({ organizationType: e.target.value })}
                  className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
                >
                  <option value="">Select type</option>
                  {ORGANIZATION_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Primary contact name</span>
                <input
                  type="text"
                  value={draft.contactName ?? ''}
                  onChange={e => update({ contactName: e.target.value })}
                  className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
                  autoComplete="name"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Contact email</span>
                <input
                  type="email"
                  value={draft.contactEmail ?? ''}
                  onChange={e => update({ contactEmail: e.target.value })}
                  className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
                  autoComplete="email"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Contact phone</span>
                <input
                  type="tel"
                  value={draft.contactPhone ?? ''}
                  onChange={e => update({ contactPhone: e.target.value })}
                  className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
                  autoComplete="tel"
                />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[#13334F]">First care site</h2>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Site name</span>
                <input
                  type="text"
                  value={draft.siteName ?? ''}
                  onChange={e => update({ siteName: e.target.value })}
                  className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
                  placeholder="e.g. Oak Memory Care"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Site type</span>
                <select
                  value={draft.siteType ?? ''}
                  onChange={e => update({ siteType: e.target.value })}
                  className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
                >
                  <option value="">Select type</option>
                  {SITE_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Address</span>
                <input
                  type="text"
                  value={draft.siteAddress ?? ''}
                  onChange={e => update({ siteAddress: e.target.value })}
                  className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
                  autoComplete="street-address"
                />
              </label>
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-sm font-medium text-[#13334F]">City</span>
                  <input
                    type="text"
                    value={draft.city ?? ''}
                    onChange={e => update({ city: e.target.value })}
                    className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
                    autoComplete="address-level2"
                  />
                </label>
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-sm font-medium text-[#13334F]">State</span>
                  <input
                    type="text"
                    value={draft.state ?? ''}
                    onChange={e => update({ state: e.target.value })}
                    className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
                    autoComplete="address-level1"
                    maxLength={2}
                    placeholder="OR"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Resident count</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={draft.residentCount ?? ''}
                  onChange={e => update({ residentCount: e.target.value })}
                  className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
                />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-[#13334F]">Staffing needs</h2>
              <div>
                <p className="mb-2 text-sm font-medium text-[#13334F]">Roles needed</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ROLE_OPTIONS.map(role => {
                    const checked = draft.rolesNeeded?.includes(role) ?? false;
                    return (
                      <label
                        key={role}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 hover:bg-[#EEF4F5]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleInList('rolesNeeded', role)}
                          className="h-4 w-4 shrink-0 text-[#53B59F]"
                        />
                        <span className="text-sm text-[#13334F]">{role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-[#13334F]">Shift types</p>
                <div className="grid grid-cols-1 gap-2">
                  {SHIFT_TYPE_OPTIONS.map(label => {
                    const checked = draft.shiftTypes?.includes(label) ?? false;
                    return (
                      <label
                        key={label}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 hover:bg-[#EEF4F5]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleInList('shiftTypes', label)}
                          className="h-4 w-4 shrink-0 text-[#53B59F]"
                        />
                        <span className="text-sm text-[#13334F]">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[#13334F]">Billing</h2>
              <p className="text-sm text-[#607583]">
                Billing setup can be completed later from Settings.
              </p>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Billing email</span>
                <input
                  type="email"
                  value={draft.billingEmail ?? ''}
                  onChange={e => update({ billingEmail: e.target.value })}
                  className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
                  autoComplete="email"
                />
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[#13334F]">Review</h2>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="font-medium text-[#607583]">Organization</dt>
                  <dd className="text-[#13334F]">{draft.organizationName || '—'}</dd>
                  <dd className="text-[#607583]">{draft.organizationType || ''}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[#607583]">Contact</dt>
                  <dd className="text-[#13334F]">
                    {[draft.contactName, draft.contactEmail, draft.contactPhone].filter(Boolean).join(' · ') || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-[#607583]">Site</dt>
                  <dd className="text-[#13334F]">{draft.siteName || '—'}</dd>
                  <dd className="text-[#607583]">
                    {[draft.siteType, draft.siteAddress, draft.city, draft.state].filter(Boolean).join(', ') || ''}
                  </dd>
                  <dd className="text-[#607583]">
                    {draft.residentCount ? `${draft.residentCount} residents` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-[#607583]">Roles needed</dt>
                  <dd className="text-[#13334F]">{(draft.rolesNeeded ?? []).join(', ') || '—'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[#607583]">Shift types</dt>
                  <dd className="text-[#13334F]">{(draft.shiftTypes ?? []).join(', ') || '—'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[#607583]">Billing email</dt>
                  <dd className="text-[#13334F]">{draft.billingEmail || '—'}</dd>
                </div>
              </dl>
            </div>
          )}

          <div className="mt-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0}
              className="order-2 flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm font-semibold text-[#13334F] transition-colors hover:bg-[#F7FAFA] disabled:pointer-events-none disabled:opacity-40 sm:order-1 sm:max-w-[11rem]"
            >
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back
            </button>
            {step < STEP_LABELS.length - 1 ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void goNext()}
                className="order-1 flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2F8E7A] disabled:opacity-60 sm:order-2 sm:ml-auto sm:max-w-[11rem]"
              >
                {submitting ? 'Saving…' : 'Next'}
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleComplete()}
                className="order-1 flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2F8E7A] disabled:opacity-60 sm:order-2 sm:ml-auto sm:max-w-[14rem]"
              >
                {submitting ? 'Saving…' : 'Complete Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
