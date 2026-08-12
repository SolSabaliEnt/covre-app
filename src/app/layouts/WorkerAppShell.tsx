import { Outlet, useLocation } from 'react-router';
import { Clock, DollarSign, MessageSquareText, CalendarCheck, User } from 'lucide-react';
import { cn } from '../components/ui/utils';
import { MobileBottomNav } from '../components/MobileBottomNav';

const WORKER_BOTTOM_NAV_PATHS = new Set([
  '/worker/shifts',
  '/worker/bookings',
  '/worker/messages',
  '/worker/pay',
  '/worker/account',
]);

const workerNavTabs = [
  { to: '/worker/shifts', label: 'Shifts', Icon: Clock },
  { to: '/worker/bookings', label: 'Bookings', Icon: CalendarCheck },
  { to: '/worker/messages', label: 'Messages', Icon: MessageSquareText },
  { to: '/worker/pay', label: 'Pay', Icon: DollarSign },
  { to: '/worker/account', label: 'Account', Icon: User },
] as const;

function showWorkerBottomNav(pathname: string): boolean {
  return WORKER_BOTTOM_NAV_PATHS.has(pathname);
}

/**
 * Mobile-first worker app shell: full viewport, no prototype device frame or extra workspace banner.
 * Bottom nav appears only on main worker hub routes.
 */
export function WorkerAppShell() {
  const { pathname } = useLocation();
  const navVisible = showWorkerBottomNav(pathname);

  const bottomItems = workerNavTabs.map(({ to, label, Icon }) => ({
    to,
    label,
    icon: Icon,
    active: pathname === to,
  }));

  return (
    <div className="flex h-[100dvh] max-h-[100svh] w-full max-w-full flex-col overflow-hidden bg-[#F7FAFA] text-[#10283D]">
      <main
        data-route-scroll-root="true"
        data-route-scroll-container="true"
        className={cn(
          'min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto',
          navVisible && 'pb-32',
        )}
      >
        <Outlet />
      </main>

      {navVisible && <MobileBottomNav aria-label="Worker navigation" items={bottomItems} />}
    </div>
  );
}
