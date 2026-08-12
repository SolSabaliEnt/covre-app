import { listWorkerMessages } from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { MessageSquareText } from 'lucide-react';

function LoadingBlock() {
  return (
    <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
      <p className="text-center text-sm text-[#607583]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B243A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
      >
        Retry
      </button>
    </div>
  );
}

export default function WorkerMessages() {
  const { data: threads, error, loading, reload } = useAsyncResource(() => listWorkerMessages(), []);

  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 text-[#10283D]">
      <header className="border-b border-[#DDE7E8] bg-white p-5 sm:p-6">
        <h1 className="text-2xl font-semibold text-[#13334F]">Messages</h1>
        <p className="mt-2 text-sm text-[#607583]">
          Keep shift communication, site updates, and Covre support in one place.
        </p>
      </header>

      <div className="space-y-3 py-4">
        {loading && <LoadingBlock />}
        {error && <ErrorBlock message={error.message} onRetry={reload} />}

        {!loading && !error && threads && (
          <>
            {threads.map(t => (
              <button
                key={t.id}
                type="button"
                className="flex w-full max-w-full items-start gap-3 overflow-hidden rounded-xl border border-[#DDE7E8] bg-white p-4 text-left shadow-sm transition-colors hover:border-[#53B59F]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#E6F6F2] text-[#257665]">
                  <MessageSquareText className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#13334F]">{t.title}</span>
                    <span className="shrink-0 text-xs text-[#607583]">{t.timestamp}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-[#607583]">{t.lastMessage}</p>
                </div>
                {t.unreadCount > 0 && (
                  <span className="flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-full bg-[#53B59F] px-2 text-xs font-semibold text-white">
                    {t.unreadCount > 9 ? '9+' : t.unreadCount}
                  </span>
                )}
              </button>
            ))}
            <p className="rounded-xl border border-dashed border-[#DDE7E8] bg-white px-4 py-3 text-center text-xs text-[#607583]">
              Secure messaging will connect here.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
