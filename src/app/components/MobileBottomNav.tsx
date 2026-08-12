import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { resetRouteScrollNow } from '../utils/scrollReset';
import { cn } from './ui/utils';

export type MobileBottomNavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  active: boolean;
};

type MobileBottomNavProps = {
  items: MobileBottomNavItem[];
  /** e.g. "Worker navigation" */
  'aria-label': string;
  className?: string;
};

/**
 * Shared fixed bottom tab bar for worker and provider mobile shells.
 */
export function MobileBottomNav({ items, 'aria-label': ariaLabel, className }: MobileBottomNavProps) {
  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 border-t border-[#DDE7E8] bg-white px-2 pt-2',
        className,
      )}
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      aria-label={ariaLabel}
    >
      <div className="flex items-stretch justify-around">
        {items.map(({ to, label, icon: Icon, active }) => (
          <Link
            key={`${label}-${to}`}
            to={to}
            onClick={() => resetRouteScrollNow()}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[13px] leading-tight transition-colors',
              active ? 'font-semibold text-[#53B59F]' : 'font-medium text-[#607583]',
            )}
          >
            <Icon className="h-7 w-7 shrink-0" aria-hidden strokeWidth={active ? 2.25 : 2} />
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
