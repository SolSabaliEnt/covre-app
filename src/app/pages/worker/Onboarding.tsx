import { Link, useNavigate } from 'react-router';
import { CheckCircle2, Circle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import {
  completeWorkerProfileOnboarding,
  getCurrentWorkerProfile,
  saveCurrentWorkerProfile,
} from '../../services';
import type { WorkerProfileDraft } from '../../services/types';

const roles = [
  'Caregiver',
  'DSP',
  'CNA',
  'Medication Aide',
  'LPN',
  'RN',
  'Behavioral Health Tech',
  'Home Health Aide',
  'Personal Care Aide',
];

const experienceLevels = ['New to care', '1–2 years', '3–5 years', '5+ years'];

function MockOnboarding() {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role],
    );
  };

  return (
    <div className="flex min-h-[100svh] flex-col w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))] text-[#10283D]">
      <header className="mb-6">
        <div className="mb-2 text-sm text-[#607583]">Step 1 of 6</div>
        <h1 className="text-2xl font-semibold text-[#13334F]">Select your roles</h1>
        <p className="mt-1 text-sm text-[#607583]">Choose all that apply</p>
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#EEF4F5]"
          role="progressbar"
          aria-valuenow={16.67}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-[#53B59F]" style={{ width: '16.67%' }} />
        </div>
      </header>

      <div className="space-y-3 pb-2">
        {roles.map(role => (
          <button
            key={role}
            type="button"
            onClick={() => toggleRole(role)}
            className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-all ${
              selectedRoles.includes(role)
                ? 'border-[#53B59F] bg-[#F3FBF8]'
                : 'border-[#DDE7E8] bg-white'
            }`}
          >
            <span
              className={`min-w-0 font-medium ${
                selectedRoles.includes(role) ? 'text-[#13334F]' : 'text-[#607583]'
              }`}
            >
              {role}
            </span>
            {selectedRoles.includes(role) ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#53B59F]" aria-hidden />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-[#9AAAB3]" aria-hidden />
            )}
          </button>
        ))}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-auto bg-[#F7FAFA]/95 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        <Link
          to="/worker/credentials"
          className={`flex min-h-14 w-full items-center justify-center rounded-xl px-6 py-4 font-medium transition-colors ${
            selectedRoles.length > 0
              ? 'bg-[#53B59F] text-white hover:bg-[#2F8E7A]'
              : 'pointer-events-none bg-[#EEF4F5] text-[#9AAAB3]'
          }`}
          aria-disabled={selectedRoles.length === 0}
          onClick={e => {
            if (selectedRoles.length === 0) e.preventDefault();
          }}
        >
          Continue
        </Link>
      </div>
    </div>
  );
}

function SupabaseOnboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState('');
  const [availability, setAvailability] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getCurrentWorkerProfile();
      if (cancelled) return;
      if (res.ok) {
        setFullName(res.data.fullName);
        setPhone(res.data.phone ?? '');
        setCity(res.data.city ?? '');
        setState(res.data.state ?? '');
        setSelectedRoles(res.data.roles ?? []);
        setExperienceLevel(res.data.experienceLevel ?? '');
        if (res.data.onboardingComplete) {
          navigate('/worker/shifts', { replace: true });
          return;
        }
      } else if (res.error.code !== 'not_authenticated') {
        toast.error(res.error.message);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role],
    );
  };

  const buildDraft = (): WorkerProfileDraft => ({
    fullName,
    phone: phone.trim() || undefined,
    city: city.trim() || undefined,
    state: state.trim() || undefined,
    roles: selectedRoles,
    experienceLevel: experienceLevel || undefined,
    availability: availability.trim() || undefined,
  });

  const handleSave = async () => {
    setSubmitting(true);
    const res = await saveCurrentWorkerProfile(buildDraft());
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(res.data.message);
  };

  const handleComplete = async () => {
    if (!fullName.trim()) {
      toast.error('Full name is required.');
      return;
    }
    if (selectedRoles.length === 0) {
      toast.error('Select at least one role you are interested in.');
      return;
    }
    setSubmitting(true);
    const res = await completeWorkerProfileOnboarding(buildDraft());
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(res.data.message);
    navigate('/worker/shifts', { replace: true });
  };

  if (loading) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-[#F7FAFA] px-4 text-sm text-[#607583]">
        Loading profile…
      </div>
    );
  }

  return (
    <div className="flex min-h-[100svh] flex-col w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))] text-[#10283D]">
      <header className="mb-6">
        <p className="mb-2 text-sm text-[#607583]">Worker setup</p>
        <h1 className="text-2xl font-semibold text-[#13334F]">Your profile</h1>
        <p className="mt-1 text-sm text-[#607583]">
          Tell facilities who you are before you apply for shifts. Credentials and shift discovery
          come next.
        </p>
      </header>

      <form
        className="space-y-5 pb-28"
        onSubmit={e => {
          e.preventDefault();
          void handleComplete();
        }}
        noValidate
      >
        <div className="space-y-2">
          <label htmlFor="worker-full-name" className="text-sm font-medium text-[#13334F]">
            Full name
          </label>
          <input
            id="worker-full-name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            disabled={submitting}
            className="min-h-12 w-full rounded-xl border border-[#DDE7E8] bg-white px-4 text-[#13334F]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="worker-phone" className="text-sm font-medium text-[#13334F]">
            Phone
          </label>
          <input
            id="worker-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            disabled={submitting}
            className="min-h-12 w-full rounded-xl border border-[#DDE7E8] bg-white px-4 text-[#13334F]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label htmlFor="worker-city" className="text-sm font-medium text-[#13334F]">
              City
            </label>
            <input
              id="worker-city"
              type="text"
              autoComplete="address-level2"
              value={city}
              onChange={e => setCity(e.target.value)}
              disabled={submitting}
              className="min-h-12 w-full rounded-xl border border-[#DDE7E8] bg-white px-4 text-[#13334F]"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="worker-state" className="text-sm font-medium text-[#13334F]">
              State
            </label>
            <input
              id="worker-state"
              type="text"
              autoComplete="address-level1"
              value={state}
              onChange={e => setState(e.target.value)}
              disabled={submitting}
              className="min-h-12 w-full rounded-xl border border-[#DDE7E8] bg-white px-4 text-[#13334F]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-[#13334F]">Role interest</p>
          <p className="text-xs text-[#607583]">Choose all that apply</p>
          <div className="space-y-2">
            {roles.map(role => (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(role)}
                disabled={submitting}
                className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left ${
                  selectedRoles.includes(role)
                    ? 'border-[#53B59F] bg-[#F3FBF8]'
                    : 'border-[#DDE7E8] bg-white'
                }`}
              >
                <span className="font-medium text-[#13334F]">{role}</span>
                {selectedRoles.includes(role) ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#53B59F]" aria-hidden />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-[#9AAAB3]" aria-hidden />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="worker-experience" className="text-sm font-medium text-[#13334F]">
            Experience level
          </label>
          <select
            id="worker-experience"
            value={experienceLevel}
            onChange={e => setExperienceLevel(e.target.value)}
            disabled={submitting}
            className="min-h-12 w-full rounded-xl border border-[#DDE7E8] bg-white px-4 text-[#13334F]"
          >
            <option value="">Select…</option>
            {experienceLevels.map(level => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="worker-availability" className="text-sm font-medium text-[#13334F]">
            Availability <span className="font-normal text-[#9AAAB3]">(optional)</span>
          </label>
          <input
            id="worker-availability"
            type="text"
            placeholder="e.g. Weekdays, overnights"
            value={availability}
            onChange={e => setAvailability(e.target.value)}
            disabled={submitting}
            className="min-h-12 w-full rounded-xl border border-[#DDE7E8] bg-white px-4 text-[#13334F]"
          />
          <p className="text-xs text-[#9AAAB3]">
            Availability is stored on your account for now; scheduling rules come in a later release.
          </p>
        </div>
      </form>

      <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-2 bg-[#F7FAFA]/95 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleSave()}
          className="min-h-12 w-full rounded-xl border border-[#DDE7E8] bg-white px-6 py-3 font-medium text-[#13334F] hover:border-[#53B59F]"
        >
          Save draft
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleComplete()}
          className="min-h-14 w-full rounded-xl bg-[#53B59F] px-6 py-4 font-medium text-white hover:bg-[#2F8E7A] disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Complete profile'}
        </button>
      </div>
    </div>
  );
}

export default function Onboarding() {
  if (isSupabaseBackendEnabled()) {
    return <SupabaseOnboarding />;
  }
  return <MockOnboarding />;
}
