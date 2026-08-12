import { useLayoutEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';
import { CovreBrandLogo } from '../components/CovreBrandLogo';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { AUTH_COMPAT_PATH, PROVIDER_ENTRY_PATH, WORKER_ENTRY_PATH } from '../lib/entryRoutes';
import { useAuth } from '../auth/AuthContext';
import { signInAdminWithEmail } from '../auth/supabaseAdminAuth';
import { getBackendMode } from '../lib/backendMode';
import { resetRouteScrollNow } from '../hooks/useScrollToTop';
import { runRouteScrollResetPasses } from '../utils/scrollReset';

function authNavReset() {
  resetRouteScrollNow();
}

function MockAdminEntry() {
  const { loginAs } = useAuth();
  const navigate = useNavigate();

  const handleContinue = () => {
    try {
      loginAs('admin');
      toast.success('Signed in as admin');
      navigate('/admin', { replace: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sign-in failed';
      toast.error(message);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleContinue}
        className="mt-8 flex w-full items-start gap-4 rounded-2xl border border-[#DDE7E8] bg-white p-4 text-left shadow-sm transition-colors hover:border-[#53B59F] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E6F6F2] text-[#257665]">
          <Shield className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="font-semibold text-[#13334F]">Continue as Covre Ops</div>
          <div className="mt-0.5 text-sm text-[#607583]">
            Open marketplace, incidents, and payment tools (demo).
          </div>
        </div>
      </button>
      <p className="mt-8 text-center text-xs text-[#9AAAB3]">Demo mode. No account required.</p>
    </>
  );
}

function SupabaseAdminEntry() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Email and password are required.');
      return;
    }

    setLoading(true);
    try {
      const result = await signInAdminWithEmail({ email: email.trim(), password });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(result.data.message);
      navigate('/admin', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <p className="mt-3 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-center text-sm leading-relaxed text-[#607583]">
        Admin access is restricted to approved Covre operations accounts. Admin roles are assigned
        outside the app.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 w-full space-y-4">
        <div className="space-y-2">
          <Label htmlFor="admin-email" className="text-[#13334F]">
            Email
          </Label>
          <Input
            id="admin-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="border-[#DDE7E8]"
            disabled={loading}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-password" className="text-[#13334F]">
            Password
          </Label>
          <Input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="border-[#DDE7E8]"
            disabled={loading}
            required
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-[#13334F] hover:bg-[#0B243A]"
        >
          {loading ? 'Signing in…' : 'Sign in to admin console'}
        </Button>
      </form>

      <div className="mt-6 flex flex-col gap-2 text-center text-sm">
        <Link
          to={PROVIDER_ENTRY_PATH}
          onClick={authNavReset}
          className="font-medium text-[#53B59F] hover:text-[#2F8E7A]"
        >
          Facility / provider sign-in
        </Link>
        <Link
          to={WORKER_ENTRY_PATH}
          onClick={authNavReset}
          className="font-medium text-[#53B59F] hover:text-[#2F8E7A]"
        >
          Worker sign-in
        </Link>
      </div>
    </>
  );
}

export default function AuthAdminEntry() {
  const supabaseMode = getBackendMode() === 'supabase';

  useLayoutEffect(() => {
    return runRouteScrollResetPasses();
  }, []);

  return (
    <div
      data-route-scroll-root="true"
      data-route-scroll-container="true"
      className="h-[100dvh] max-h-[100svh] min-h-0 w-full max-w-full overflow-x-hidden overflow-y-auto bg-[#F7FAFA] px-4 py-6 sm:py-10"
    >
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        <div className="mb-8">
          <CovreBrandLogo
            surface="light"
            layout="mark"
            width={80}
            className="mx-auto"
            imgClassName="h-20 w-20 object-contain"
            alt="Covre"
          />
        </div>
        <h1 className="text-center text-2xl font-semibold text-[#13334F]">Admin Login</h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-[#607583]">
          Access the Covre operations console.
        </p>

        {supabaseMode ? <SupabaseAdminEntry /> : <MockAdminEntry />}

        <Link
          to={AUTH_COMPAT_PATH}
          onClick={authNavReset}
          className="mt-8 text-center text-sm font-medium text-[#53B59F] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
        >
          Not an admin? Go to regular login
        </Link>
      </div>
    </div>
  );
}
