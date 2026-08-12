import { Link, useNavigate } from 'react-router';
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  CreditCard,
  Gift,
  LogOut,
  ShieldAlert,
  User,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../auth/AuthContext';
import { WORKER_ENTRY_PATH } from '../../lib/entryRoutes';
import { getWorkerAccount } from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-6 rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm text-[#607583]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B243A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
      >
        Retry
      </button>
    </div>
  );
}

export default function WorkerAccount() {
  const navigate = useNavigate();
  const { name, logout, isAuthenticated } = useAuth();
  const { data: accountStub, error, loading, reload } = useAsyncResource(() => getWorkerAccount(), []);

  const displayName = loading
    ? 'Loading…'
    : (isAuthenticated && name?.trim()
      ? name
      : (accountStub?.displayName ?? 'Care worker'));

  const roleLabel = loading ? 'Fetching summary…' : (accountStub?.primaryRoleLabel ?? 'Care worker');
  const showOnboardingCta =
    isSupabaseBackendEnabled() && accountStub?.needsOnboarding && !loading && !error;

  const handleSignOut = () => {
    logout();
    toast.success('Signed out');
    navigate(WORKER_ENTRY_PATH, { replace: true });
  };

  const rows = [
    {
      to: '/worker/referrals' as const,
      label: 'Referrals',
      sub: 'Refer care sites and track rewards.',
      icon: Gift,
    },
    {
      to: '/worker/credentials' as const,
      label: 'Credentials',
      sub: 'Passport & verifications',
      icon: BadgeCheck,
    },
    {
      to: '/worker/reputation' as const,
      label: 'Reputation / Covre Score',
      sub: 'Standing & history',
      icon: Star,
    },
    {
      to: '/worker/safety' as const,
      label: 'Safety reports',
      sub: 'Document issues securely',
      icon: ShieldAlert,
    },
    {
      to: '/worker/pay' as const,
      label: 'Payment settings',
      sub: 'Earnings & payouts',
      icon: CreditCard,
    },
  ];

  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 text-[#10283D]">
      <header className="border-b border-[#DDE7E8] bg-white p-5 sm:p-6">
        <h1 className="text-2xl font-semibold text-[#13334F]">Account</h1>
        <div className="mt-4 flex min-h-[5rem] items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E6F6F2] text-[#257665]">
            <User className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#13334F]">{displayName}</p>
            <p className="mt-0.5 text-sm text-[#607583]">{roleLabel}</p>
            {accountStub?.location && !loading ? (
              <p className="mt-0.5 text-xs text-[#9AAAB3]">{accountStub.location}</p>
            ) : null}
            {accountStub?.phone && !loading ? (
              <p className="mt-0.5 text-xs text-[#9AAAB3]">{accountStub.phone}</p>
            ) : null}
          </div>
        </div>
      </header>

      {showOnboardingCta && (
        <div className="mt-4 rounded-xl border border-[#53B59F]/30 bg-[#F3FBF8] px-4 py-3">
          <p className="text-sm text-[#13334F]">Finish your worker profile to apply for shifts.</p>
          <Link
            to="/worker/onboarding"
            className="mt-2 inline-flex text-sm font-semibold text-[#53B59F] hover:underline"
          >
            Complete onboarding →
          </Link>
        </div>
      )}

      {error && !loading && (
        <ErrorBlock message={error.message} onRetry={reload} />
      )}

      <section className="py-6">
        <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-[#607583]">
          Profile
        </h2>
        <div className="rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm text-[#607583]">
          {accountStub?.isSupabaseBacked
            ? 'Your Covre worker profile is stored in Supabase. Credentials and shift discovery are still in demo prep.'
            : 'Review your worker profile details in Credential Passport and Covre Score.'}
        </div>
      </section>

      <nav className="space-y-2 pb-24" aria-label="Account shortcuts">
        {rows.map(({ to, label, sub, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 shadow-sm transition-colors hover:border-[#53B59F]/40 no-underline"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F7FAFA] text-[#13334F]">
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[#13334F]">{label}</div>
              <div className="text-sm text-[#607583]">{sub}</div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-[#B8C6CC]" aria-hidden />
          </Link>
        ))}

        <Link
          to={WORKER_ENTRY_PATH}
          className="mt-4 flex items-center gap-3 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 shadow-sm transition-colors hover:border-[#53B59F]/40 no-underline"
        >
          <ArrowRight className="h-5 w-5 shrink-0 text-[#53B59F]" aria-hidden />
          <span className="flex-1 font-semibold text-[#13334F]">Switch workspace</span>
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-2 flex w-full items-center gap-3 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-[#D94A4A]/40 hover:bg-[#FDEAEA]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
        >
          <LogOut className="h-5 w-5 shrink-0 text-[#D94A4A]" aria-hidden />
          <span className="flex-1 font-semibold text-[#13334F]">Sign out</span>
        </button>
      </nav>
    </div>
  );
}
