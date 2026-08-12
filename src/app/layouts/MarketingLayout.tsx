import { Outlet } from 'react-router';

/**
 * Marketing / landing shell — separate from worker, provider, and admin app experiences.
 */
export function MarketingLayout() {
  return (
    <div
      data-route-scroll-root="true"
      data-route-scroll-container="true"
      className="flex h-[100dvh] max-h-[100svh] min-h-dvh w-full max-w-full flex-col overflow-hidden bg-white"
    >
      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
