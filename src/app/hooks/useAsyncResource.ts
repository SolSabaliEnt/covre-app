import { useEffect, useRef, useState, useCallback, type DependencyList } from 'react';
import type { ApiError, ApiResult } from '../api/types';

type AsyncResourceState<T> = {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
};

/**
 * Runs an async service loader once on mount and when `deps` or `reload()` change.
 * Ignores late responses after unmount to avoid setState on unmounted components.
 */
export function useAsyncResource<T>(loader: () => Promise<ApiResult<T>>, deps: DependencyList): AsyncResourceState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const result = await loaderRef.current();
      if (cancelled) return;
      if (result.ok) {
        setData(result.data);
      } else {
        setError(result.error);
        setData(undefined);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [...deps, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken(t => t + 1);
  }, []);

  return { data, error, loading, reload };
}
