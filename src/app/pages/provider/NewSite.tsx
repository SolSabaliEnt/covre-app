import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ChevronLeft } from 'lucide-react';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import { createProviderSite, getCurrentProviderOrganization } from '../../services';

const SITE_TYPES = [
  'Group Home',
  'Memory Care',
  'Assisted Living',
  'Skilled Nursing',
  'Residential Care',
  'Home Care',
] as const;

type FieldErrors = {
  siteName?: string;
  siteType?: string;
};

function validateForm(siteName: string, siteType: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!siteName.trim()) {
    errors.siteName = 'Please add a site name before continuing.';
  }
  if (!siteType.trim()) {
    errors.siteType = 'Please select a site type.';
  }
  return errors;
}

export default function ProviderNewSite() {
  const navigate = useNavigate();
  const siteNameRef = useRef<HTMLInputElement>(null);
  const [siteName, setSiteName] = useState('');
  const [siteType, setSiteType] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [residentCount, setResidentCount] = useState('');
  const [primaryContact, setPrimaryContact] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [orientationNotes, setOrientationNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [orgReady, setOrgReady] = useState<boolean | null>(
    isSupabaseBackendEnabled() ? null : true,
  );

  useEffect(() => {
    if (!isSupabaseBackendEnabled()) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await getCurrentProviderOrganization();
      if (cancelled) return;
      setOrgReady(res.ok && Boolean(res.data?.providerId));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const leavePage = useCallback(() => {
    const fallback = orgReady === false ? '/provider' : '/provider/sites';
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallback, { replace: true });
  }, [navigate, orgReady]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errors = validateForm(siteName, siteType);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstMessage = errors.siteName ?? errors.siteType;
      if (firstMessage) toast.error(firstMessage);
      if (errors.siteName) {
        siteNameRef.current?.focus();
        siteNameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setFieldErrors({});

    if (orgReady === false) {
      toast.error('Finish workspace setup before adding a care site.');
      return;
    }

    setSaving(true);
    const res = await createProviderSite({
      siteName,
      siteType,
      address,
      city,
      state,
      residentCount,
      primaryContact,
      contactPhone,
      orientationNotes,
    });
    setSaving(false);
    if (!res.ok) {
      if (res.error.code === 'no_provider_membership') {
        toast.error('Finish workspace setup before adding a care site.');
      } else {
        toast.error(res.error.message);
      }
      return;
    }
    toast.success('Care site saved');
    navigate('/provider/sites', { replace: true });
  };

  if (orgReady === null) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#F7FAFA] px-4 py-12 text-sm text-[#607583]">
        Loading workspace…
      </div>
    );
  }

  return (
    <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-6">
      <div className="mx-auto w-full min-w-0 max-w-lg space-y-6">
        <div className="min-w-0">
          <button
            type="button"
            onClick={leavePage}
            className="mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 py-2 text-sm font-medium text-[#53B59F] transition-colors hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            {orgReady === false ? 'Back to dashboard' : 'Back to sites'}
          </button>
          <h1 className="break-words text-2xl font-semibold text-[#13334F]">Add care site</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#607583]">
            Create another site, facility, or home under your provider organization.
          </p>
        </div>

        {orgReady === false ? (
          <div className="rounded-xl border border-[#F4A83D] bg-[#FFF4E0] p-4">
            <p className="text-sm font-medium text-[#9B6419]">Workspace setup required</p>
            <p className="mt-1 text-sm text-[#9B6419]">
              Finish provider workspace setup before adding a care site.
            </p>
            <Link
              to="/provider/onboarding"
              className="mt-3 inline-flex rounded-lg bg-[#13334F] px-4 py-2 text-sm font-medium text-white no-underline hover:bg-[#0B243A]"
            >
              Continue setup
            </Link>
          </div>
        ) : null}

        <form
          noValidate
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-[#DDE7E8] bg-white p-4 shadow-sm sm:p-6"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Site name</span>
            <input
              ref={siteNameRef}
              type="text"
              value={siteName}
              onChange={e => {
                setSiteName(e.target.value);
                if (fieldErrors.siteName) {
                  setFieldErrors(prev => ({ ...prev, siteName: undefined }));
                }
              }}
              aria-invalid={Boolean(fieldErrors.siteName)}
              className={`min-h-11 w-full min-w-0 rounded-lg border bg-[#F7FAFA] px-3 py-2.5 text-[#13334F] ${
                fieldErrors.siteName ? 'border-[#D94A4A]' : 'border-[#DDE7E8]'
              }`}
            />
            {fieldErrors.siteName ? (
              <p className="mt-1.5 text-sm text-[#D94A4A]" role="alert">
                {fieldErrors.siteName}
              </p>
            ) : null}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Site type</span>
            <select
              value={siteType}
              onChange={e => {
                setSiteType(e.target.value);
                if (fieldErrors.siteType) {
                  setFieldErrors(prev => ({ ...prev, siteType: undefined }));
                }
              }}
              aria-invalid={Boolean(fieldErrors.siteType)}
              className={`min-h-11 w-full min-w-0 rounded-lg border bg-[#F7FAFA] px-3 py-2.5 text-[#13334F] ${
                fieldErrors.siteType ? 'border-[#D94A4A]' : 'border-[#DDE7E8]'
              }`}
            >
              <option value="">Select type</option>
              {SITE_TYPES.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {fieldErrors.siteType ? (
              <p className="mt-1.5 text-sm text-[#D94A4A]" role="alert">
                {fieldErrors.siteType}
              </p>
            ) : null}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Address</span>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
            />
          </label>
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="mb-1.5 block text-sm font-medium text-[#13334F]">City</span>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1.5 block text-sm font-medium text-[#13334F]">State</span>
              <input
                type="text"
                value={state}
                onChange={e => setState(e.target.value)}
                className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
                maxLength={2}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Resident count</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={residentCount}
              onChange={e => setResidentCount(e.target.value)}
              className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Primary contact</span>
            <input
              type="text"
              value={primaryContact}
              onChange={e => setPrimaryContact(e.target.value)}
              className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Contact phone</span>
            <input
              type="tel"
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#13334F]">Orientation notes</span>
            <textarea
              rows={3}
              value={orientationNotes}
              onChange={e => setOrientationNotes(e.target.value)}
              className="w-full min-w-0 resize-none rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-2.5 text-[#13334F]"
            />
          </label>

          <div className="mt-2 flex min-w-0 flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={leavePage}
              disabled={saving}
              className="order-2 flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm font-semibold text-[#13334F] transition-colors hover:bg-[#F7FAFA] disabled:opacity-60 sm:order-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || orgReady === false}
              className="order-1 flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#13334F] disabled:opacity-60 sm:order-2"
            >
              {saving ? 'Saving…' : 'Save Site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
