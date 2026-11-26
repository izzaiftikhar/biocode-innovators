
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Award,
  Bell,
  BookOpen,
  Briefcase,
  FlaskConical,
  GraduationCap,
  HelpCircle,
  Info,
  Mail,
  MessageSquare,
  Users,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import AuthButton from "./AuthButton";
import { createBrowserSupabase } from "@/lib/supabase/client";

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

type MobileLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const mobileGroups: { title: string; links: MobileLink[] }[] = [
  {
    title: "Programs & Academics",
    links: [
      { href: "/courses", label: "Courses", icon: GraduationCap },
      { href: "/research", label: "Research", icon: FlaskConical },
      { href: "/fellowship", label: "Fellowship", icon: Award },
      { href: "/internships", label: "Internships", icon: Briefcase },
      { href: "/student-journal", label: "Student Journal", icon: BookOpen },
    ],
  },
  {
    title: "Community & Updates",
    links: [
      { href: "/community", label: "Community", icon: Users },
      { href: "/updates", label: "Updates", icon: Bell },
    ],
  },
  {
    title: "Help & Info",
    links: [
      { href: "/about", label: "About", icon: Info },
      { href: "/faq", label: "FAQs", icon: HelpCircle },
      { href: "/feedback", label: "Feedback", icon: MessageSquare },
      { href: "/contact", label: "Contact", icon: Mail },
    ],
  },
];

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const moreRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const moreActive = more.some((link) => isActive(link.href));

  // Track authentication state.
  useEffect(() => {
    const supabase = createBrowserSupabase();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setIsLoggedIn(!!data.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setIsLoggedIn(!!session?.user);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Desktop: Add Profile after Internships, immediately before More.
  const visiblePrimary = isLoggedIn
    ? [...primary, { href: "/profile", label: "Profile" }]
    : primary;

  // Mobile: Add Profile after Internships in Programs & Academics.
  const visibleMobileGroups = mobileGroups.map((group) => {
    if (!isLoggedIn || group.title !== "Programs & Academics") {
      return group;
    }

    return {
      ...group,
      links: [
        ...group.links,
        {
          href: "/profile",
          label: "Profile",
          icon: UserRound,
        },
      ],
    };
  });

  // Running index of each group's first link for staggered animation.
  const groupStarts = visibleMobileGroups.map((_, i) =>
    visibleMobileGroups
      .slice(0, i)
      .reduce((sum, group) => sum + group.links.length, 0)
  );

  // Wait until mounted before rendering the mobile portal.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close menus when navigating.
  useEffect(() => {
    setMobileOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  // Close More dropdown when clicking outside or pressing Escape.
  useEffect(() => {
    if (!moreOpen) return;

    const onClick = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    };

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  // Lock background scrolling while mobile/tablet drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
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

          {/* Desktop navigation */}
          <nav aria-label="Main" className="hidden items-center gap-5 xl:flex">
            {visiblePrimary.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={linkClass(isActive(link.href))}
              >
                {link.label}
              </Link>
            ))}

            {/* More dropdown */}
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
                  className={`transition-transform ${
                    moreOpen ? "rotate-180" : ""
                  }`}
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
                        aria-current={
                          isActive(link.href) ? "page" : undefined
                        }
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

          {/* Desktop search and authentication */}
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

          {/* Mobile/tablet hamburger */}
          <button
            type="button"
            className="menu-trigger inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface/70 text-secondary transition-all hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary xl:hidden"
            aria-label={
              mobileOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((open) => !open)}
          >
            <span
              className={`menu-trigger-lines ${
                mobileOpen ? "is-open" : ""
              }`}
            >
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </header>

      {/*
        Mobile/tablet navigation drawer.
        Rendered into body so fixed positioning works independently
        of the header's backdrop-filter.
      */}
      {mounted &&
        createPortal(
          <div
            className={`mobile-menu-overlay xl:hidden ${
              mobileOpen ? "is-open" : ""
            }`}
            aria-hidden={!mobileOpen}
            onClick={() => setMobileOpen(false)}
          >
            <aside
              id="mobile-nav"
              role="dialog"
              aria-modal="true"
              aria-label="Website navigation"
              className={`mobile-menu-drawer ${
                mobileOpen ? "is-open" : ""
              }`}
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
                  <svg
                    viewBox="0 0 24 24"
                    width="21"
                    height="21"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <nav
                aria-label="Mobile main navigation"
                className="mobile-menu-links"
              >
                {visibleMobileGroups.map((group, groupIndex) => (
                  <div
                    key={group.title}
                    role="group"
                    aria-labelledby={`mobile-group-${groupIndex}`}
                    className="mobile-menu-group"
                  >
                    <p
                      id={`mobile-group-${groupIndex}`}
                      className="mobile-menu-group-title"
                    >
                      {group.title}
                    </p>

                    {group.links.map((link, linkIndex) => {
                      const active = isActive(link.href);
                      const Icon = link.icon;

                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setMobileOpen(false)}
                          style={{
                            animationDelay: `${
                              (groupStarts[groupIndex] + linkIndex) * 35
                            }ms`,
                          }}
                          className={`mobile-menu-link ${
                            active ? "active" : ""
                          }`}
                        >
                          <span className="mobile-menu-link-icon">
                            <Icon
                              size={19}
                              strokeWidth={1.7}
                              aria-hidden="true"
                            />
                          </span>

                          <span>{link.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
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
                  <AuthButton
                    stacked
                    onNavigate={() => setMobileOpen(false)}
                  />
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
