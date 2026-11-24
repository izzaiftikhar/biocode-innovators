"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* ---- Edit these if your routes / assets differ ---- */
const LOGO_SRC = "/images/biocode-logo-circle.png";
const JOIN_HREF = "/community";

const SOCIALS = {
  instagram: "https://www.instagram.com/biocodeinnovators/",
  linkedin: "https://www.linkedin.com/company/biocode-innovators/",
  youtube: "https://www.youtube.com/@BIOCODEINNOVATORS",
};
const EMAIL = "biocodeinnovators13@gmail.com";

const EXPLORE = [
  { label: "Research", href: "/research" },
  { label: "Courses", href: "/courses" },
  { label: "Student Journal", href: "/student-journal" },
];

const PROGRAMS = [
  { label: "Fellowship", href: "/fellowship" },
  { label: "Internships", href: "/internships" },
];

const LEGAL = [
  { label: "Privacy", href: "/privacy" },
  { label: "Feedback", href: "/feedback" },
  { label: "Terms", href: "/terms" },
  { label: "Accessibility", href: "/accessibility" },
];

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5.5" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.3" cy="6.7" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="5.4" cy="5.2" r="1.5" fill="currentColor" stroke="none" />
      <path d="M4.2 9.6v10M9.4 19.6v-10M9.4 13.4c0-2.3 1.5-3.9 3.8-3.9s3.5 1.5 3.5 3.9v6.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="2.5" y="5.5" width="19" height="13" rx="4.2" />
      <path d="M10.2 9.4v5.2l4.4-2.6z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="2.8" y="5" width="18.4" height="14" rx="2.6" />
      <path d="M3.5 7.2l8.5 6 8.5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Coded seal used automatically if the logo image can't be loaded */
function SealFallback() {
  const rungs = [24, 30, 36, 42, 48, 54, 60, 66, 72];
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Biocode Innovators logo">
      <circle cx="50" cy="50" r="48" fill="#FFFFFF" />
      <circle cx="50" cy="50" r="43" fill="#0B1F4D" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#22D3EE" strokeOpacity="0.55" strokeWidth="1" />
      {rungs.map((y, i) => {
        const w = 14 * Math.abs(Math.cos((i / 8) * Math.PI * 1.5 + 0.4)) + 2;
        return (
          <line key={y} x1={50 - w} y1={y} x2={50 + w} y2={y} stroke="#67E8F9" strokeOpacity="0.8" strokeWidth="1.3" strokeLinecap="round" />
        );
      })}
      <path d="M38 22 C 66 34, 34 46, 62 58 S 40 76, 50 80" fill="none" stroke="#22D3EE" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M62 22 C 34 34, 66 46, 38 58 S 60 76, 50 80" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function Logo() {
  const [failed, setFailed] = useState(false);
  return (
    <span className="flex h-[58px] w-[58px] shrink-0 items-center justify-center">
      {failed ? (
        <SealFallback />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={LOGO_SRC}
          alt="Biocode Innovators logo"
          width={56}
          height={56}
          className="h-full w-full rounded-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

const social =
  "flex h-[44px] w-[44px] items-center justify-center rounded-full border border-[#E8EEF6]/20 bg-[#0B1F4D]/50 text-[#E8EEF6] transition hover:-translate-y-0.5 hover:border-[#22D3EE] hover:text-[#22D3EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]";

const colHeading =
  "font-heading text-[11px] font-semibold uppercase tracking-[0.28em] text-[#22D3EE]";

const footLink =
  "inline-block text-[15px] leading-6 text-[#9CAABE] transition duration-200 hover:translate-x-1 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]";

export default function Footer() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <footer
      className={`relative flex flex-col overflow-hidden text-white ${
        isHome ? "min-h-[100svh]" : "pt-10 md:pt-16"
      }`}
      style={{
        background: "linear-gradient(180deg, #0B1F4D 0%, #0A1B47 100%)",
      }}
    >
      {/* CTA (home page only, fills the space above the card) */}
      {isHome && (
      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-14 pt-24 text-center md:pt-28 lg:pb-16">
        <p className="flex items-center gap-3.5 text-[11px] font-semibold uppercase tracking-[0.38em] text-white sm:text-[12.5px]">
          <span className="h-px w-8 bg-white/60 sm:w-[35px]" aria-hidden="true" />
          Be a part of the journey
          <span className="h-px w-8 bg-white/60 sm:w-[35px]" aria-hidden="true" />
        </p>

        <h2 className="mt-9 max-w-[16ch] font-heading text-[2.3rem] font-semibold leading-[1.16] tracking-[-0.01em] text-white sm:max-w-none sm:text-5xl lg:text-[clamp(3rem,4.1vw,3.75rem)]">
          Ideas Deserve To Become
          <span className="block text-[#22D3EE]">DISCOVERIES.</span>
        </h2>

        <p className="mt-8 max-w-[540px] text-base leading-[1.75] text-[#9CAABE] md:text-lg">
          Explore research, build practical skills and publish your work at the
          intersection of biology and technology.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={JOIN_HREF}
            className="inline-flex h-[54px] items-center justify-center gap-3 rounded-full bg-[#22D3EE] px-9 font-heading text-[15px] font-semibold text-[#0B1F4D] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]"
          >
            Join BioCode
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 13L13 3M5 3h8v8" />
            </svg>
          </Link>
          <Link
            href="/research"
            className="inline-flex h-[50px] items-center justify-center rounded-full border border-[#E8EEF6]/40 bg-[#0B1F4D]/60 px-8 font-heading text-[15px] font-semibold text-[#22D3EE] transition hover:-translate-y-0.5 hover:border-[#22D3EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]"
          >
            Explore Research
          </Link>
        </div>
      </div>
      )}

      {/* Soft divider: separates the CTA from the links without splitting the section */}
      {isHome && (
        <div className="container-page" aria-hidden="true">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[#22D3EE]/35 to-transparent" />
        </div>
      )}

      {/* Footer links */}
      <div className="container-page">
        <div className={isHome ? "pb-8 pt-10 lg:pt-14" : "pb-6 sm:pb-8"}>
          {/* Phones: brand full width, Explore + Programs side by side, Connect full width */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-10 lg:grid-cols-[1.95fr_1fr_1fr_1.2fr] lg:gap-0">
            {/* Brand */}
            <div className="col-span-2 sm:col-span-1">
              <Link href="/" className="inline-flex items-center gap-3 sm:gap-4">
                <Logo />
                <span>
                  <span className="block font-heading text-[21px] font-semibold leading-tight text-white sm:text-[24px]">
                    Biocode Innovators
                  </span>
                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.2em]">
                    <span className="text-[#22D3EE]/70">Biocode Innovators ·</span>{" "}
                    <span className="text-[#22D3EE]">Research Wing</span>
                  </span>
                </span>
              </Link>

              <p className="mt-5 font-heading text-[18px] font-normal uppercase leading-[1.45] tracking-[0.01em] text-white sm:mt-6 sm:text-[22px]">
                <strong className="font-bold">Code</strong> your future.
                <br />
                Decode <strong className="font-bold">biology.</strong>
              </p>

              <p className="mt-4 max-w-sm text-[15px] leading-7 text-[#9CAABE] sm:mt-6">
                Learn, research, and publish, all in one community.
              </p>
            </div>

            {/* Explore */}
            <nav aria-label="Explore">
              <h3 className={colHeading}>Explore</h3>
              <ul className="mt-4 space-y-1 sm:mt-[26px] sm:space-y-2">
                {EXPLORE.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={footLink}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Programs */}
            <nav aria-label="Programs">
              <h3 className={colHeading}>Programs</h3>
              <ul className="mt-4 space-y-1 sm:mt-[26px] sm:space-y-2">
                {PROGRAMS.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={footLink}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Connect */}
            <div className="col-span-2 sm:col-span-1">
              <h3 className={colHeading}>Connect with us</h3>
              <div className="mt-4 flex gap-3 sm:mt-5">
                <a href={SOCIALS.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={social}>
                  <InstagramIcon />
                </a>
                <a href={SOCIALS.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className={social}>
                  <LinkedInIcon />
                </a>
                <a href={SOCIALS.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className={social}>
                  <YouTubeIcon />
                </a>
              </div>

              <h3 className={`${colHeading} mt-6 sm:mt-7`}>Official Gmail</h3>
              <a
                href={`mailto:${EMAIL}`}
                className="mt-3 flex items-center gap-3 break-all text-[15px] text-[#E8EEF6] transition hover:text-[#22D3EE] sm:mt-4"
              >
                <span className="text-[#22D3EE]">
                  <MailIcon />
                </span>
                {EMAIL}
              </a>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-9 flex flex-col gap-3 border-t border-[#E8EEF6]/[0.14] pt-5 text-[13.5px] tracking-[0.01em] text-[#E8EEF6]/85 sm:mt-12 sm:flex-row sm:items-center sm:justify-between sm:pt-6 lg:mt-14">
            <p>© {new Date().getFullYear()} Biocode Innovators</p>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 sm:gap-x-7">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition hover:text-[#22D3EE]">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
