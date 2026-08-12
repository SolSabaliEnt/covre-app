import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Building2, Calendar, ChevronRight, DollarSign, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { createProviderShift, listProviderSites } from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';

const ROLES = ['CNA', 'DSP', 'LPN', 'RN', 'Medication Aide', 'Behavioral Health Tech'] as const;

/** Maps PostShift labels to seeded `credentials` ids (see supabase/seed.sql). */
const CREDENTIAL_OPTIONS = [
  { label: 'CNA License', credentialId: '10000000-0000-4000-8000-000000000003' },
  { label: 'CPR/BLS', credentialId: '10000000-0000-4000-8000-000000000001' },
  { label: 'Background Check', credentialId: '10000000-0000-4000-8000-000000000002' },
  { label: 'TB Test', credentialId: '10000000-0000-4000-8000-000000000005' },
  { label: 'Medication Training', credentialId: '10000000-0000-4000-8000-000000000004' },
] as const;

function combineDateAndTime(date: string, time: string): string | null {
  if (!date.trim() || !time.trim()) return null;
  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export default function PostShift() {
  const navigate = useNavigate();
  const { data: careSites, loading, error } = useAsyncResource(() => listProviderSites(), []);

  const [siteId, setSiteId] = useState('');
  const [role, setRole] = useState<string>(ROLES[0]);
  const [shiftDate, setShiftDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [selectedCredentials, setSelectedCredentials] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [posted, setPosted] = useState(false);

  useEffect(() => {
    if (careSites && careSites.length > 0 && !siteId) {
      setSiteId(careSites[0].id);
    }
  }, [careSites, siteId]);

  const hasSites = Boolean(careSites && careSites.length > 0);

  const toggleCredential = (credentialId: string) => {
    setSelectedCredentials(prev => {
      const next = new Set(prev);
      if (next.has(credentialId)) next.delete(credentialId);
      else next.add(credentialId);
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hasSites || !siteId) {
      toast.error('Add a care site before posting a shift.');
      return;
    }
    if (!role.trim()) {
      toast.error('Select a role for this shift.');
      return;
    }

    const startsAt = combineDateAndTime(shiftDate, startTime);
    const endsAt = combineDateAndTime(shiftDate, endTime);
    if (!startsAt || !endsAt) {
      toast.error('Enter a valid date and start/end times.');
      return;
    }

    const rate = Number.parseFloat(hourlyRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      toast.error('Enter a valid provider bill rate.');
      return;
    }

    setSaving(true);
    const res = await createProviderShift({
      siteId,
      title: `${role} shift`,
      role,
      startsAt,
      endsAt,
      hourlyRate: rate,
      requiredCredentialIds:
        selectedCredentials.size > 0 ? [...selectedCredentials] : undefined,
      notes: notes.trim() || undefined,
    });
    setSaving(false);

    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }

    toast.success(res.data.message);
    setPosted(true);
  };

  if (posted) {
    return (
      <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6">
        <div className="mx-auto w-full min-w-0 max-w-lg space-y-6">
          <div className="min-w-0 rounded-2xl border border-[#DDE7E8] bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-[#13334F]">Shift posted</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#607583]">
              Your shift is open for workers. Shift management may still show demo data until the shifts
              list adapter is wired.
            </p>
          </div>
          <Link
            to="/provider/shifts"
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#13334F] no-underline"
          >
            View shifts
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto w-full max-w-full min-w-0 space-y-6">
        <div className="space-y-1">
          <h1 className="break-words text-2xl font-semibold text-[#13334F]">Post a Shift</h1>
          <p className="text-sm text-[#607583]">Find the right worker for your facility</p>
        </div>

        <div className="rounded-xl border border-[#DDE7E8] bg-white p-4 sm:p-6">
          {!loading && !error && careSites && careSites.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-[#607583]">
                You need at least one care site before posting a shift.
              </p>
              <Link
                to="/provider/sites/new"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#53B59F] px-4 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#2F8E7A]"
              >
                Add care site
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="post-shift-site" className="mb-2 block text-sm font-medium text-[#13334F]">
                  <Building2 className="mr-2 inline h-4 w-4" />
                  Select Site
                </label>
                <p className="mb-2 text-xs leading-relaxed text-[#607583]">
                  Shifts are tied to care sites.{' '}
                  <Link
                    to="/provider/sites/new"
                    className="font-medium text-[#53B59F] underline-offset-2 hover:underline"
                  >
                    Add a site
                  </Link>{' '}
                  if yours is not listed.
                </p>
                <select
                  id="post-shift-site"
                  required
                  disabled={loading || saving || !hasSites}
                  value={siteId}
                  onChange={e => setSiteId(e.target.value)}
                  className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-4 py-3 text-[#13334F] disabled:opacity-70"
                >
                  {loading ? (
                    <option value="">Loading sites…</option>
                  ) : error ? (
                    <option value="">Unable to load sites</option>
                  ) : (
                    careSites?.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))
                  )}
                </select>
                {error ? (
                  <p className="mt-2 text-xs text-[#C45C4A]">{error.message}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="post-shift-role" className="mb-2 block text-sm font-medium text-[#13334F]">
                  Select Role
                </label>
                <select
                  id="post-shift-role"
                  required
                  disabled={saving}
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-4 py-3 text-[#13334F]"
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="post-shift-date" className="mb-2 block text-sm font-medium text-[#13334F]">
                    <Calendar className="mr-2 inline h-4 w-4" />
                    Date
                  </label>
                  <input
                    id="post-shift-date"
                    type="date"
                    required
                    disabled={saving}
                    value={shiftDate}
                    onChange={e => setShiftDate(e.target.value)}
                    className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-4 py-3 text-[#13334F]"
                  />
                </div>
                <div className="min-w-0">
                  <span className="mb-2 block text-sm font-medium text-[#13334F]">Time</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="time"
                      required
                      disabled={saving}
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      aria-label="Start time"
                      className="min-h-11 min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-3 text-[#13334F]"
                    />
                    <input
                      type="time"
                      required
                      disabled={saving}
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      aria-label="End time"
                      className="min-h-11 min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-3 text-[#13334F]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="post-shift-rate" className="mb-2 block text-sm font-medium text-[#13334F]">
                  <DollarSign className="mr-2 inline h-4 w-4" />
                  Provider bill rate (per hour)
                </label>
                <p className="mb-2 text-sm text-[#607583]">
                  This is the hourly rate billed to the facility. Worker pay rate is controlled
                  separately before earnings are generated.
                </p>
                <input
                  id="post-shift-rate"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  disabled={saving}
                  value={hourlyRate}
                  onChange={e => setHourlyRate(e.target.value)}
                  placeholder="28.00"
                  className="min-h-11 w-full min-w-0 rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-4 py-3 text-[#13334F]"
                />
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium text-[#13334F]">
                  <Shield className="mr-2 inline h-4 w-4" />
                  Required Credentials
                </span>
                <div className="space-y-2">
                  {CREDENTIAL_OPTIONS.map(({ label, credentialId }) => (
                    <label
                      key={credentialId}
                      className="flex cursor-pointer items-center gap-3 rounded-lg bg-[#F7FAFA] p-3 hover:bg-[#EEF4F5]"
                    >
                      <input
                        type="checkbox"
                        disabled={saving}
                        checked={selectedCredentials.has(credentialId)}
                        onChange={() => toggleCredential(credentialId)}
                        className="h-4 w-4 shrink-0 text-[#53B59F]"
                      />
                      <span className="min-w-0 break-words text-[#13334F]">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="post-shift-notes" className="mb-2 block text-sm font-medium text-[#13334F]">
                  Shift Duties
                </label>
                <textarea
                  id="post-shift-notes"
                  rows={4}
                  disabled={saving}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Describe the responsibilities for this shift..."
                  className="w-full min-w-0 resize-none rounded-lg border border-[#DDE7E8] bg-[#F7FAFA] px-4 py-3 text-[#13334F]"
                />
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => navigate('/provider')}
                  className="min-h-12 flex-1 rounded-lg bg-[#E8EEF2] px-6 py-4 font-medium text-[#13334F] transition-colors hover:bg-[#DDE7E8] disabled:opacity-70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || loading || !hasSites}
                  className="min-h-12 flex-1 rounded-lg bg-[#53B59F] px-6 py-4 font-medium text-white transition-colors hover:bg-[#2F8E7A] disabled:opacity-70"
                >
                  {saving ? 'Posting…' : 'Post Shift'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
