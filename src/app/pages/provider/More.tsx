import { Link, useNavigate } from 'react-router';
import {
  Building2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  CreditCard,
  Gift,
  HelpCircle,
  ListChecks,
  LogOut,
  PlusCircle,
  Settings,
  Shuffle,
  UserPlus,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { isSupabaseBackendEnabled } from '../../lib/backendMode';
import { PROVIDER_ENTRY_PATH } from '../../lib/entryRoutes';
import { getProviderOnboardingStatus } from '../../services';

const links = [
  {
    to: '/provider/team',
    label: 'Team & Invites',
    description: 'Invite schedulers, billing users, and admins.',
    icon: UserPlus,
    status: null,
  },
  {
    to: '/provider/onboarding',
    label: 'Provider setup',
    description: 'Update organization, site, and staffing setup.',
    icon: ListChecks,
    status: null,
  },
  {
    to: '/provider/sites/new',
    label: 'Add care site',
    description: 'Register a new facility or home under your organization.',
    icon: PlusCircle,
    status: null,
  },
  {
    to: '/provider/referrals',
    label: 'Referrals',
    description: 'Share Covre and earn shift credits.',
    icon: Gift,
    status: null,
  },
  {
    to: '/provider/sites',
    label: 'Sites',
    description: 'Locations, orientation, and site staffing rules',
    icon: Building2,
    status: '3 active',
  },
  {
    to: '/provider/compliance',
    label: 'Compliance packets',
    description: 'Audit-ready shift records and signatures',
    icon: ClipboardCheck,
    status: '1 needs review',
  },
  {
    to: '/provider/timesheets',
    label: 'Timesheets',
    description: 'Review and approve completed shifts',
    icon: Clock,
    status: null,
  },
  {
    to: '/provider/billing',
    label: 'Billing',
    description: 'Invoices and payment methods',
    icon: CreditCard,
    status: null,
  },
  {
    to: '/provider/support',
    label: 'Support',
    description: 'Shifts, workers, payments, and compliance',
    icon: HelpCircle,
    status: 'Avg. reply under 24h',
  },
  {
    to: '/provider/settings',
    label: 'Settings',
    description: 'Organization, users, notifications',
    icon: Settings,
    status: null,
  },
] as const;

export default function More() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState(!isSupabaseBackendEnabled());

  useEffect(() => {
    if (!isSupabaseBackendEnabled()) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await getProviderOnboardingStatus();
      if (cancelled) return;
      if (res.ok) {
        setOnboardingComplete(res.data.onboardingComplete);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleLinks = useMemo(
    () =>
      links.filter(link => {
        if (link.to === '/provider/onboarding' && onboardingComplete) {
          return false;
        }
        return true;
      }),
    [onboardingComplete],
  );

  const signOut = () => {
    logout();
    navigate(PROVIDER_ENTRY_PATH, { replace: true });
  };

  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto w-full min-w-0 max-w-full space-y-6">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-[#13334F]">More</h1>
          <p className="mt-1 text-sm text-[#607583]">Sites, compliance, operations, and account</p>
        </div>

        <div className="space-y-2">
          {visibleLinks.map(({ to, label, description, icon: Icon, status }) => (
            <Link
              key={to}
              to={to}
              className="flex min-w-0 max-w-full items-center gap-4 overflow-hidden rounded-xl border border-[#DDE7E8] bg-white p-4 shadow-sm transition-colors hover:border-[#53B59F]/40 hover:bg-[#F7FAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] no-underline"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#E6F6F2] text-[#257665]">
                <Icon className="h-6 w-6" strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[#13334F]">{label}</div>
                <div className="text-sm text-[#607583]">{description}</div>
                {status ? (
                  <div className="mt-1 text-xs font-medium text-[#53B59F]">{status}</div>
                ) : null}
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-[#B8C6CC]" aria-hidden />
            </Link>
          ))}
        </div>

        <Link
          to={PROVIDER_ENTRY_PATH}
          className="flex min-w-0 max-w-full items-center gap-4 overflow-hidden rounded-xl border border-[#DDE7E8] bg-white p-4 shadow-sm transition-colors hover:border-[#53B59F]/40 hover:bg-[#F7FAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F] no-underline"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#E8EEF2] text-[#13334F]">
            <Shuffle className="h-6 w-6" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[#13334F]">Switch workspace</div>
            <div className="text-sm text-[#607583]">Choose worker, provider, or admin preview</div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-[#B8C6CC]" aria-hidden />
        </Link>

        <button
          type="button"
          onClick={signOut}
          className="flex min-w-0 w-full max-w-full items-center gap-4 overflow-hidden rounded-xl border border-[#DDE7E8] bg-white p-4 text-left shadow-sm transition-colors hover:border-[#D94A4A]/40 hover:bg-[#FDEAEA]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#F7FAFA] text-[#A93636]">
            <LogOut className="h-6 w-6" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[#13334F]">Sign out</div>
            <div className="text-sm text-[#607583]">End this demo session</div>
          </div>
        </button>
      </div>
    </div>
  );
}
