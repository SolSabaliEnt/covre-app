import { Link, useRouteError } from 'react-router';

export default function AppRouteError() {
  const error = useRouteError();
  const detail =
    error && typeof error === 'object' && 'statusText' in error && typeof error.statusText === 'string'
      ? error.statusText
      : error instanceof Error
        ? error.message
        : null;

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 bg-[#F7FAFA] px-6 py-12 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold text-[#13334F]">Something went wrong</h1>
        <p className="text-sm leading-relaxed text-[#607583]">
          Refresh the page or return home.
          {detail ? (
            <span className="mt-2 block text-xs text-[#9AAAB3]">{detail}</span>
          ) : null}
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Link
          to="/"
          className="flex min-h-12 items-center justify-center rounded-xl bg-[#53B59F] px-4 py-3 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#2F8E7A]"
        >
          Return home
        </Link>
        <Link
          to="/auth"
          className="flex min-h-12 items-center justify-center rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm font-semibold text-[#13334F] no-underline shadow-sm transition-colors hover:border-[#53B59F]/50"
        >
          Switch workspace
        </Link>
      </div>
    </div>
  );
}
