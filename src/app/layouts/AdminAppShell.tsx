import { Link, Outlet } from 'react-router';
import { AdminNav } from '../components/AdminNav';
import { CovreBrandLogo } from '../components/CovreBrandLogo';
import { ADMIN_ENTRY_PATH, AUTH_COMPAT_PATH, PROVIDER_ENTRY_PATH } from '../lib/entryRoutes';
import { useAuth } from '../auth/AuthContext';

export function AdminAppShell() {
  const { name, isAuthenticated } = useAuth();
  const accountLabel = isAuthenticated ? name || 'Covre Ops' : 'Covre Ops';

  return (
    <div className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#F7FAFA]">
      {/* Mobile & tablet: desktop-only gate — no sidebar squeeze */}
      <div
        data-route-scroll-root="true"
        data-route-scroll-container="true"
        className="flex min-h-dvh w-full flex-col items-center justify-start overflow-y-auto px-6 pb-10 pt-[calc(1.5rem+env(safe-area-inset-top))] lg:hidden"
      >
        <CovreBrandLogo
          surface="light"
          layout="mark"
          width={72}
          className="shrink-0"
          imgClassName="h-16 w-16 object-contain"
          alt="Covre"
        />
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#607583]">Admin Console</p>
        <p className="mt-1 text-sm text-[#13334F]">{accountLabel}</p>

        <h1 className="mt-8 max-w-md text-center text-xl font-semibold leading-snug text-[#13334F]">
          Admin Console is desktop-only
        </h1>
        <p className="mt-4 max-w-md text-center text-sm leading-relaxed text-[#607583]">
          For security and operational clarity, Covre Admin is optimized for a larger desktop screen. Open this
          workspace on a laptop or desktop to continue.
        </p>

        <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
          <Link
            to={ADMIN_ENTRY_PATH}
            className="flex min-h-12 w-full items-center justify-center rounded-lg bg-[#13334F] px-5 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#0B243A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
          >
            Switch workspace
          </Link>
          <Link
            to={PROVIDER_ENTRY_PATH}
            className="flex min-h-12 w-full items-center justify-center rounded-lg border border-[#DDE7E8] bg-white px-5 py-3 text-center text-sm font-medium text-[#13334F] shadow-sm transition-colors hover:bg-[#F7FAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
          >
            Go to provider preview
          </Link>
        </div>
      </div>

      {/* Desktop admin console */}
      <div className="hidden min-h-dvh w-full lg:flex">
        <AdminNav />
        <main
          data-route-scroll-root="true"
          data-route-scroll-container="true"
          className="min-h-dvh min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
