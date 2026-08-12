import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Download, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { getProviderSite } from '../../services';
import { useAsyncResource } from '../../hooks/useAsyncResource';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#DDE7E8] bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#607583]">{title}</h2>
      {children}
    </section>
  );
}

function NotFoundCard() {
  return (
    <div className="min-h-full bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto max-w-lg rounded-2xl border border-[#DDE7E8] bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-[#13334F]">Site not found</h1>
        <p className="mt-2 text-sm text-[#607583]">
          This care site was not found for your organization.
        </p>
        <Link
          to="/provider/sites"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to care sites
        </Link>
      </div>
    </div>
  );
}

export default function SiteDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useAsyncResource(
    () => (!id ? Promise.resolve({ ok: true as const, data: null }) : getProviderSite(id)),
    [id],
  );

  if (loading) {
    return (
      <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 pb-8">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
          <p className="text-center text-sm font-medium text-[#13334F]">Loading…</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 pb-8">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#DDE7E8] bg-white p-8 shadow-sm">
          <p className="text-center text-sm text-[#607583]">{error.message}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-4 w-full rounded-xl bg-[#13334F] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0B243A]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (!data) {
    return <NotFoundCard />;
  }

  const { site, operational: detail, benchNames } = data;

  return (
    <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-[#F7FAFA] px-4 py-6 pb-8">
      <div className="mx-auto w-full min-w-0 max-w-full space-y-6">
        <header className="space-y-2">
          <Link
            to="/provider/sites"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#53B59F] hover:text-[#2F8E7A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back to care sites
          </Link>
          <div>
            <h1 className="break-words text-2xl font-semibold text-[#13334F]">{site.name}</h1>
            <p className="mt-1 text-sm text-[#607583]">{site.facilityType}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => toast('Site editing coming soon')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#13334F] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#0B243A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              Edit Site
            </button>
            <button
              type="button"
              onClick={() => toast.success('Site packet prepared')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DDE7E8] bg-white px-4 py-3 text-sm font-medium text-[#13334F] shadow-sm transition-colors hover:bg-[#F7FAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#53B59F]"
            >
              <Download className="h-4 w-4 shrink-0 text-[#53B59F]" aria-hidden />
              Download Site Packet
            </button>
          </div>
        </header>

        <Section title="Site overview">
          <p className="text-sm leading-relaxed text-[#10283D]">{detail.overview}</p>
        </Section>

        <Section title="Contacts">
          <ul className="space-y-3">
            {detail.contacts.map(c => (
              <li key={c.phone} className="flex flex-col border-b border-[#F7FAFA] pb-3 last:border-0 last:pb-0">
                <span className="text-xs font-medium uppercase tracking-wide text-[#607583]">{c.role}</span>
                <span className="font-medium text-[#13334F]">{c.name}</span>
                <a href={`tel:${c.phone.replace(/\D/g, '')}`} className="text-sm text-[#53B59F] hover:text-[#2F8E7A]">
                  {c.phone}
                </a>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Orientation">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-[#10283D]">
            {detail.orientation.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </Section>

        <Section title="Required credentials">
          <ul className="space-y-1.5">
            {detail.credentialRequirements.map(line => (
              <li key={line} className="flex items-start gap-2 text-sm text-[#10283D]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#53B59F]" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="House rules">
          <ul className="space-y-1.5">
            {detail.houseRules.map(line => (
              <li key={line} className="text-sm text-[#10283D]">
                {line}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Emergency protocol">
          <ul className="space-y-1.5">
            {detail.emergency.map(line => (
              <li key={line} className="text-sm text-[#10283D]">
                {line}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Preferred bench">
          <p className="mb-2 text-sm text-[#607583]">
            Workers with standing preference for this site.
          </p>
          <div className="flex flex-wrap gap-2">
            {benchNames.map(name => (
              <span
                key={name}
                className="rounded-full border border-[#DDE7E8] bg-[#F7FAFA] px-3 py-1 text-xs font-medium text-[#13334F]"
              >
                {name}
              </span>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
