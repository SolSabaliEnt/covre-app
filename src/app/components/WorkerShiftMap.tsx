import { useMemo } from 'react';
import { Link } from 'react-router';
import { cn } from './ui/utils';
import { ShiftCard } from './ShiftCard';
import type { Shift } from '../data/types';
import { displayWorkerPay } from '../lib/workerRateCents';

export interface WorkerShiftMapProps {
  shifts: Shift[];
  onSelectShift?: (id: string) => void;
  selectedShiftId?: string;
}

type MapPoint = {
  shift: Shift;
  leftPct: number;
  topPct: number;
};

function hashPercent(id: string): { left: number; top: number } {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  const left = 12 + (Math.abs(h % 10000) / 10000) * 76;
  const top = 14 + (Math.abs((h >> 8) % 10000) / 10000) * 72;
  return { left, top };
}

function shiftIsUrgent(s: Shift): boolean {
  return Boolean(s.isUrgent ?? s.providerBoardStatus === 'urgent');
}

function shiftIsPreferred(s: Shift): boolean {
  return Boolean(s.isPreferred ?? s.workerFeedCardStatus === 'preferred');
}

function shiftIsReadyMatch(s: Shift): boolean {
  return Boolean(s.isReadyMatch ?? s.workerFeedCardStatus === 'ready');
}

/** Lower distance and higher worker pay sort first for “highest priority” preview. */
export function getDefaultMapPreviewShift(shifts: Shift[]): Shift | undefined {
  if (shifts.length === 0) return undefined;
  const score = (s: Shift) => {
    let p = 0;
    if (shiftIsUrgent(s)) p += 40;
    if (shiftIsPreferred(s)) p += 25;
    if (shiftIsReadyMatch(s)) p += 15;
    const miles =
      s.distanceNumericMiles ??
      (() => {
        const m = /^([\d.]+)/.exec(String(s.distanceMiles).trim());
        return m ? parseFloat(m[1]) : 99;
      })();
    const pay =
      s.workerRateCents != null
        ? s.workerRateCents / 100
        : (() => {
            const m = /\$([\d.]+)/.exec(displayWorkerPay(s));
            return m ? parseFloat(m[1]) : 0;
          })();
    p += pay * 0.5;
    p -= miles * 1.2;
    return p;
  };
  return [...shifts].sort((a, b) => score(b) - score(a))[0];
}

function computePoints(shifts: Shift[]): MapPoint[] {
  const withCoords = shifts.filter(s => s.latitude != null && s.longitude != null);
  const useLatLng = withCoords.length >= 2;
  let minLat = 0;
  let maxLat = 1;
  let minLng = 0;
  let maxLng = 1;
  if (useLatLng) {
    const lats = withCoords.map(s => s.latitude!);
    const lngs = withCoords.map(s => s.longitude!);
    minLat = Math.min(...lats);
    maxLat = Math.max(...lats);
    minLng = Math.min(...lngs);
    maxLng = Math.max(...lngs);
    const padLat = Math.max((maxLat - minLat) * 0.12, 0.004);
    const padLng = Math.max((maxLng - minLng) * 0.12, 0.004);
    minLat -= padLat;
    maxLat += padLat;
    minLng -= padLng;
    maxLng += padLng;
  }

  return shifts.map((shift, index) => {
    let leftPct: number;
    let topPct: number;
    if (useLatLng && shift.latitude != null && shift.longitude != null) {
      const spanLng = maxLng - minLng || 1;
      const spanLat = maxLat - minLat || 1;
      leftPct = ((shift.longitude - minLng) / spanLng) * 78 + 11;
      topPct = (1 - (shift.latitude - minLat) / spanLat) * 76 + 12;
    } else {
      const h = hashPercent(shift.id);
      leftPct = h.left;
      topPct = h.top;
    }
    const stagger = (index % 5) * 1.4 - 2.8;
    leftPct += stagger * 0.4;
    topPct += stagger * 0.3;
    leftPct = Math.min(88, Math.max(8, leftPct));
    topPct = Math.min(86, Math.max(10, topPct));
    return { shift, leftPct, topPct };
  });
}

export function WorkerShiftMap({ shifts, onSelectShift, selectedShiftId }: WorkerShiftMapProps) {
  const points = useMemo(() => computePoints(shifts), [shifts]);

  const previewShift = useMemo(() => {
    const selected = selectedShiftId ? shifts.find(s => s.id === selectedShiftId) : undefined;
    return selected ?? getDefaultMapPreviewShift(shifts);
  }, [shifts, selectedShiftId]);

  return (
    <div className="w-full max-w-full min-w-0 space-y-4">
      <p className="text-xs leading-relaxed text-[#607583]">
        Covered-fit view: match-ready shifts, preferred sites, credential alignment, urgent coverage, and the pay
        vs. travel tradeoff — before you commit to a commute.
      </p>

      {/* Static discovery controls */}
      <div className="flex flex-wrap gap-2">
        {['Near me', '25 mi', 'Highest pay'].map(label => (
          <span
            key={label}
            className="inline-flex items-center rounded-full border border-[#DDE7E8] bg-white px-3 py-1.5 text-xs font-medium text-[#13334F]"
          >
            {label}
          </span>
        ))}
      </div>

      <div
        className="relative w-full max-w-full overflow-hidden rounded-2xl border border-[#C5D8DB] bg-gradient-to-br from-[#E8F5F0] via-[#DCEEF5] to-[#D4E8E2] shadow-inner"
        style={{ height: 420, maxHeight: 'min(420px, 55svh)' }}
        role="presentation"
        aria-label="Stylized discovery map"
      >
        {/* Soft land / water blocks */}
        <div className="pointer-events-none absolute inset-0 opacity-90">
          <div className="absolute -left-8 top-0 h-3/5 w-1/2 rotate-6 rounded-full bg-[#C8E9E0]/55 blur-2xl" />
          <div className="absolute bottom-0 right-0 h-1/2 w-3/5 -rotate-3 rounded-full bg-[#B9D9EC]/50 blur-2xl" />
        </div>

        {/* Region labels */}
        <div className="pointer-events-none absolute left-3 top-2 text-[10px] font-semibold uppercase tracking-wide text-[#4A6F7C]/80">
          Pearl
        </div>
        <div className="pointer-events-none absolute right-4 top-8 text-[10px] font-semibold uppercase tracking-wide text-[#4A6F7C]/80">
          Inner East
        </div>
        <div className="pointer-events-none absolute bottom-10 left-5 text-[10px] font-semibold uppercase tracking-wide text-[#4A6F7C]/75">
          Waterfront
        </div>

        {/* Faint grid */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full text-[#13334F]/[0.07]" aria-hidden>
          <defs>
            <pattern id="wsGrid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#wsGrid)" />
        </svg>

        {/* Mock roads */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-[42%] h-px w-full bg-white/45" />
          <div className="absolute left-0 top-[68%] h-px w-full bg-white/30" />
          <div className="absolute bottom-[18%] left-[22%] top-[12%] w-px bg-white/35" />
          <div className="absolute bottom-[22%] left-[58%] top-[8%] w-px bg-white/28" />
          <div className="absolute bottom-[10%] left-0 top-[52%] w-full rotate-[8deg] bg-white/22" />
        </div>

        {/* Legend */}
        <div className="absolute right-3 top-3 z-[1] rounded-xl bg-white/90 px-3 py-2 text-[10px] shadow-sm backdrop-blur-sm ring-1 ring-black/5">
          <p className="mb-1.5 font-semibold text-[#13334F]">Legend</p>
          <ul className="space-y-1 text-[#607583]">
            <li className="flex items-center gap-1.5">
              <span className="relative inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#257665]">
                <span className="text-[8px] font-bold leading-none text-white">✓</span>
              </span>
              Ready match
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-flex h-3 w-3 shrink-0 rounded-full bg-[#13334F]" />
              Preferred site
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-flex h-3 w-3 shrink-0 rounded-full bg-[#8A9CA8] ring-2 ring-[#53B59F] ring-offset-1 ring-offset-white" />
              Urgent coverage
            </li>
          </ul>
        </div>

        {points.length === 0 ? (
          <div className="absolute inset-x-4 bottom-4 z-[2] rounded-2xl bg-white/90 p-5 text-center shadow-sm ring-1 ring-[#DDE7E8] backdrop-blur-sm">
            <p className="text-sm font-semibold text-[#13334F]">No open shifts on the map yet.</p>
            <p className="mt-1 text-xs text-[#607583]">When facilities post coverage, nearby opportunities will appear here.</p>
          </div>
        ) : null}

        {/* Pins */}
        <ul className="absolute inset-0 z-[2] list-none p-0 m-0">
          {points.map(({ shift, leftPct, topPct }) => {
            const urgent = shiftIsUrgent(shift);
            const preferred = shiftIsPreferred(shift);
            const ready = shiftIsReadyMatch(shift);
            const selected = shift.id === selectedShiftId;

            const pinOuter = cn(
              'relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]',
              selected && 'z-[3] scale-110',
            );

            let innerBg = 'bg-[#607583]';
            let ringClass = '';
            if (preferred) innerBg = 'bg-[#13334F]';
            if (ready && !preferred) innerBg = 'bg-[#257665]';
            if (urgent) ringClass = 'ring-2 ring-[#53B59F] ring-offset-1 ring-offset-white/70';

            return (
              <li
                key={shift.id}
                className="absolute -translate-x-1/2 -translate-y-full"
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              >
                <button
                  type="button"
                  className={cn(pinOuter, ringClass)}
                  onClick={() => onSelectShift?.(shift.id)}
                  aria-label={`${shift.roleTitle} at ${shift.siteName}${urgent ? ', urgent coverage' : ''}`}
                  aria-pressed={selected}
                >
                  <span className={cn('h-5 w-5 rounded-full shadow-sm', innerBg)} />
                  {ready ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-white px-0.5 text-[9px] font-bold leading-none text-[#257665] shadow ring-1 ring-[#DDE7E8]">
                      ✓
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {previewShift ? (
        <div className="rounded-2xl border border-[#DDE7E8] bg-white p-4 shadow-sm">
          <ShiftCard
            compact
            title={previewShift.roleTitle}
            facility={previewShift.facilitySettingLabel}
            dateTime={`${previewShift.dateLabel} • ${previewShift.timeRange}`}
            pay={displayWorkerPay(previewShift)}
            paySubtext={`Est. ${previewShift.estimatedTotalDisplay}`}
            distance={previewShift.distanceMiles}
            duration="8 hrs"
            badges={previewShift.credentialTags}
            status={
              previewShift.workerFeedCardStatus === 'preferred'
                ? { variant: 'preferred', label: 'Preferred' }
                : { variant: 'covered', label: 'Ready Match' }
            }
          />
          {shiftIsUrgent(previewShift) ? (
            <p className="mt-2 text-xs font-medium text-[#257665]" role="status">
              Urgent coverage — prioritized on the map ring.
            </p>
          ) : null}
          <Link
            to={`/worker/shift/${previewShift.id}`}
            className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B243A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
          >
            View shift
          </Link>
        </div>
      ) : null}
    </div>
  );
}
