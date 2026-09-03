import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Eye, LockKeyhole, Smartphone } from 'lucide-react';
import { isSupabaseBackendEnabled } from '../lib/backendMode';

export function AdminPreviewFrame({
  audience,
  children,
}: {
  audience: 'Worker' | 'Provider';
  children: ReactNode;
}) {
  const supabaseMode = isSupabaseBackendEnabled();

  return (
    <div className="min-h-full bg-[#EEF4F5]">
      <div className="sticky top-0 z-50 border-b border-[#BFDCD5] bg-[#E6F6F2] px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#13334F] text-white">
              <Eye className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2F8E7A]">
                Super Admin Preview · Read only
              </p>
              <p className="truncate text-sm font-semibold text-[#13334F]">
                Viewing the {audience.toLowerCase()} experience
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BFDCD5] bg-white px-3 py-1.5 text-xs font-medium text-[#607583]">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
              {supabaseMode ? 'Live data remains RLS-protected' : 'Mock data preview'}
            </span>
            <Link
              to="/admin/full-app"
              className="rounded-lg bg-[#13334F] px-3 py-2 text-xs font-semibold text-white no-underline hover:bg-[#0B243A]"
            >
              Back to Full App
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-4 lg:p-6">
        {supabaseMode ? (
          <div className="mx-auto mb-4 max-w-2xl rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm leading-6 text-[#607583]">
            This preview never changes your authenticated role and does not bypass Supabase ownership or RLS.
            Cross-user live data will appear only after dedicated admin read models are deployed.
          </div>
        ) : null}

        <div className="mx-auto w-full max-w-[430px]">
          <div className="mb-2 flex items-center justify-between px-1 text-xs font-medium text-[#607583]">
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" aria-hidden />
              Mobile app viewport
            </span>
            <span>430 px</span>
          </div>

          <div className="overflow-hidden rounded-[34px] border-[8px] border-[#13334F] bg-[#13334F] shadow-xl">
            <div className="flex h-7 items-center justify-center bg-[#13334F]" aria-hidden>
              <div className="h-1.5 w-20 rounded-full bg-white/30" />
            </div>

            <div
              className="h-[760px] overflow-x-hidden overflow-y-auto overscroll-contain bg-[#F7FAFA]"
              aria-label={`${audience} app mobile viewport`}
            >
              <div
                className="pointer-events-none min-h-full select-none"
                aria-label={`${audience} app read-only preview`}
              >
                {children}
              </div>
            </div>

            <div className="flex h-7 items-center justify-center bg-[#13334F]" aria-hidden>
              <div className="h-1 w-24 rounded-full bg-white/50" />
            </div>
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-xl text-center text-xs leading-5 text-[#607583]">
          Interactions are disabled in Super Admin Preview so inspecting the app cannot create or mutate worker/provider data.
        </p>
      </div>
    </div>
  );
}
