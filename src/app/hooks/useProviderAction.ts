import { useCallback, useState } from 'react';
import type { ApiResult } from '../api/types';

/**
 * Minimal pending guard for provider mock actions (single in-flight key at a time per hook instance).
 */
export function useProviderAction() {
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const run = useCallback(async <T,>(key: string, fn: () => Promise<ApiResult<T>>): Promise<ApiResult<T>> => {
    setPendingKey(key);
    try {
      return await fn();
    } finally {
      setPendingKey(null);
    }
  }, []);

  const isPending = useCallback((key: string) => pendingKey === key, [pendingKey]);

  return { run, isPending };
}
