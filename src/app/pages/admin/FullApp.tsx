import { useMemo, useState } from 'react';
import { Link } from 'react-router';

type RouteAudience = 'Public' | 'Worker' | 'Provider' | 'Admin';

type RouteEntry = {
  label: string;
  path: string;
  previewPath?: string;
  note?: string;
  dynamic?: 'shift' | 'worker' | 'site' | 'incident';
};

type RouteSection = {
  title: string;
  audience: RouteAudience;
  routes: RouteEntry[];
};

const SECTIONS: RouteSection[] = [
  {
    title: 'Public + entry',
    audience: 'Public',
    routes: [
      { label: 'Landing', path: '/' },
      { label: 'Worker entry', path: '/apply' },
      { label: 'Provider entry', path: '/facillities' },
      { label: 'Facilities alias', path: '/facilities', note: 'Redirects to /facillities.' },
      { label: 'Workspace chooser', path: '/auth' },
      { label: 'Admin sign in', path: '/auth/admin' },
    ],
  },
  {
    title: 'Worker app',
    audience: 'Worker',
    routes: [
      { label: 'Splash', path: '/worker/splash', previewPath: '/admin/full-app/worker/splash' },
      { label: 'Welcome', path: '/worker/welcome', previewPath: '/admin/full-app/worker/welcome' },
      { label: 'Onboarding', path: '/worker/onboarding', previewPath: '/admin/full-app/worker/onboarding' },
      { label: 'Credentials', path: '/worker/credentials', previewPath: '/admin/full-app/worker/credentials' },
      { label: 'Shift feed + continuity', path: '/worker/shifts', previewPath: '/admin/full-app/worker/shifts' },
      { label: 'Shift detail + site history', path: '/worker/shift/:shiftId', previewPath: '/admin/full-app/worker/shift/:shiftId', dynamic: 'shift' },
      { label: 'Bookings', path: '/worker/bookings', previewPath: '/admin/full-app/worker/bookings' },
      { label: 'Active shift', path: '/worker/active-shift', previewPath: '/admin/full-app/worker/active-shift' },
      { label: 'Pay', path: '/worker/pay', previewPath: '/admin/full-app/worker/pay' },
      { label: 'Messages', path: '/worker/messages', previewPath: '/admin/full-app/worker/messages' },
      { label: 'Reputation', path: '/worker/reputation', previewPath: '/admin/full-app/worker/reputation' },
      { label: 'Safety', path: '/worker/safety', previewPath: '/admin/full-app/worker/safety' },
      { label: 'Referrals', path: '/worker/referrals', previewPath: '/admin/full-app/worker/referrals' },
      { label: 'Account', path: '/worker/account', previewPath: '/admin/full-app/worker/account' },
    ],
  },
  {
    title: 'Provider app',
    audience: 'Provider',
    routes: [
      { label: 'Dashboard', path: '/provider', previewPath: '/admin/full-app/provider' },
      { label: 'Onboarding', path: '/provider/onboarding', previewPath: '/admin/full-app/provider/onboarding' },
      { label: 'Post shift', path: '/provider/post-shift', previewPath: '/admin/full-app/provider/post-shift' },
      { label: 'Shifts', path: '/provider/shifts', previewPath: '/admin/full-app/provider/shifts' },
      { label: 'Shift detail', path: '/provider/shifts/:shiftId', previewPath: '/admin/full-app/provider/shifts/:shiftId', dynamic: 'shift' },
      { label: 'Worker match', path: '/provider/worker-match/:shiftId', previewPath: '/admin/full-app/provider/worker-match/:shiftId', dynamic: 'shift' },
      { label: 'Workers', path: '/provider/workers', previewPath: '/admin/full-app/provider/workers' },
      { label: 'Worker profile', path: '/provider/workers/:workerId', previewPath: '/admin/full-app/provider/workers/:workerId', dynamic: 'worker' },
      { label: 'Bench', path: '/provider/bench', previewPath: '/admin/full-app/provider/bench' },
      { label: 'Sites', path: '/provider/sites', previewPath: '/admin/full-app/provider/sites' },
      { label: 'New site', path: '/provider/sites/new', previewPath: '/admin/full-app/provider/sites/new' },
      { label: 'Site detail', path: '/provider/sites/:siteId', previewPath: '/admin/full-app/provider/sites/:siteId', dynamic: 'site' },
      { label: 'Timesheets', path: '/provider/timesheets', previewPath: '/admin/full-app/provider/timesheets' },
      { label: 'Billing', path: '/provider/billing', previewPath: '/admin/full-app/provider/billing' },
      { label: 'Compliance', path: '/provider/compliance', previewPath: '/admin/full-app/provider/compliance' },
      { label: 'Team', path: '/provider/team', previewPath: '/admin/full-app/provider/team' },
      { label: 'Referrals', path: '/provider/referrals', previewPath: '/admin/full-app/provider/referrals' },
      { label: 'Support', path: '/provider/support', previewPath: '/admin/full-app/provider/support' },
      { label: 'Settings', path: '/provider/settings', previewPath: '/admin/full-app/provider/settings' },
      { label: 'More', path: '/provider/more', previewPath: '/admin/full-app/provider/more' },
    ],
  },
  {
    title: 'Admin',
    audience: 'Admin',
    routes: [
      { label: 'Overview', path: '/admin' },
      { label: 'Operations + Continuity', path: '/admin/ops' },
      { label: 'Full App', path: '/admin/full-app' },
      { label: 'Credentials', path: '/admin/credentials' },
      { label: 'Marketplace', path: '/admin/marketplace' },
      { label: 'Shift detail', path: '/admin/shifts/:shiftId', dynamic: 'shift' },
      { label: 'Referrals', path: '/admin/referrals' },
      { label: 'Incidents', path: '/admin/incidents' },
      { label: 'Incident detail', path: '/admin/incidents/:incidentId', dynamic: 'incident' },
      { label: 'Trust & Safety', path: '/admin/trust' },
      { label: 'Payments', path: '/admin/payments' },
      { label: 'Rate Review', path: '/admin/worker-rates' },
      { label: 'Support', path: '/admin/support' },
      { label: 'Users', path: '/admin/users' },
    ],
  },
];

function substituteDynamic(
  path: string,
  kind: RouteEntry['dynamic'],
  ids: { shift: string; worker: string; site: string; incident: string },
) {
  if (!kind) return path;
  const value = ids[kind].trim();
  if (!value) return null;
  if (kind === 'shift') return path.replace(':shiftId', value);
  if (kind === 'worker') return path.replace(':workerId', value);
  if (kind === 'site') return path.replace(':siteId', value);
  return path.replace(':incidentId', value);
}

function audienceNote(audience: RouteAudience) {
  if (audience === 'Worker') return 'Super Admin read-only preview';
  if (audience === 'Provider') return 'Super Admin read-only preview';
  if (audience === 'Admin') return 'Admin session required';
  return 'Public';
}

export default function AdminFullApp() {
  const [shiftId, setShiftId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [incidentId, setIncidentId] = useState('');
  const routeCount = useMemo(
    () => SECTIONS.reduce((total, section) => total + section.routes.length, 0),
    [],
  );
  const ids = { shift: shiftId, worker: workerId, site: siteId, incident: incidentId };

  return (
    <div className="min-h-full bg-[#F7FAFA]">
      <header className="sticky top-0 z-30 border-b border-[#DDE7E8] bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2F8E7A]">
              Super Admin visibility mode
            </p>
            <p className="mt-1 text-sm font-semibold text-[#13334F]">Full App</p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/admin/ops"
              className="rounded-lg border border-[#DDE7E8] bg-white px-3 py-2 text-sm font-semibold text-[#13334F] no-underline hover:bg-[#F7FAFA]"
            >
              Operations
            </Link>
            <Link
              to="/admin"
              className="rounded-lg bg-[#13334F] px-3 py-2 text-sm font-semibold text-white no-underline hover:bg-[#0B243A]"
            >
              Back to admin
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <section className="rounded-2xl border border-[#DDE7E8] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2F8E7A]">
                Canonical route inventory
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#13334F]">
                See the whole Covre product as Super Admin
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#607583]">
                Worker and provider screens open inside a read-only admin preview. The preview does not change your
                authenticated role, and in Supabase mode it does not bypass ownership or RLS. Cross-user live data
                will be added through dedicated admin read models when database access is available.
              </p>
            </div>
            <div className="rounded-xl bg-[#F7FAFA] px-5 py-4 text-center">
              <p className="text-3xl font-semibold text-[#13334F]">{routeCount}</p>
              <p className="text-xs text-[#607583]">documented paths</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['Shift ID', shiftId, setShiftId, 'For shift detail / match routes'],
              ['Worker ID', workerId, setWorkerId, 'For provider worker profiles'],
              ['Site ID', siteId, setSiteId, 'For provider site detail'],
              ['Incident ID', incidentId, setIncidentId, 'For admin incident detail'],
            ].map(([label, value, setter, placeholder]) => (
              <label key={label as string} className="text-xs font-medium text-[#607583]">
                {label as string}
                <input
                  value={value as string}
                  onChange={event => (setter as (value: string) => void)(event.target.value)}
                  placeholder={placeholder as string}
                  className="mt-1 w-full rounded-lg border border-[#DDE7E8] bg-white px-3 py-2.5 text-sm text-[#13334F] outline-none focus:border-[#53B59F] focus:ring-2 focus:ring-[#E6F6F2]"
                />
              </label>
            ))}
          </div>
        </section>

        {SECTIONS.map(section => (
          <section key={section.title} className="overflow-hidden rounded-2xl border border-[#DDE7E8] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DDE7E8] px-5 py-4">
              <h2 className="font-semibold text-[#13334F]">{section.title}</h2>
              <span className="rounded-full bg-[#EEF4F5] px-3 py-1 text-xs font-medium text-[#607583]">
                {audienceNote(section.audience)}
              </span>
            </div>
            <div className="divide-y divide-[#EEF4F5]">
              {section.routes.map(route => {
                const target = route.previewPath ?? route.path;
                const resolvedPath = substituteDynamic(target, route.dynamic, ids);
                return (
                  <div key={`${section.title}-${route.path}`} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#13334F]">{route.label}</p>
                      <p className="mt-1 break-all font-mono text-xs text-[#607583]">{route.path}</p>
                      {route.previewPath ? (
                        <p className="mt-1 break-all text-xs font-medium text-[#2F8E7A]">Preview: {route.previewPath}</p>
                      ) : null}
                      {route.note ? <p className="mt-1 text-xs text-[#9AAAB3]">{route.note}</p> : null}
                    </div>
                    {resolvedPath ? (
                      <Link
                        to={resolvedPath}
                        className="shrink-0 rounded-lg border border-[#DDE7E8] bg-white px-3 py-2 text-sm font-semibold text-[#13334F] no-underline hover:bg-[#F7FAFA]"
                      >
                        {route.previewPath ? 'Open preview' : 'Open route'}
                      </Link>
                    ) : (
                      <span className="shrink-0 rounded-lg bg-[#F7FAFA] px-3 py-2 text-xs font-medium text-[#9AAAB3]">
                        Add ID above
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
