/** Shared API response envelope for the mock adapter and future HTTP client. */

export type ApiError = {
  code: string;
  message: string;
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export type ApiListResult<T> = ApiResult<T[]>;

export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';
