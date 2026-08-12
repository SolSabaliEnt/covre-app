import { Link } from 'react-router';
import type { ReactNode } from 'react';
import { MapPin, Clock, DollarSign } from 'lucide-react';
import { StatusBadge, type BadgeVariant } from './StatusBadge';
import { cn } from './ui/utils';

export type ShiftCardBadge = string;

export interface ShiftCardProps {
  title: string;
  facility: string;
  setting?: string;
  facilityType?: string;
  dateTime: string;
  pay?: string;
  paySubtext?: string;
  distance?: string;
  /** e.g. "8 hrs" for worker shifts */
  duration?: string;
  worker?: string | null;
  /** When set with a worker name, wraps the worker label in an internal profile link (e.g. provider shift board). */
  workerProfileTo?: string;
  status?: { variant: BadgeVariant; label: ReactNode };
  risk?: string;
  badges?: ShiftCardBadge[];
  to?: string;
  ctaLabel?: string;
  onClick?: () => void;
  compact?: boolean;
  className?: string;
  children?: ReactNode;
}

const ringFocus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]';

export function ShiftCard({
  title,
  facility,
  setting,
  facilityType,
  dateTime,
  pay,
  paySubtext,
  distance,
  duration,
  worker,
  workerProfileTo,
  status,
  risk,
  badges,
  to,
  ctaLabel,
  onClick,
  compact,
  className,
  children,
}: ShiftCardProps) {
  const settingLabel = setting ?? facilityType;
  const padding = compact ? 'p-4' : 'p-5';
  const facilityLine = [facility, settingLabel].filter(Boolean).join(' · ');

  const showPayBlock = Boolean(pay || paySubtext);
  const showMetaRow =
    showPayBlock ||
    (distance !== undefined && distance !== '') ||
    (duration !== undefined && duration !== '');

  const content = (
    <>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className={cn('font-semibold text-[#13334F]', compact ? 'text-sm' : 'text-base')}>
            {title}
          </h3>
          <p className="mt-0.5 text-sm text-[#607583]">{facilityLine}</p>
          <p className="mt-1 text-sm text-[#607583]">{dateTime}</p>
        </div>
        {status && <StatusBadge variant={status.variant}>{status.label}</StatusBadge>}
      </div>

      {showMetaRow && (
        <div className="mb-3 flex flex-wrap gap-4 text-xs sm:text-sm">
          {showPayBlock && (
            <div className="flex min-w-0 flex-1 items-start gap-1.5 sm:min-w-[5.5rem]">
              <DollarSign className="mt-0.5 h-4 w-4 shrink-0 text-[#53B59F]" aria-hidden />
              <div className="min-w-0">
                {pay ? <div className="font-semibold text-[#13334F]">{pay}</div> : null}
                {paySubtext && <div className="text-xs text-[#607583]">{paySubtext}</div>}
              </div>
            </div>
          )}
          {distance !== undefined && distance !== '' && (
            <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:min-w-[5rem]">
              <MapPin className="h-4 w-4 shrink-0 text-[#607583]" aria-hidden />
              <span className="truncate text-[#607583]">{distance}</span>
            </div>
          )}
          {duration !== undefined && duration !== '' && (
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0 text-[#607583]" aria-hidden />
              <span className="text-[#607583]">{duration}</span>
            </div>
          )}
        </div>
      )}

      {worker !== undefined && (
        <p className="mb-2 text-sm">
          {worker === null || worker === '' ? (
            <span className="italic text-[#9AAAB3]">Not assigned</span>
          ) : workerProfileTo && !to ? (
            <>
              <span className="text-[#607583]">Worker: </span>
              <Link
                to={workerProfileTo}
                className="font-medium text-[#13334F] underline-offset-2 hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
              >
                {worker}
              </Link>
            </>
          ) : (
            <>
              <span className="text-[#607583]">Worker: </span>
              <span className="text-[#13334F]">{worker}</span>
            </>
          )}
        </p>
      )}

      {risk && (
        <p className="mb-2 text-xs font-medium text-[#9B6419]" role="status">
          {risk}
        </p>
      )}

      {badges && badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badges.map(b => (
            <span
              key={b}
              className="rounded bg-[#E6F6F2] px-2 py-1 text-xs font-medium text-[#257665]"
            >
              {b}
            </span>
          ))}
        </div>
      )}

      {children}

      {ctaLabel && !to && (
        <div className="mt-3 border-t border-[#DDE7E8] pt-3">
          <span className="text-sm font-medium text-[#53B59F]">{ctaLabel}</span>
        </div>
      )}
    </>
  );

  const cardClass = cn(
    'block w-full max-w-full overflow-hidden rounded-2xl border border-[#DDE7E8] bg-white text-left shadow-sm transition-shadow',
    padding,
    'hover:border-[#53B59F] hover:shadow-md',
    ringFocus,
    className,
  );

  if (to) {
    return (
      <Link to={to} className={cn(cardClass, 'no-underline')} aria-label={`Open shift: ${title}`}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={cn(cardClass, 'cursor-pointer')} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={cardClass}>{content}</div>;
}
