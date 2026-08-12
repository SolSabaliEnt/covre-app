import { ArrowRight, CheckCircle2, Shield, Clock, FileCheck, Users, Building2, Home, Heart, Brain, Stethoscope } from 'lucide-react';
import { Link } from 'react-router';
import { ADMIN_ENTRY_PATH, PROVIDER_ENTRY_PATH, WORKER_ENTRY_PATH } from '../lib/entryRoutes';
import {
  LANDING_LOGO_FOOTER_CLASS,
  LANDING_LOGO_HERO_CLASS,
  LANDING_LOGO_SRC,
} from '../lib/brand';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative flex flex-col overflow-hidden bg-[#13334F] text-white lg:min-h-dvh">
        <div className="pointer-events-none absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,.05) 35px, rgba(255,255,255,.05) 70px)',
            }}
          />
        </div>

        <div className="relative mx-auto flex w-full max-w-7xl flex-col px-6 pb-12 pt-8 lg:flex-1 lg:pt-10">
          {/* Logo + sign-in — lightweight header */}
          <div className="mb-6 flex min-w-0 items-start justify-between gap-3 sm:mb-10 md:items-center md:gap-4 lg:mb-12">
            <Link to="/" className="block min-w-0 max-w-[72%] shrink sm:max-w-none">
              <img
                src={LANDING_LOGO_SRC}
                alt="Covre"
                width={906}
                height={209}
                loading="eager"
                decoding="async"
                className={LANDING_LOGO_HERO_CLASS}
              />
            </Link>
            <nav
              className="mt-0.5 flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2"
              aria-label="Sign in"
            >
              <Link
                to="/auth"
                className="inline-flex min-h-11 min-w-[44px] items-center justify-center rounded-lg border border-white/40 bg-white/5 px-3 py-2 text-xs font-medium text-white shadow-sm backdrop-blur-sm transition-colors hover:border-white/60 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-3.5 sm:text-sm"
              >
                Log in
              </Link>
              <Link
                to={ADMIN_ENTRY_PATH}
                className="inline-flex min-h-11 min-w-[44px] items-center justify-center rounded-lg px-2.5 py-2 text-xs font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-3 sm:text-sm"
              >
                <span className="sm:hidden" aria-label="Admin login">
                  Admin
                </span>
                <span className="hidden sm:inline">Admin Login</span>
              </Link>
            </nav>
          </div>

          <div className="grid grid-cols-1 items-start gap-8 lg:flex-1 lg:grid-cols-2 lg:items-center lg:gap-12">
            <div>
              <h1 className="text-[44px] font-bold leading-[0.98] text-white sm:text-5xl sm:leading-[0.95] lg:text-6xl lg:leading-[0.95]">
                Care staffing.
                <br />
                Covered.
              </h1>
              <p className="mt-6 max-w-none text-xl leading-[1.55] text-white/90 md:mt-8 md:max-w-prose">
                Connect with verified care professionals for residential care, long-term care, and
                community-based care shifts.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:mt-10 sm:flex-row">
                <Link
                  to={PROVIDER_ENTRY_PATH}
                  className="flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-lg bg-[#53B59F] px-8 py-4 text-center text-white shadow-lg transition-colors hover:bg-[#2F8E7A] sm:w-auto"
                >
                  Post a Shift
                  <ArrowRight className="h-5 w-5 shrink-0" />
                </Link>
                <Link
                  to={WORKER_ENTRY_PATH}
                  className="flex min-h-[3rem] w-full items-center justify-center rounded-lg border border-[#244965] bg-[#244965] px-8 py-4 text-center text-white transition-colors hover:bg-[#13334F] sm:w-auto"
                >
                  Apply for shifts
                </Link>
              </div>
              <div className="mt-6 text-sm text-[#E8EEF2] sm:mt-8">
                Verified care workers. Covered shifts.
              </div>
            </div>

            {/* Hero Visual — flows after copy on mobile; full min-height hero on lg+ */}
            <div className="relative mx-auto mt-10 w-full max-w-md lg:mx-0 lg:mt-0 lg:max-w-none">
              <div className="rotate-1 transform rounded-2xl bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E6F6F2]">
                    <CheckCircle2 className="h-6 w-6 text-[#257665]" />
                  </div>
                  <div>
                    <div className="text-sm text-[#607583]">Shift Status</div>
                    <div className="font-semibold text-[#13334F]">Covered</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#607583]">Fill Rate</span>
                    <span className="font-semibold text-[#13334F]">94.2%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#EEF4F5]">
                    <div className="h-full bg-[#53B59F]" style={{ width: '94.2%' }} />
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -left-4 max-w-[11rem] -rotate-2 transform rounded-2xl bg-white p-4 shadow-xl">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E6F6F2]">
                    <Shield className="h-4 w-4 text-[#257665]" />
                  </div>
                  <div className="text-sm font-semibold text-[#13334F]">Verified</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For Providers Section */}
      <section className="py-20 bg-[#F7FAFA]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-semibold text-[#13334F] mb-4">For Providers</h2>
            <p className="text-xl text-[#607583]">Fill open shifts with verified, reliable workers.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            <FeatureCard
              icon={<Users className="w-6 h-6" />}
              title="Post shifts"
              description="Create shift requests with specific requirements and credentials"
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Review credentials"
              description="Verify worker qualifications with our credential passport system"
            />
            <FeatureCard
              icon={<Heart className="w-6 h-6" />}
              title="Build your bench"
              description="Maintain a trusted pool of preferred care workers"
            />
            <FeatureCard
              icon={<CheckCircle2 className="w-6 h-6" />}
              title="Approve time"
              description="Simple timesheet approval with detailed shift records"
            />
            <FeatureCard
              icon={<FileCheck className="w-6 h-6" />}
              title="Download compliance packets"
              description="Complete audit documentation for every shift"
            />
          </div>
        </div>
      </section>

      {/* For Workers Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-semibold text-[#13334F] mb-4">For Workers</h2>
            <p className="text-xl text-[#607583]">Flexible care work with trust, transparency, and fast pay.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            <FeatureCard
              icon={<Building2 className="w-6 h-6" />}
              title="Find shifts"
              description="Browse available opportunities that match your skills"
              accent
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Get verified"
              description="Upload credentials once, use everywhere"
              accent
            />
            <FeatureCard
              icon={<FileCheck className="w-6 h-6" />}
              title="Know before you go"
              description="Facility orientation and expectations upfront"
              accent
            />
            <FeatureCard
              icon={<Clock className="w-6 h-6" />}
              title="Get paid"
              description="Fast payouts with instant pay options available"
              accent
            />
            <FeatureCard
              icon={<CheckCircle2 className="w-6 h-6" />}
              title="Build your reputation"
              description="Earn your Covre Score with every quality shift"
              accent
            />
          </div>
        </div>
      </section>

      {/* The Covre Difference */}
      <section className="py-20 bg-[#E8EEF2]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-semibold text-[#13334F] mb-4">The Covre Difference</h2>
            <p className="text-xl text-[#607583]">Built for the realities of care work.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <DifferenceCard
              title="Credential Passport"
              description="Centralized verification system that follows workers across all shifts"
            />
            <DifferenceCard
              title="Facility Orientation"
              description="Site-specific preparation so workers arrive ready and informed"
            />
            <DifferenceCard
              title="Preferred Bench"
              description="Build relationships with trusted workers who know your facility"
            />
            <DifferenceCard
              title="Site Familiarity"
              description="Track and reward workers who become familiar with your operations"
            />
            <DifferenceCard
              title="Shift Risk Scoring"
              description="Intelligent matching to reduce no-shows and ensure quality coverage"
            />
            <DifferenceCard
              title="Compliance Packets"
              description="Complete audit documentation generated automatically for every shift"
            />
            <DifferenceCard
              title="Worker Safety Reports"
              description="Confidential reporting system for workplace concerns and incidents"
            />
            <DifferenceCard
              title="Fast Payouts"
              description="Get workers paid quickly with instant pay and standard ACH options"
            />
          </div>

          <div className="mt-16 bg-white rounded-2xl p-8 lg:p-12 shadow-lg">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-2xl text-[#13334F] leading-relaxed">
                "Every shift needs more than a warm body. It needs the right person, prepared for the setting."
              </p>
              <div className="mt-6 text-[#607583]">
                Built for the realities of care work
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Care Settings Served */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-semibold text-[#13334F] mb-4">Care Settings Served</h2>
            <p className="text-xl text-[#607583]">Supporting diverse care environments across the continuum</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <CareSettingBadge icon={<Home className="w-5 h-5" />} text="Residential care" />
            <CareSettingBadge icon={<Building2 className="w-5 h-5" />} text="Group homes" />
            <CareSettingBadge icon={<Heart className="w-5 h-5" />} text="Assisted living" />
            <CareSettingBadge icon={<Brain className="w-5 h-5" />} text="Memory care" />
            <CareSettingBadge icon={<Stethoscope className="w-5 h-5" />} text="Long-term care" />
            <CareSettingBadge icon={<Home className="w-5 h-5" />} text="Home care" />
            <CareSettingBadge icon={<Brain className="w-5 h-5" />} text="Behavioral health residential" />
            <CareSettingBadge icon={<Heart className="w-5 h-5" />} text="IDD support providers" />
            <CareSettingBadge icon={<Stethoscope className="w-5 h-5" />} text="Skilled nursing" />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-[#13334F] text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl lg:text-5xl font-semibold mb-6">Ready to get covered?</h2>
          <p className="text-xl text-[#E8EEF2] mb-10">
            Join the care staffing platform built for reliability, trust, and operational excellence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to={PROVIDER_ENTRY_PATH} className="px-10 py-4 bg-[#53B59F] text-white rounded-lg hover:bg-[#2F8E7A] transition-colors shadow-lg">
              For facilities
            </Link>
            <Link to={WORKER_ENTRY_PATH} className="px-10 py-4 bg-transparent text-white rounded-lg hover:bg-[#244965] transition-colors border-2 border-white">
              Apply for shifts
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0B243A] py-10 text-white md:py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-6 md:items-start">
          <img
            src={LANDING_LOGO_SRC}
            alt="Covre"
            width={906}
            height={209}
            loading="lazy"
            decoding="async"
            className={LANDING_LOGO_FOOTER_CLASS}
          />
          <p className="text-center text-sm text-[#9AAAB3] md:text-left">
            © 2026 Covre. Verified care workers. Covered shifts.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, accent = false }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent?: boolean;
}) {
  return (
    <div className={`p-6 rounded-xl border ${accent ? 'bg-[#F3FBF8] border-[#E6F6F2]' : 'bg-white border-[#DDE7E8]'} hover:shadow-lg transition-shadow`}>
      <div className={`w-12 h-12 rounded-lg ${accent ? 'bg-[#E6F6F2]' : 'bg-[#E8EEF2]'} flex items-center justify-center mb-4`}>
        <div className={accent ? 'text-[#257665]' : 'text-[#13334F]'}>
          {icon}
        </div>
      </div>
      <h3 className="font-semibold text-[#13334F] mb-2">{title}</h3>
      <p className="text-sm text-[#607583] leading-relaxed">{description}</p>
    </div>
  );
}

function DifferenceCard({ title, description }: {
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white p-6 rounded-xl border border-[#DDE7E8] hover:border-[#53B59F] transition-all hover:shadow-md">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-[#53B59F] flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-[#13334F] mb-1">{title}</h3>
          <p className="text-sm text-[#607583] leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}

function CareSettingBadge({ icon, text }: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-[#F7FAFA] border border-[#DDE7E8] rounded-lg hover:border-[#53B59F] hover:bg-[#F3FBF8] transition-all">
      <div className="text-[#53B59F]">
        {icon}
      </div>
      <span className="text-sm text-[#13334F]">{text}</span>
    </div>
  );
}
