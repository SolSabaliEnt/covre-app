import { useLayoutEffect } from 'react';
import { Link, useLocation, useSearchParams, useNavigate, Navigate } from 'react-router';
import { toast } from 'sonner';
import { CovreBrandLogo } from '../components/CovreBrandLogo';
import { ProviderAuthForm } from '../components/ProviderAuthForm';
import { WorkerAuthForm } from '../components/WorkerAuthForm';
import { cn } from '../components/ui/utils';
import { useAuth, type Role } from '../auth/AuthContext';
import { getBackendMode } from '../lib/backendMode';
import { APP_NAME } from '../lib/brand';
import {
  ADMIN_ENTRY_PATH,
  PROVIDER_ENTRY_PATH,
  WORKER_ENTRY_PATH,
  entryRoleFromPath,
} from '../lib/entryRoutes';
import { resetRouteScrollNow } from '../hooks/useScrollToTop';
import { runRouteScrollResetPasses } from '../utils/scrollReset';
import { Building2, Stethoscope } from 'lucide-react';

const AUTH_PAGE_SHELL =
  'h-[100dvh] max-h-[100svh] min-h-0 w-full max-w-full overflow-x-hidden overflow-y-auto bg-[#F7FAFA] px-4 py-6 sm:py-10';
const AUTH_PAGE_INNER = 'mx-auto flex w-full max-w-md flex-col items-center';

function authNavReset() {
  resetRouteScrollNow();
}

type EntryRole = 'worker' | 'provider';

const cards: {
  role: EntryRole;
  title: string;
  description: string;
  icon: typeof Stethoscope;
  toastLabel: string;
  to: string;
}[] = [
  {
    role: 'worker',
    title: "I'm a Care Worker",
    description: 'Browse shifts, credentials, and pay in the worker app.',
    icon: Stethoscope,
    toastLabel: 'worker',
    to: '/worker/shifts',
  },
  {
    role: 'provider',
    title: "I'm a Provider",
    description: 'Create your facility workspace and start posting shifts.',
    icon: Building2,
    toastLabel: 'provider',
    to: '/provider/onboarding',
  },
];

function isEntryRoleParam(value: string | null): value is EntryRole {
  return value === 'worker' || value === 'provider';
}

export default function AuthEntry() {
  const { loginAs } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  useLayoutEffect(() => {
    return runRouteScrollResetPasses();
  }, [pathname]);
  const roleHint = searchParams.get('role');
  const backendMode = getBackendMode();
  const pathEntryRole = entryRoleFromPath(pathname);
  const highlight: EntryRole | null =
    pathEntryRole ?? (isEntryRoleParam(roleHint) ? roleHint : null);
  const dedicatedEntry = pathEntryRole != null;

  if (roleHint === 'admin') {
    return <Navigate to={ADMIN_ENTRY_PATH} replace />;
  }

  const choose = (card: (typeof cards)[number]) => {
    try {
      loginAs(card.role as Role);
      toast.success(`Signed in as ${card.toastLabel}`);
      navigate(card.to, { replace: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sign-in failed';
      toast.error(message);
    }
  };

  const visibleCards = dedicatedEntry
    ? cards.filter(c => c.role === pathEntryRole)
    : cards;

  const workerApplyView = pathEntryRole === 'worker';
  const facilityView = pathEntryRole === 'provider';

  const mockTitle = workerApplyView
    ? 'Apply for shifts'
    : facilityView
      ? 'Facility access'
      : `Choose how you'll use ${APP_NAME}`;

  const mockSubtitle = workerApplyView
    ? 'Preview the care worker app and apply for open shifts in demo mode.'
    : facilityView
      ? 'Start facility setup and post shifts in demo mode.'
      : 'Select a workspace to preview the app. Real sign-in will connect here later.';

  const continueLine =
    highlight === 'provider'
      ? 'Continue as facility'
      : highlight === 'worker'
        ? 'Continue as care worker'
        : null;

  if (backendMode === 'supabase' && facilityView) {
    return (
      <div
        data-route-scroll-root="true"
        data-route-scroll-container="true"
        className={AUTH_PAGE_SHELL}
      >
        <div className={AUTH_PAGE_INNER}>
          <ProviderAuthForm />

          <p className="mt-5 w-full text-center text-xs leading-relaxed text-[#9AAAB3]">
            Care worker sign-in is on{' '}
            <Link
              to={WORKER_ENTRY_PATH}
              onClick={authNavReset}
              className="font-medium text-[#53B59F] hover:underline"
            >
              Apply for care shifts
            </Link>
            .
          </p>

          <Link
            to={ADMIN_ENTRY_PATH}
            onClick={authNavReset}
            className="mt-5 text-center text-sm font-medium text-[#607583] underline-offset-2 hover:text-[#13334F] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
          >
            Looking for Admin Login?
          </Link>
        </div>
      </div>
    );
  }

  if (backendMode === 'supabase' && workerApplyView) {
    return (
      <div
        data-route-scroll-root="true"
        data-route-scroll-container="true"
        className={AUTH_PAGE_SHELL}
      >
        <div className={AUTH_PAGE_INNER}>
          <WorkerAuthForm />

          <p className="mt-5 w-full text-center text-xs leading-relaxed text-[#9AAAB3]">
            Provider and facility access is separate.
          </p>

          <Link
            to={PROVIDER_ENTRY_PATH}
            onClick={authNavReset}
            className="mt-5 text-center text-sm font-medium text-[#607583] underline-offset-2 hover:text-[#13334F] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
          >
            Facility access
          </Link>

          <Link
            to={ADMIN_ENTRY_PATH}
            onClick={authNavReset}
            className="mt-4 text-center text-sm font-medium text-[#607583] underline-offset-2 hover:text-[#13334F] hover:underline"
          >
            Looking for Admin Login?
          </Link>
        </div>
      </div>
    );
  }

  if (backendMode === 'supabase' && !facilityView) {
    return (
      <div
        data-route-scroll-root="true"
        data-route-scroll-container="true"
        className={AUTH_PAGE_SHELL}
      >
        <div className={AUTH_PAGE_INNER}>
          <div className="mb-8">
            <CovreBrandLogo
              surface="light"
              layout="mark"
              width={80}
              className="mx-auto"
              imgClassName="h-20 w-20 object-contain"
              alt={APP_NAME}
            />
          </div>
          <h1 className="text-center text-2xl font-semibold text-[#13334F]">Choose your sign-in</h1>
          <p className="mt-3 text-center text-sm leading-relaxed text-[#607583]">
            Facility and care worker accounts use separate entry screens.
          </p>
          <Link
            to={PROVIDER_ENTRY_PATH}
            onClick={authNavReset}
            className="mt-8 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-semibold text-white hover:bg-[#2F8E7A]"
          >
            Facility access
          </Link>
          <Link
            to={WORKER_ENTRY_PATH}
            onClick={authNavReset}
            className="mt-4 text-center text-sm font-medium text-[#607583] underline-offset-2 hover:text-[#13334F] hover:underline"
          >
            Apply for care shifts
          </Link>
          <Link
            to={ADMIN_ENTRY_PATH}
            onClick={authNavReset}
            className="mt-4 text-center text-sm font-medium text-[#607583] underline-offset-2 hover:text-[#13334F] hover:underline"
          >
            Admin Login
          </Link>
        </div>
      </div>
    );
  }


  return (
    <div
      data-route-scroll-root="true"
      data-route-scroll-container="true"
      className={AUTH_PAGE_SHELL}
    >
      <div className={AUTH_PAGE_INNER}>
        <div className="mb-8">
          <CovreBrandLogo
            surface="light"
            layout="mark"
            width={80}
            className="mx-auto"
            imgClassName="h-20 w-20 object-contain"
            alt={APP_NAME}
          />
        </div>
        <h1 className="text-center text-2xl font-semibold text-[#13334F]">{mockTitle}</h1>
        {continueLine && (
          <p className="mt-2 text-center text-sm font-medium text-[#53B59F]">{continueLine}</p>
        )}
        <p className="mt-3 text-center text-sm leading-relaxed text-[#607583]">{mockSubtitle}</p>

        <div className="mt-8 w-full space-y-3">
          {visibleCards.map(card => {
            const Icon = card.icon;
            const isPriority = highlight === card.role;
            return (
              <button
                key={card.role}
                type="button"
                onClick={() => choose(card)}
                className={cn(
                  'flex w-full items-start gap-4 rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]',
                  isPriority || dedicatedEntry
                    ? 'border-[#53B59F] ring-2 ring-[#53B59F]/25 hover:border-[#53B59F] hover:shadow-md'
                    : 'border-[#DDE7E8] hover:border-[#53B59F] hover:shadow-md',
                )}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E6F6F2] text-[#257665]">
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[#13334F]">
                    {workerApplyView ? 'Apply as a care worker' : card.title}
                  </div>
                  <div className="mt-0.5 text-sm text-[#607583]">{card.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        {!dedicatedEntry && (
          <div className="mt-6 flex w-full flex-col gap-2 text-center text-sm">
            <Link
              to={WORKER_ENTRY_PATH}
              onClick={authNavReset}
              className="font-medium text-[#53B59F] hover:text-[#2F8E7A] hover:underline"
            >
              Apply for shifts
            </Link>
            <Link
              to={PROVIDER_ENTRY_PATH}
              onClick={authNavReset}
              className="font-medium text-[#53B59F] hover:text-[#2F8E7A] hover:underline"
            >
              Facility access
            </Link>
          </div>
        )}

        {dedicatedEntry && pathEntryRole === 'worker' && (
          <Link
            to={PROVIDER_ENTRY_PATH}
            onClick={authNavReset}
            className="mt-6 text-center text-sm font-medium text-[#607583] underline-offset-2 hover:text-[#13334F] hover:underline"
          >
            Facility access instead
          </Link>
        )}

        {dedicatedEntry && pathEntryRole === 'provider' && (
          <Link
            to={WORKER_ENTRY_PATH}
            onClick={authNavReset}
            className="mt-6 text-center text-sm font-medium text-[#607583] underline-offset-2 hover:text-[#13334F] hover:underline"
          >
            Apply for shifts instead
          </Link>
        )}

        <Link
          to={ADMIN_ENTRY_PATH}
          onClick={authNavReset}
          className="mt-6 text-center text-sm font-medium text-[#607583] underline-offset-2 hover:text-[#13334F] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
        >
          Looking for Admin Login?
        </Link>

        <p className="mt-8 text-center text-xs text-[#9AAAB3]">
          Demo mode. Authentication coming soon.
        </p>
      </div>
    </div>
  );
}