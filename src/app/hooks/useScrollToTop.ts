import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { useLocation } from 'react-router';
import { resetRouteScrollNow, runRouteScrollResetPasses } from '../utils/scrollReset';

/**
 * App-wide route scroll reset: runs on every navigation (including same-layout tab changes).
 */
export function useScrollToTop(_ref?: RefObject<HTMLElement | null>) {
  const { pathname, search, key } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    const cleanup = runRouteScrollResetPasses();
    return cleanup;
  }, [pathname, search, key]);
}

export { resetRouteScrollNow } from '../utils/scrollReset';
