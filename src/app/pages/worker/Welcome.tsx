import { CovreBrandLogo } from '../../components/CovreBrandLogo';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';

export default function Welcome() {
  return (
    <div className="flex min-h-[100svh] w-full max-w-full flex-col overflow-x-hidden bg-white px-6 pt-10 pb-[calc(2rem+env(safe-area-inset-bottom))] text-[#10283D]">
      <div className="flex flex-col items-center px-1 pt-6 text-center">
        <CovreBrandLogo surface="light" markSize={80} className="mb-8" />

        <h1 className="mb-4 text-3xl font-semibold text-[#13334F]">
          Flexible care shifts, covered.
        </h1>

        <p className="max-w-sm text-[#607583]">
          Find verified shifts, get paid quickly, and build your care-work reputation.
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-12">
        <Link
          to="/worker/onboarding"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#53B59F] px-6 py-4 font-medium text-white transition-colors hover:bg-[#2F8E7A]"
        >
          Get Started
          <ArrowRight className="h-5 w-5" />
        </Link>

        <Link
          to="/worker/shifts"
          className="flex w-full items-center justify-center rounded-xl bg-[#E8EEF2] px-6 py-4 font-medium text-[#13334F] transition-colors hover:bg-[#DDE7E8]"
        >
          I already have an account
        </Link>
      </div>
    </div>
  );
}
