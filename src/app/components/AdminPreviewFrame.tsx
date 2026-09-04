import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { Eye, LockKeyhole, Smartphone } from 'lucide-react';
import { isSupabaseBackendEnabled } from '../lib/backendMode';

function previewTarget(pathname: string): string {
  if (pathname === '/admin/full-app/provider') {
    return '/provider?adminPreview=1';
  }
  if (pathname.startsWith('/admin/full-app/provider/')) {
    return `${pathname.replace('/admin/full-app/provider', '/provider')}?adminPreview=1`;
  }
  if (pathname.startsWith('/admin/full-app/worker/')) {
    return `${pathname.replace('/admin/full-app/worker', '/worker')}?adminPreview=1`;
  }
  return '/';
}

export function AdminPreviewFrame({
  audience,
  children: _children,
}: {
  audience: 'Worker' | 'Provider';
  children?: ReactNode;
}) {
  const supabaseMode = isSupabaseBackendEnabled();
  const location = useLocation();
  const renderPath = previewTarget(location.pathname);

  return (
    <div className="min-h-full bg-[#F3F7F7]">
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

      <div className="mx-auto max-w-7xl p-5 lg:p-8">
        {supabaseMode ? (
          <div className="mx-auto mb-5 max-w-2xl rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm leading-6 text-[#607583] shadow-sm">
            This preview never changes your authenticated role and does not bypass Supabase ownership or RLS.
            Cross-user live data will appear only after dedicated admin read models are deployed.
          </div>
        ) : null}

        <div className="mx-auto w-full max-w-[390px]">
          <div className="mb-3 flex items-center justify-between px-1 text-xs font-medium text-[#607583]">
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" aria-hidden />
              Mobile preview
            </span>
            <span>390 × 844</span>
          </div>

          <div className="h-[844px] w-[390px] max-w-full overflow-hidden rounded-[28px] border border-[#CBD9DC] bg-white shadow-[0_18px_50px_rgba(19,51,79,0.16)] ring-1 ring-white">
            <iframe
              title={`${audience} mobile app preview`}
              src={renderPath}
              width="390"
              height="844"
              sandbox="allow-scripts allow-same-origin"
              onLoad={event => {
                const doc = event.currentTarget.contentDocument;
                if (!doc) return;

                const blockMutation = (interaction: Event) => {
                  interaction.preventDefault();
                  interaction.stopPropagation();
                };

                doc.addEventListener('click', blockMutation, true);
                doc.addEventListener('submit', blockMutation, true);
              }}
              className="block h-[844px] w-[390px] max-w-full border-0 bg-white"
            />
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-xl text-center text-xs leading-5 text-[#607583]">
          Scroll freely inside the 390 × 844 mobile viewport. Clicks and form submissions remain blocked so the Super Admin preview stays read only.
        </p>
      </div>
    </div>
  );
}
