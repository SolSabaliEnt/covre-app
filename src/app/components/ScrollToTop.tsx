import { useScrollToTop } from '../hooks/useScrollToTop';

/**
 * Renders nothing. Prefer `RootAppLayout` + `useScrollToTop` for app-wide resets.
 */
export function ScrollToTop() {
  useScrollToTop();
  return null;
}
