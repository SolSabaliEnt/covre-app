import type { ApiResult } from './types';

/**
 * Simulated network latency for the mock API layer.
 * TODO: replace mockRequest with real fetch client — keep ApiResult envelope.
 */

const DEFAULT_DELAY_MS = 220;

export function mockDelay(ms: number = DEFAULT_DELAY_MS): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } };
}

/**
 * Runs a synchronous data handler after an optional delay, wraps success in ApiResult,
 * supports optional random failure for testing, and catches sync errors.
 * TODO: swap implementation for real HTTP; preserve Promise<ApiResult<T>> contract.
 */
export async function mockRequest<T>(
  handler: () => T,
  options?: { delayMs?: number; failRate?: number },
): Promise<ApiResult<T>> {
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
  const failRate = options?.failRate ?? 0;
  await mockDelay(delayMs);
  if (failRate > 0 && Math.random() < failRate) {
    return fail('MOCK_RANDOM', 'Simulated request failure');
  }
  try {
    return ok(handler());
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return fail('HANDLER_ERROR', message);
  }
}
