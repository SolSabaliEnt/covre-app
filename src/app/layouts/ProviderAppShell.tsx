import { Outlet, useLocation } from 'react-router';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Heart,
  MoreHorizontal,
} from 'lucide-react';
import { CovreBrandLogo } from '../components/CovreBrandLogo';
import { APP_NAME } from '../lib/brand';
import { useAuth } from '../auth/AuthContext';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { isSupabaseBackendEnabled } from '../lib/backendMode';
import { getCurrentProviderOrganization } from '../services';

const MORE_HREF = '/provider/more';
const WORKERS_HREF = '/provider/workers';

function isDashboardActive(pathname: string) {
  return pathname === '/provider';
}

function isShiftsActive(pathname: string) {
  return (
    pathname === '/provider/shifts' ||
    pathname.startsWith('/provider/shifts/') ||
    pathname === '/provider/post-shift'
  );
}

function isWorkersActive(pathname: string) {
  return (
    pathname === WORKERS_HREF ||
    pathname.startsWith('/provider/workers/') ||
    pathname.startsWith('/provider/worker-match')
  );
}

function isBenchActive(pathname: string) {
  return pathname === '/provider/bench';
}

function isMoreActive(pathname: string) {
  return (
    pathname === '/provider/more' ||
    pathname === '/provider/onboarding' ||
    pathname === '/provider/team' ||
    pathname === '/provider/referrals' ||
    pathname.startsWith('/provider/sites') ||
    pathname === '/provider/compliance' ||
    pathname.startsWith('/provider/compliance/') ||
    pathname === '/provider/timesheets' ||
    pathname.startsWith('/provider/timesheets/') ||
    pathname === '/provider/billing' ||
    pathname.startsWith('/provider/billing/') ||
    pathname === '/provider/support' ||
    pathname.startsWith('/provider/support/') ||
    pathname === '/provider/settings' ||
    pathname.startsWith('/provider/settings/')
  );
}

/** Route-aware provider shell subtitle — never show auth session display names here. */
function providerHeaderSubtitle(pathname: string, organizationName?: string | null) {
  if (pathname.startsWith('/provider/onboarding')) {
    return 'Provider · Workspace setup';
  }
  if (pathname === '/provider/sites/new') {
    return 'Provider · Add care site';
  }
  const name = organizationName?.trim();
  if (name) {
    return `Provider · ${name}`;
  }
  return 'Provider workspace';
}

function hideProviderBottomNav(pathname: string) {
  return pathname.startsWith('/provider/onboarding') || pathname === '/provider/sites/new';
}

export function ProviderAppShell() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const { data: providerOrg, loading: orgLoading } = useAsyncResource(
    () =>
      isAuthenticated && isSupabaseBackendEnabled()
        ? getCurrentProviderOrganization()
        : Promise.resolve({ ok: true as const, data: null }),
    [pathname, isAuthenticated],
  );
  const organizationName =
    !orgLoading && providerOrg?.organizationName ? providerOrg.organizationName : null;
  const headerSubtitle = providerHeaderSubtitle(pathname, organizationName);
  const hideNav = hideProviderBottomNav(pathname);
  const mainBottomPaddingClass = hideNav
    ? 'pb-[calc(1rem+env(safe-area-inset-bottom))]'
    : 'pb-32';

  const tabActive = [
    isDashboardActive(pathname),
    isShiftsActive(pathname),
    isWorkersActive(pathname),
    isBenchActive(pathname),
    isMoreActive(pathname),
  ];

  const bottomItems = [
    { to: '/provider', label: 'Dashboard', icon: LayoutDashboard, active: tabActive[0] },
    { to: '/provider/shifts', label: 'Shifts', icon: Calendar, active: tabActive[1] },
    { to: WORKERS_HREF, label: 'Workers', icon: Users, active: tabActive[2] },
    { to: '/provider/bench', label: 'Bench', icon: Heart, active: tabActive[3] },
    { to: MORE_HREF, label: 'More', icon: MoreHorizontal, active: tabActive[4] },
  ];

  return (
    <div className="flex h-[100dvh] max-h-[100svh] min-h-dvh w-full max-w-full flex-col overflow-hidden bg-[#F7FAFA]">
      <header className="sticky top-0 z-40 shrink-0 border-b border-[#DDE7E8] bg-white">
        <div className="mx-auto flex w-full max-w-lg min-w-0 items-center gap-3 px-4 pb-6 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <CovreBrandLogo
              surface="light"
              layout="mark"
              width={49}
              className="shrink-0"
              imgClassName="h-[49px] w-[49px] max-h-[49px] object-contain"
              alt={APP_NAME}
            />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-[#13334F]">{APP_NAME}</div>
              <div className="truncate text-xs text-[#53B59F]">
                {headerSubtitle}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main
        data-route-scroll-root="true"
        data-route-scroll-container="true"
        className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto ${mainBottomPaddingClass}`}
      >
        <Outlet />
      </main>

      {!hideNav ? <MobileBottomNav aria-label="Provider navigation" items={bottomItems} /> : null}
    </div>
  );
}
