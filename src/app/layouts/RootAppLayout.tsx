import { Outlet } from 'react-router';
import { useScrollToTop } from '../hooks/useScrollToTop';

/**
 * App-wide route boundary: every screen passes through here so scroll resets once per navigation.
 */
export function RootAppLayout() {
  useScrollToTop();
  return <Outlet />;
}
