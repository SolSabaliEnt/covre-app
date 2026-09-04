import { createBrowserRouter, Navigate } from 'react-router';
import { FACILITIES_ALIAS_PATH, PROVIDER_ENTRY_PATH, WORKER_ENTRY_PATH } from './lib/entryRoutes';
import AppRouteError from './components/AppRouteError';
import { AdminPreviewFrame } from './components/AdminPreviewFrame';
import { RootAppLayout } from './layouts/RootAppLayout';
import { MarketingLayout } from './layouts/MarketingLayout';
import { WorkerAppShell } from './layouts/WorkerAppShell';
import { ProviderAppShell } from './layouts/ProviderAppShell';
import { AdminAppShell } from './layouts/AdminAppShell';
import { AdminProtectedRoute } from './auth/AdminProtectedRoute';
import { ProtectedRoute } from './auth/ProtectedRoute';
import Landing from './pages/Landing';
import AuthEntry from './pages/AuthEntry';
import AuthAdminEntry from './pages/AuthAdminEntry';
import WorkerSplash from './pages/worker/Splash';
import WorkerWelcome from './pages/worker/Welcome';
import WorkerOnboarding from './pages/worker/Onboarding';
import WorkerCredentials from './pages/worker/Credentials';
import WorkerShiftFeed from './pages/worker/ShiftFeed';
import WorkerBookings from './pages/worker/Bookings';
import WorkerMessages from './pages/worker/Messages';
import WorkerAccount from './pages/worker/Account';
import WorkerShiftDetail from './pages/worker/ShiftDetail';
import WorkerActiveShift from './pages/worker/ActiveShift';
import WorkerPay from './pages/worker/Pay';
import WorkerReputation from './pages/worker/Reputation';
import WorkerSafetyReport from './pages/worker/SafetyReport';
import WorkerReferrals from './pages/worker/Referrals';
import ProviderDashboard from './pages/provider/Dashboard';
import ProviderPostShift from './pages/provider/PostShift';
import ProviderShiftManagement from './pages/provider/ShiftManagement';
import ProviderShiftDetail from './pages/provider/ShiftDetail';
import ProviderWorkerMatch from './pages/provider/WorkerMatch';
import ProviderWorkers from './pages/provider/Workers';
import ProviderBench from './pages/provider/Bench';
import ProviderMore from './pages/provider/More';
import ProviderTimesheets from './pages/provider/Timesheets';
import ProviderBilling from './pages/provider/Billing';
import ProviderSites from './pages/provider/Sites';
import ProviderNewSite from './pages/provider/NewSite';
import ProviderOnboarding from './pages/provider/Onboarding';
import ProviderSiteDetail from './pages/provider/SiteDetail';
import ProviderCompliance from './pages/provider/Compliance';
import ProviderSupport from './pages/provider/Support';
import ProviderSettings from './pages/provider/Settings';
import ProviderWorkerProfile from './pages/provider/WorkerProfile';
import ProviderReferrals from './pages/provider/Referrals';
import ProviderTeam from './pages/provider/Team';
import AdminDashboard from './pages/admin/Dashboard';
import AdminOperations from './pages/admin/Operations';
import AdminFullApp from './pages/admin/FullApp';
import AdminCredentials from './pages/admin/Credentials';
import AdminMarketplace from './pages/admin/Marketplace';
import AdminIncidents from './pages/admin/Incidents';
import AdminIncidentDetail from './pages/admin/IncidentDetail';
import AdminTrustSafety from './pages/admin/TrustSafety';
import AdminPayments from './pages/admin/Payments';
import AdminWorkerRates from './pages/admin/WorkerRates';
import AdminSupport from './pages/admin/Support';
import AdminShiftDetail from './pages/admin/ShiftDetail';
import AdminUsers from './pages/admin/Users';
import AdminReferrals from './pages/admin/Referrals';

const workerProtectedRoute = {
  element: <ProtectedRoute allowedRoles={['worker']} />,
  children: [
    { path: 'onboarding', Component: WorkerOnboarding },
    { path: 'credentials', Component: WorkerCredentials },
    { path: 'shifts', Component: WorkerShiftFeed },
    { path: 'bookings', Component: WorkerBookings },
    { path: 'messages', Component: WorkerMessages },
    { path: 'account', Component: WorkerAccount },
    { path: 'shift/:id', Component: WorkerShiftDetail },
    { path: 'active-shift', Component: WorkerActiveShift },
    { path: 'pay', Component: WorkerPay },
    { path: 'reputation', Component: WorkerReputation },
    { path: 'safety', Component: WorkerSafetyReport },
    { path: 'referrals', Component: WorkerReferrals },
  ],
};

const providerProtectedRoute = {
  element: <ProtectedRoute allowedRoles={['provider']} />,
  children: [
    {
      Component: ProviderAppShell,
      children: [
        { index: true, Component: ProviderDashboard },
        { path: 'post-shift', Component: ProviderPostShift },
        { path: 'shifts', Component: ProviderShiftManagement },
        { path: 'shifts/:id', Component: ProviderShiftDetail },
        { path: 'worker-match/:shiftId', Component: ProviderWorkerMatch },
        { path: 'workers', Component: ProviderWorkers },
        { path: 'workers/:workerId', Component: ProviderWorkerProfile },
        { path: 'bench', Component: ProviderBench },
        { path: 'more', Component: ProviderMore },
        { path: 'onboarding', Component: ProviderOnboarding },
        { path: 'sites', Component: ProviderSites },
        { path: 'sites/new', Component: ProviderNewSite },
        { path: 'sites/:id', Component: ProviderSiteDetail },
        { path: 'compliance', Component: ProviderCompliance },
        { path: 'support', Component: ProviderSupport },
        { path: 'settings', Component: ProviderSettings },
        { path: 'team', Component: ProviderTeam },
        { path: 'timesheets', Component: ProviderTimesheets },
        { path: 'billing', Component: ProviderBilling },
        { path: 'referrals', Component: ProviderReferrals },
      ],
    },
  ],
};

const adminWorkerPreviewRoutes = [
  { path: 'full-app/worker/splash', element: <AdminPreviewFrame audience="Worker"><WorkerSplash /></AdminPreviewFrame> },
  { path: 'full-app/worker/welcome', element: <AdminPreviewFrame audience="Worker"><WorkerWelcome /></AdminPreviewFrame> },
  { path: 'full-app/worker/onboarding', element: <AdminPreviewFrame audience="Worker"><WorkerOnboarding /></AdminPreviewFrame> },
  { path: 'full-app/worker/credentials', element: <AdminPreviewFrame audience="Worker"><WorkerCredentials /></AdminPreviewFrame> },
  { path: 'full-app/worker/shifts', element: <AdminPreviewFrame audience="Worker"><WorkerShiftFeed /></AdminPreviewFrame> },
  { path: 'full-app/worker/shift/:id', element: <AdminPreviewFrame audience="Worker"><WorkerShiftDetail /></AdminPreviewFrame> },
  { path: 'full-app/worker/bookings', element: <AdminPreviewFrame audience="Worker"><WorkerBookings /></AdminPreviewFrame> },
  { path: 'full-app/worker/active-shift', element: <AdminPreviewFrame audience="Worker"><WorkerActiveShift /></AdminPreviewFrame> },
  { path: 'full-app/worker/pay', element: <AdminPreviewFrame audience="Worker"><WorkerPay /></AdminPreviewFrame> },
  { path: 'full-app/worker/messages', element: <AdminPreviewFrame audience="Worker"><WorkerMessages /></AdminPreviewFrame> },
  { path: 'full-app/worker/reputation', element: <AdminPreviewFrame audience="Worker"><WorkerReputation /></AdminPreviewFrame> },
  { path: 'full-app/worker/safety', element: <AdminPreviewFrame audience="Worker"><WorkerSafetyReport /></AdminPreviewFrame> },
  { path: 'full-app/worker/referrals', element: <AdminPreviewFrame audience="Worker"><WorkerReferrals /></AdminPreviewFrame> },
  { path: 'full-app/worker/account', element: <AdminPreviewFrame audience="Worker"><WorkerAccount /></AdminPreviewFrame> },
];

const adminProviderPreviewRoutes = [
  { path: 'full-app/provider', element: <AdminPreviewFrame audience="Provider"><ProviderDashboard /></AdminPreviewFrame> },
  { path: 'full-app/provider/onboarding', element: <AdminPreviewFrame audience="Provider"><ProviderOnboarding /></AdminPreviewFrame> },
  { path: 'full-app/provider/post-shift', element: <AdminPreviewFrame audience="Provider"><ProviderPostShift /></AdminPreviewFrame> },
  { path: 'full-app/provider/shifts', element: <AdminPreviewFrame audience="Provider"><ProviderShiftManagement /></AdminPreviewFrame> },
  { path: 'full-app/provider/shifts/:id', element: <AdminPreviewFrame audience="Provider"><ProviderShiftDetail /></AdminPreviewFrame> },
  { path: 'full-app/provider/worker-match/:shiftId', element: <AdminPreviewFrame audience="Provider"><ProviderWorkerMatch /></AdminPreviewFrame> },
  { path: 'full-app/provider/workers', element: <AdminPreviewFrame audience="Provider"><ProviderWorkers /></AdminPreviewFrame> },
  { path: 'full-app/provider/workers/:workerId', element: <AdminPreviewFrame audience="Provider"><ProviderWorkerProfile /></AdminPreviewFrame> },
  { path: 'full-app/provider/bench', element: <AdminPreviewFrame audience="Provider"><ProviderBench /></AdminPreviewFrame> },
  { path: 'full-app/provider/sites', element: <AdminPreviewFrame audience="Provider"><ProviderSites /></AdminPreviewFrame> },
  { path: 'full-app/provider/sites/new', element: <AdminPreviewFrame audience="Provider"><ProviderNewSite /></AdminPreviewFrame> },
  { path: 'full-app/provider/sites/:id', element: <AdminPreviewFrame audience="Provider"><ProviderSiteDetail /></AdminPreviewFrame> },
  { path: 'full-app/provider/timesheets', element: <AdminPreviewFrame audience="Provider"><ProviderTimesheets /></AdminPreviewFrame> },
  { path: 'full-app/provider/billing', element: <AdminPreviewFrame audience="Provider"><ProviderBilling /></AdminPreviewFrame> },
  { path: 'full-app/provider/compliance', element: <AdminPreviewFrame audience="Provider"><ProviderCompliance /></AdminPreviewFrame> },
  { path: 'full-app/provider/team', element: <AdminPreviewFrame audience="Provider"><ProviderTeam /></AdminPreviewFrame> },
  { path: 'full-app/provider/referrals', element: <AdminPreviewFrame audience="Provider"><ProviderReferrals /></AdminPreviewFrame> },
  { path: 'full-app/provider/support', element: <AdminPreviewFrame audience="Provider"><ProviderSupport /></AdminPreviewFrame> },
  { path: 'full-app/provider/settings', element: <AdminPreviewFrame audience="Provider"><ProviderSettings /></AdminPreviewFrame> },
  { path: 'full-app/provider/more', element: <AdminPreviewFrame audience="Provider"><ProviderMore /></AdminPreviewFrame> },
];

const adminProtectedRoute = {
  element: <AdminProtectedRoute />,
  children: [
    {
      Component: AdminAppShell,
      children: [
        { index: true, Component: AdminDashboard },
        { path: 'ops', Component: AdminOperations },
        { path: 'full-app', Component: AdminFullApp },
        ...adminWorkerPreviewRoutes,
        ...adminProviderPreviewRoutes,
        { path: 'credentials', Component: AdminCredentials },
        { path: 'marketplace', Component: AdminMarketplace },
        { path: 'incidents', Component: AdminIncidents },
        { path: 'incidents/:id', Component: AdminIncidentDetail },
        { path: 'trust', Component: AdminTrustSafety },
        { path: 'payments', Component: AdminPayments },
        { path: 'worker-rates', Component: AdminWorkerRates },
        { path: 'support', Component: AdminSupport },
        { path: 'users', Component: AdminUsers },
        { path: 'shifts/:id', Component: AdminShiftDetail },
        { path: 'referrals', Component: AdminReferrals },
      ],
    },
  ],
};

export const router = createBrowserRouter([
  {
    Component: RootAppLayout,
    errorElement: <AppRouteError />,
    children: [
      {
        path: '/',
        Component: MarketingLayout,
        children: [{ index: true, Component: Landing }],
      },
      {
        path: '/landing',
        Component: MarketingLayout,
        children: [{ index: true, Component: Landing }],
      },
      { path: WORKER_ENTRY_PATH, Component: AuthEntry },
      { path: PROVIDER_ENTRY_PATH, Component: AuthEntry },
      {
        path: FACILITIES_ALIAS_PATH,
        element: <Navigate to={PROVIDER_ENTRY_PATH} replace />,
      },
      { path: '/auth', Component: AuthEntry },
      { path: '/auth/admin', Component: AuthAdminEntry },
      {
        path: '/worker',
        Component: WorkerAppShell,
        children: [
          { path: 'splash', Component: WorkerSplash },
          { path: 'welcome', Component: WorkerWelcome },
          workerProtectedRoute,
        ],
      },
      {
        path: '/provider',
        ...providerProtectedRoute,
      },
      {
        path: '/admin',
        ...adminProtectedRoute,
      },
    ],
  },
]);
