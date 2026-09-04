import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import type { Role } from './AuthContext';
import { useAuth } from './AuthContext';
import {
  ADMIN_ENTRY_PATH,
  AUTH_COMPAT_PATH,
  PROVIDER_ENTRY_PATH,
  WORKER_ENTRY_PATH,
} from '../lib/entryRoutes';

/** Role-aware auth entry so "Switch workspace" returns users to the right sign-in screen. */
function switchWorkspaceHref(allowedRoles: Role[]): string {
  if (allowedRoles.length === 1 && allowedRoles[0] === 'admin') {
    return ADMIN_ENTRY_PATH;
  }
  if (allowedRoles.includes('provider')) {
    return PROVIDER_ENTRY_PATH;
  }
  if (allowedRoles.includes('worker')) {
    return WORKER_ENTRY_PATH;
  }
  return AUTH_COMPAT_PATH;
}

function roleLabels(roles: Role[]): string {
  const parts = roles.map(r =>
    r === 'worker' ? 'care workers' : r === 'provider' ? 'providers' : 'admins',
  );
  if (parts.length === 1) {
    return parts[0];
  }
  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`;
  }
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

export function AccessRestricted({ allowedRoles }: { allowedRoles: Role[] }) {
  const navigate = useNavigate();
  const switchHref = switchWorkspaceHref(allowedRoles);
  return (
    <div className="flex min-h-dvh min-w-0 flex-col items-center justify-center bg-[#F7FAFA] px-4 py-12 text-center">
      <div className="w-full max-w-md rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-[#13334F]">Access restricted</h1>
        <p className="mt-3 text-sm text-[#607583]">
          This workspace is for {roleLabels(allowedRoles)}.
        </p>
        <button
          type="button"
          onClick={() => navigate(switchHref, { replace: true })}
          className="mt-6 w-full rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#13334F]"
        >
          Switch workspace
        </button>
        <Link
          to="/"
          className="mt-3 inline-block text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A]"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

function AuthRoleUnavailable({
  message,
  allowedRoles,
}: {
  message?: string;
  allowedRoles: Role[];
}) {
  const navigate = useNavigate();
  const switchHref = switchWorkspaceHref(allowedRoles);
  return (
    <div className="flex min-h-dvh min-w-0 flex-col items-center justify-center bg-[#F7FAFA] px-4 py-12 text-center">
      <div className="w-full max-w-md rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-[#13334F]">Sign-in issue</h1>
        <p className="mt-3 text-sm text-[#607583]">
          {message ??
            'We could not verify your workspace role. Please sign in again or try again in a moment.'}
        </p>
        <button
          type="button"
          onClick={() => navigate(switchHref, { replace: true })}
          className="mt-6 w-full rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#13334F]"
        >
          Go to sign in
        </button>
        <Link
          to="/"
          className="mt-3 inline-block text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A]"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

export type ProtectedRouteProps = {
  allowedRoles: Role[];
};

function RouteAuthLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F7FAFA] px-4">
      <p className="text-sm font-medium text-[#13334F]">Loading…</p>
    </div>
  );
}

/** Layout route: wrap protected child routes; renders `<Outlet />` when allowed. */
export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated, role, authError } = useAuth();
  const location = useLocation();
  const adminPreview = new URLSearchParams(location.search).get('adminPreview') === '1';

  if (isLoading) {
    return <RouteAuthLoading />;
  }

  if (!isAuthenticated) {
    const path = location.pathname;
    if (path.startsWith('/admin')) {
      return <Navigate to={ADMIN_ENTRY_PATH} replace />;
    }
    if (path.startsWith('/provider')) {
      return <Navigate to={PROVIDER_ENTRY_PATH} replace />;
    }
    if (path.startsWith('/worker')) {
      return <Navigate to={WORKER_ENTRY_PATH} replace />;
    }
    return <Navigate to={AUTH_COMPAT_PATH} replace />;
  }

  if (!role) {
    return <AuthRoleUnavailable message={authError} allowedRoles={allowedRoles} />;
  }

  // Super Admin UI preview only: allow an authenticated admin to render worker/provider
  // surfaces without changing their session role. Data access still uses the admin session,
  // so Supabase ownership/RLS remains intact. The outer preview disables interactions.
  if (adminPreview && role === 'admin' && !allowedRoles.includes('admin')) {
    return <Outlet />;
  }

  if (!allowedRoles.includes(role)) {
    return <AccessRestricted allowedRoles={allowedRoles} />;
  }
  return <Outlet />;
}
