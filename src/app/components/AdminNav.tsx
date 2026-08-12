import { Link, useLocation, useNavigate } from 'react-router';
import { resetRouteScrollNow } from '../utils/scrollReset';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Shield,
  Activity,
  AlertTriangle,
  ShieldCheck,
  CreditCard,
  CircleDollarSign,
  Gift,
  LifeBuoy,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { APP_NAME, LANDING_LOGO_SIDEBAR_CLASS, LANDING_LOGO_SRC } from '../lib/brand';
import { ADMIN_ENTRY_PATH, AUTH_COMPAT_PATH } from '../lib/entryRoutes';

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

function navMatch(pathname: string, item: NavItem): boolean {
  return item.isActive(pathname);
}

const navItems: NavItem[] = [
  {
    to: '/admin',
    label: 'Dashboard',
    icon: LayoutDashboard,
    isActive: p => p === '/admin',
  },
  {
    to: '/admin/credentials',
    label: 'Credentials',
    icon: Shield,
    isActive: p => p.startsWith('/admin/credentials'),
  },
  {
    to: '/admin/marketplace',
    label: 'Marketplace',
    icon: Activity,
    isActive: p => p.startsWith('/admin/marketplace') || p.startsWith('/admin/shifts'),
  },
  {
    to: '/admin/referrals',
    label: 'Referrals',
    icon: Gift,
    isActive: p => p.startsWith('/admin/referrals'),
  },
  {
    to: '/admin/incidents',
    label: 'Incidents',
    icon: AlertTriangle,
    isActive: p => p.startsWith('/admin/incidents'),
  },
  {
    to: '/admin/trust',
    label: 'Trust & Safety',
    icon: ShieldCheck,
    isActive: p => p.startsWith('/admin/trust'),
  },
  {
    to: '/admin/payments',
    label: 'Payments',
    icon: CreditCard,
    isActive: p => p.startsWith('/admin/payments'),
  },
  {
    to: '/admin/worker-rates',
    label: 'Rate Review',
    icon: CircleDollarSign,
    isActive: p => p.startsWith('/admin/worker-rates'),
  },
  {
    to: '/admin/support',
    label: 'Support',
    icon: LifeBuoy,
    isActive: p => p.startsWith('/admin/support'),
  },
  {
    to: '/admin/users',
    label: 'Users',
    icon: Users,
    isActive: p => p.startsWith('/admin/users'),
  },
];

export function AdminNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { name, logout } = useAuth();

  return (
    <div className="flex min-h-screen w-64 shrink-0 flex-col bg-[#0B243A] text-white">
      {/* Logo — dark-background wordmark + admin sublabel */}
      <div className="border-b border-[#244965] p-6">
        <Link to="/" className="block space-y-2">
          <img
            src={LANDING_LOGO_SRC}
            alt={APP_NAME}
            width={906}
            height={209}
            loading="eager"
            decoding="async"
            className={LANDING_LOGO_SIDEBAR_CLASS}
          />
          <div className="pl-0.5 text-xs uppercase tracking-wide text-[#53B59F]">Admin Console</div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = navMatch(location.pathname, item);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => resetRouteScrollNow()}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                  active
                    ? 'bg-[#244965] text-white'
                    : 'text-[#9AAAB3] hover:bg-[#13334F] hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto border-t border-[#244965] p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-[#9AAAB3]">Account</div>
        <div className="mb-3 truncate text-sm font-medium text-white">{name || 'Covre Ops'}</div>
        <Link
          to="/auth"
          className="block w-full rounded-lg border border-[#244965] bg-[#13334F] px-3 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-[#244965]"
        >
          Switch workspace
        </Link>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate(ADMIN_ENTRY_PATH, { replace: true });
          }}
          className="mt-2 w-full rounded-lg px-3 py-2 text-center text-xs font-medium text-[#9AAAB3] transition-colors hover:bg-[#13334F] hover:text-white"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
