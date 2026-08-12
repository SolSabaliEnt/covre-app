import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Shield, FileText, Upload, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { StatusBadge, type BadgeVariant } from '../../components/StatusBadge';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import { WORKER_ENTRY_PATH } from '../../lib/entryRoutes';
import {
  getCurrentWorkerProfile,
  listWorkerCredentialReadiness,
  selfAttestWorkerCredential,
} from '../../services';
import type { WorkerCredentialReadinessRow } from '../../services/types';
import { useAsyncResource } from '../../hooks/useAsyncResource';

const mockCredentials = [
  { name: 'Government ID', status: 'verified' as const, icon: FileText },
  { name: 'Background Check', status: 'verified' as const, icon: Shield },
  { name: 'CNA Registry', status: 'verified' as const, icon: FileText },
  { name: 'CPR/BLS', status: 'expiring' as const, icon: FileText, expires: 'Expires in 45 days' },
  { name: 'Medication Training', status: 'pending' as const, icon: FileText },
  { name: 'TB Test', status: 'verified' as const, icon: FileText },
  { name: 'Work Authorization', status: 'verified' as const, icon: FileText },
  { name: 'References', status: 'missing' as const, icon: FileText },
];

function readinessBadgeVariant(status: WorkerCredentialReadinessRow['status']): BadgeVariant {
  if (status === 'verified') return 'verified';
  if (status === 'pending' || status === 'self_attested') return 'pending';
  if (status === 'expired') return 'expiring';
  return 'missing';
}

function MockCredentials() {
  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 text-[#10283D]">
      <Link
        to="/worker/account"
        className="mb-4 inline-flex text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
      >
        ← Back to Account
      </Link>
      <div className="border-b border-[#DDE7E8] bg-white p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E6F6F2]">
            <Shield className="h-5 w-5 text-[#257665]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#13334F]">Credential Passport</h1>
            <p className="text-sm text-[#607583]">Upload once, use everywhere</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="text-2xl font-semibold text-[#13334F]">6</div>
            <div className="text-xs text-[#607583]">Verified</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-[#F4A83D]">1</div>
            <div className="text-xs text-[#607583]">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-[#D94A4A]">1</div>
            <div className="text-xs text-[#607583]">Missing</div>
          </div>
        </div>
      </div>
      <div className="py-4">
        <div className="space-y-4">
          {mockCredentials.map(credential => (
            <div
              key={credential.name}
              className="rounded-xl border border-[#DDE7E8] bg-white p-5"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    credential.status === 'verified'
                      ? 'bg-[#E6F6F2]'
                      : credential.status === 'pending'
                        ? 'bg-[#FFF4E0]'
                        : credential.status === 'expiring'
                          ? 'bg-[#FFF4E0]'
                          : 'bg-[#FDEAEA]'
                  }`}
                >
                  <credential.icon
                    className={`h-5 w-5 ${
                      credential.status === 'verified'
                        ? 'text-[#257665]'
                        : credential.status === 'pending'
                          ? 'text-[#9B6419]'
                          : credential.status === 'expiring'
                            ? 'text-[#9B6419]'
                            : 'text-[#A93636]'
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h3 className="font-medium text-[#13334F]">{credential.name}</h3>
                    <StatusBadge variant={credential.status}>
                      {credential.status === 'verified' && (
                        <>
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Verified
                        </>
                      )}
                      {credential.status === 'pending' && (
                        <>
                          <Clock className="mr-1 h-3 w-3" />
                          Pending
                        </>
                      )}
                      {credential.status === 'expiring' && (
                        <>
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Expiring
                        </>
                      )}
                      {credential.status === 'missing' && (
                        <>
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Missing
                        </>
                      )}
                    </StatusBadge>
                  </div>
                  {credential.expires && (
                    <p className="text-xs text-[#9B6419]">{credential.expires}</p>
                  )}
                </div>
              </div>
              {credential.status === 'missing' && (
                <button
                  type="button"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#E8EEF2] px-4 py-2 text-sm font-medium text-[#13334F] transition-colors hover:bg-[#DDE7E8]"
                >
                  <Upload className="h-4 w-4" />
                  Upload Document
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-[#DDE7E8] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Link
          to="/worker/shifts"
          className="flex w-full items-center justify-center rounded-xl bg-[#53B59F] px-6 py-4 font-medium text-white transition-colors hover:bg-[#2F8E7A]"
        >
          Continue to Shifts
        </Link>
      </div>
    </div>
  );
}

function SupabaseCredentials() {
  const [addingId, setAddingId] = useState<string | null>(null);
  const {
    data: rows,
    error,
    loading,
    reload,
  } = useAsyncResource(() => listWorkerCredentialReadiness(), []);
  const { data: profile } = useAsyncResource(() => getCurrentWorkerProfile(), []);

  const verified = rows?.filter(r => r.status === 'verified').length ?? 0;
  const pending =
    rows?.filter(r => r.status === 'pending' || r.status === 'self_attested').length ?? 0;
  const missing = rows?.filter(r => r.status === 'missing').length ?? 0;

  const handleAdd = async (credentialId: string) => {
    setAddingId(credentialId);
    const res = await selfAttestWorkerCredential(credentialId);
    setAddingId(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(res.data.message);
    reload();
  };

  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 text-[#10283D]">
      <Link
        to="/worker/account"
        className="mb-4 inline-flex text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A]"
      >
        ← Back to Account
      </Link>

      <div className="border-b border-[#DDE7E8] bg-white p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E6F6F2]">
            <Shield className="h-5 w-5 text-[#257665]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#13334F]">Credential Passport</h1>
            <p className="text-sm text-[#607583]">Catalog and readiness from Supabase</p>
          </div>
        </div>
        {!loading && rows && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-2xl font-semibold text-[#13334F]">{verified}</div>
              <div className="text-xs text-[#607583]">Verified</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-[#F4A83D]">{pending}</div>
              <div className="text-xs text-[#607583]">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-[#D94A4A]">{missing}</div>
              <div className="text-xs text-[#607583]">Missing</div>
            </div>
          </div>
        )}
      </div>

      {profile && !profile.onboardingComplete && (
        <div className="mt-4 rounded-xl border border-[#53B59F]/30 bg-[#F3FBF8] px-4 py-3">
          <p className="text-sm text-[#13334F]">Complete your worker profile before adding credentials.</p>
          <Link to="/worker/onboarding" className="mt-2 inline-flex text-sm font-semibold text-[#53B59F] hover:underline">
            Complete onboarding →
          </Link>
        </div>
      )}

      {error && !loading && (
        <div className="mt-4 rounded-xl border border-[#DDE7E8] bg-white p-6 text-center text-sm text-[#607583]">
          {error.message}
          {error.code === 'not_authenticated' && (
            <Link to={WORKER_ENTRY_PATH} className="mt-3 block font-semibold text-[#53B59F] hover:underline">
              Sign in at /apply
            </Link>
          )}
          <button
            type="button"
            onClick={reload}
            className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      )}

      {loading && (
        <p className="py-8 text-center text-sm text-[#607583]">Loading credentials…</p>
      )}

      {!loading && !error && rows && (
        <div className="py-4">
          <p className="mb-4 text-xs leading-relaxed text-[#9AAAB3]">
            File upload and verification are coming later. This adds the credential to your passport
            for review.
          </p>
          <div className="space-y-4">
            {rows.map(row => (
              <div key={row.credentialId} className="rounded-xl border border-[#DDE7E8] bg-white p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-[#13334F]">{row.name}</h3>
                    {row.category && (
                      <p className="text-xs text-[#607583]">{row.category}</p>
                    )}
                  </div>
                  <StatusBadge variant={readinessBadgeVariant(row.status)}>
                    {row.statusLabel}
                  </StatusBadge>
                </div>
                {(row.status === 'missing' || row.status === 'expired') && (
                  <button
                    type="button"
                    disabled={addingId === row.credentialId || !profile?.workerId}
                    onClick={() => void handleAdd(row.credentialId)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#E8EEF2] px-4 py-2 text-sm font-medium text-[#13334F] hover:bg-[#DDE7E8] disabled:opacity-60"
                  >
                    {addingId === row.credentialId ? 'Adding…' : 'Add for review'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-[#DDE7E8] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Link
          to="/worker/shifts"
          className="flex w-full items-center justify-center rounded-xl bg-[#53B59F] px-6 py-4 font-medium text-white hover:bg-[#2F8E7A]"
        >
          Continue to Shifts
        </Link>
      </div>
    </div>
  );
}

export default function Credentials() {
  if (isSupabaseBackendEnabled()) {
    return <SupabaseCredentials />;
  }
  return <MockCredentials />;
}
