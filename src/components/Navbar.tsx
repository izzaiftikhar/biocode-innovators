"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AuthButton from "./AuthButton";

const primary = [
  { href: "/about", label: "About" },
  { href: "/research", label: "Research" },
  { href: "/courses", label: "Courses" },
  { href: "/fellowship", label: "Fellowship" },
  { href: "/student-journal", label: "Student Journal" },
  { href: "/internships", label: "Internships" },
];

const more = [
  { href: "/community", label: "Community" },
  { href: "/updates", label: "Updates" },
  { href: "/feedback", label: "Feedback" },
  { href: "/faq", label: "FAQs" },
  { href: "/contact", label: "Contact" },
];

const allLinks = [...primary, ...more];

const iconPaths = [
  "M12 3l8 6v12H4V9l8-6z M9 21v-8h6v8",
  "M12 3v18 M3 12h18 M5.6 5.6l12.8 12.8 M18.4 5.6L5.6 18.4",
  "M4 5h16v14H4z M8 9h8 M8 13h8 M8 17h5",
  "M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3z",
  "M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5",
  "M4 5h16v14H4z M8 9h8 M8 13h5",
  "M12 3a9 9 0 1 0 9 9 M12 7v5l4 2",
  "M4 5h16v14H4z M8 9h8 M8 13h8 M8 17h4",
  "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z",
  "M4 5h16v14H4z M8 9h8 M8 13h8",
  "M4 6h16 M4 12h16 M4 18h16",
];

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function NavIcon({ index }: { index: number }) {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <path d={iconPaths[index] || iconPaths[10]} />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const moreActive = more.some((link) => isActive(link.href));

  // The mobile menu is rendered into <body> (see the portal below), which
  // only exists in the browser, so wait until the component has mounted.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;

    const onClick = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  // Lock background scrolling while the mobile/tablet drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const linkClass = (active: boolean) =>
    `relative whitespace-nowrap py-2 text-sm font-medium transition-colors ${
      active ? "text-primary" : "text-ink/70 hover:text-primary"
    } after:absolute after:inset-x-0 after:-bottom-[1px] after:h-0.5 after:rounded-full after:bg-primary after:transition-opacity ${
      active ? "after:opacity-100" : "after:opacity-0"
    }`;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-20 lg:gap-6">
          <Link
            href="/"
            aria-label="BioCode Innovators home"
            className="flex shrink-0 items-center gap-2.5 whitespace-nowrap font-heading text-[15px] font-semibold text-secondary sm:gap-3 sm:text-lg"
          >
            <span className="block h-11 w-11 shrink-0 overflow-hidden rounded-full sm:h-14 sm:w-14 lg:h-16 lg:w-16">
              <img
                src="/images/biocode-logo.png"
                alt="BioCode Innovators official logo"
                width={64}
                height={64}
                className="h-full w-full scale-[1.23] object-cover"
              />
            </span>
            <span>
              BioCode <span className="text-primary">Innovators</span>
            </span>
          </Link>

          {/* Existing desktop navigation remains intact. */}
          <nav aria-label="Main" className="hidden items-center gap-5 xl:flex">
            {primary.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={linkClass(isActive(link.href))}
              >
                {link.label}
              </Link>
            ))}

            <div ref={moreRef} className="relative">
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-controls="more-menu"
                onClick={() => setMoreOpen((open) => !open)}
                className={`${linkClass(moreActive)} inline-flex items-center gap-1`}
              >
                More
                <svg
                  viewBox="0 0 20 20"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className={`transition-transform ${moreOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                >
                  <path d="M5.5 7.5 10 12l4.5-4.5" />
                </svg>
              </button>

              {moreOpen && (
                <ul
                  id="more-menu"
                  className="absolute right-0 top-full mt-3 w-48 overflow-hidden rounded-xl border border-line bg-bg p-1.5 shadow-xl"
                >
                  {more.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={isActive(link.href) ? "page" : undefined}
                        className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                          isActive(link.href)
                            ? "bg-surface text-primary"
                            : "text-ink/80 hover:bg-surface hover:text-primary"
                        }`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </nav>

          <div className="hidden shrink-0 items-center gap-3 xl:flex">
            <Link
              href="/search"
              aria-label="Search the site"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink/70 transition-colors hover:bg-surface hover:text-primary"
            >
              <SearchIcon />
            </Link>
            <span aria-hidden="true" className="h-6 w-px bg-line" />
            <AuthButton />
          </div>

          {/* Animated mobile/tablet hamburger */}
          <button
            type="button"
            className="menu-trigger inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface/70 text-secondary transition-all hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary xl:hidden"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((open) => !open)}
          >
            <span className={`menu-trigger-lines ${mobileOpen ? "is-open" : ""}`}>
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </header>

      {/*
        Mobile/tablet navigation drawer.
        Rendered into <body> instead of inside the header. The header uses
        backdrop-filter, which makes "position: fixed" children stick to the
        header instead of the screen. Outside the header the menu is pinned
        to the full screen, and its parked position no longer widens the page.
      */}
      {mounted &&
        createPortal(
          <div
            className={`mobile-menu-overlay xl:hidden ${mobileOpen ? "is-open" : ""}`}
            aria-hidden={!mobileOpen}
            onClick={() => setMobileOpen(false)}
          >
            <aside
              id="mobile-nav"
              role="dialog"
              aria-modal="true"
              aria-label="Website navigation"
              className={`mobile-menu-drawer ${mobileOpen ? "is-open" : ""}`}
              onClick={(event) => event.stopPropagation()}
              inert={!mobileOpen}
            >
              <div className="mobile-menu-top">
                <Link
                  href="/"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-w-0 items-center gap-3"
                >
                  <img
                    src="/images/biocode-logo.png"
                    alt=""
                    width={46}
                    height={46}
                    className="h-11 w-11 rounded-full object-cover"
                  />
                  <span className="font-heading text-base font-bold text-white">
                    BioCode <span className="text-cyan-300">Innovators</span>
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/80 transition hover:border-cyan-300 hover:text-cyan-300"
                >
                  <svg viewBox="0 0 24 24" width="21" height="21"
                    fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="mobile-menu-heading">
                <span>EXPLORE BIOCODE</span>
                <span className="mobile-menu-heading-line" />
              </div>

              <nav aria-label="Mobile main navigation" className="mobile-menu-links">
                {allLinks.map((link, index) => {
                  const active = isActive(link.href);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMobileOpen(false)}
                      style={{ animationDelay: `${index * 35}ms` }}
                      className={`mobile-menu-link ${active ? "active" : ""}`}
                    >
                      <span className="mobile-menu-link-icon">
                        <NavIcon index={index} />
                      </span>
                      <span>{link.label}</span>
                      <svg
                        className="mobile-menu-arrow"
                        viewBox="0 0 24 24"
                        width="17"
                        height="17"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14m-6-6 6 6-6 6" />
                      </svg>
                    </Link>
                  );
                })}
              </nav>

              <div className="mobile-menu-bottom">
                <Link
                  href="/search"
                  onClick={() => setMobileOpen(false)}
                  className="mobile-menu-search"
                >
                  <SearchIcon />
                  <span>Search BioCode</span>
                </Link>

                <div className="mobile-menu-auth">
                  <AuthButton stacked onNavigate={() => setMobileOpen(false)} />
                </div>

                <p className="mobile-menu-tagline">
                  Learn <span>•</span> Research <span>•</span> Innovate
                </p>
              </div>
            </aside>
          </div>,
          document.body
        )}
    </>
  );
}
