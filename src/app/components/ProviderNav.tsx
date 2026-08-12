import { Link, useLocation } from 'react-router';
import { LayoutDashboard, Calendar, Users, Heart, Building2, Clock, CreditCard, FileCheck, HelpCircle } from 'lucide-react';
import { APP_NAME } from '../lib/brand';
import { CovreBrandLogo } from './CovreBrandLogo';

export function ProviderNav() {
  const location = useLocation();

  const navItems = [
    { path: '/provider', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { path: '/provider/shifts', label: 'Shifts', icon: Calendar },
    { path: '/provider/workers', label: 'Workers', icon: Users },
    { path: '/provider/bench', label: 'Bench', icon: Heart },
    { path: '/provider/timesheets', label: 'Timesheets', icon: Clock },
    { path: '/provider/billing', label: 'Billing', icon: CreditCard },
  ];

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="w-64 bg-white border-r border-[#DDE7E8] flex flex-col h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-[#DDE7E8]">
        <Link to="/" className="flex items-center gap-2">
          <CovreBrandLogo
            surface="light"
            layout="mark"
            width={56}
            className="shrink-0"
            imgClassName="h-14 w-14 max-h-14 object-contain"
            alt={APP_NAME}
          />
          <div>
            <div className="text-xl font-semibold text-[#13334F]">{APP_NAME}</div>
            <div className="text-xs text-[#53B59F]">Provider Portal</div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path, item.exact);
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  active
                    ? 'bg-[#E6F6F2] text-[#257665]'
                    : 'text-[#607583] hover:bg-[#F7FAFA]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#DDE7E8]">
        <button className="flex items-center gap-3 px-4 py-3 text-[#607583] hover:bg-[#F7FAFA] rounded-lg transition-colors w-full">
          <HelpCircle className="w-5 h-5" />
          <span className="font-medium">Support</span>
        </button>
      </div>
    </div>
  );
}
