import Link from "next/link";
import Coverflow, { type Slide } from "@/components/Coverflow";
import HomeTestimonials from "@/components/HomeTestimonials";
import type { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: {
    absolute: "BioCode Innovators | Code Your Future. Decode Biology.",
  },
  description:
    "Explore bioinformatics, computational biology, AI, scientific research, courses, fellowships and student publications at BioCode Innovators.",
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const pathway = [
  {
    n: "01",
    title: "Learn",
    text: "Build your knowledge through structured courses and guided learning experiences.",
    href: "/courses",
    cta: "Explore courses",
  },
  {
    n: "02",
    title: "Research",
    text: "Explore scientific publications and discover opportunities to contribute to research.",
    href: "/research",
    cta: "Explore research",
  },
  {
    n: "03",
    title: "Publish",
    text: "Share your scientific work and become part of a growing student research community.",
    href: "/student-journal",
    cta: "Visit the journal",
  },
];

type Publication = {
  id: string;
  title: string;
  authors: string[] | null;
  year: number | null;
  journal: string | null;
  external_url: string | null;
  pdf_url: string | null;
  type: string | null;
};

type Course = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  level: string | null;
  duration: string | null;
  delivery: string | null;
  is_free: boolean | null;
  thumbnail_url: string | null;
};

type Update = {
  id: string;
  title: string;
  content: string;
  external_url: string | null;
  created_at: string;
};

type CarouselItem = {
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  display_order: number;
};

/* Decorative DNA header used when a course has no thumbnail */
function DnaHeader() {
  const rungs = [
    20, 38, 56, 74, 92, 110, 128, 146,
    164, 182, 200, 218, 236, 254, 272, 290,
  ];

  return (
    <svg
      viewBox="0 0 300 100"
      preserveAspectRatio="xMidYMid slice"
      className="course-card-dna"
      aria-hidden="true"
    >
      {rungs.map((x) => (
        <line
          key={x}
          x1={x}
          y1={50 - 30 * Math.abs(Math.sin((x / 75) * Math.PI))}
          x2={x}
          y2={50 + 30 * Math.abs(Math.sin((x / 75) * Math.PI))}
          stroke="rgb(103 232 249 / 35%)"
          strokeWidth="1.2"
        />
      ))}

      <path
        d="M0 50 C 19 0, 56 0, 75 50 S 131 100, 150 50 S 206 0, 225 50 S 281 100, 300 50"
        fill="none"
        stroke="#67e8f9"
        strokeOpacity="0.8"
        strokeWidth="1.6"
      />

      <path
        d="M0 50 C 19 100, 56 100, 75 50 S 131 0, 150 50 S 206 100, 225 50 S 281 0, 300 50"
        fill="none"
        stroke="#2dd4bf"
        strokeOpacity="0.65"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/* Crisp, fully coded hero visual (vector, so it never blurs) */
function HeroVisual() {
  const CX = 260;
  const ys: number[] = [];

  for (let y = 92; y <= 372; y += 4) {
    ys.push(y);
  }

  const wave = (y: number, phase: number) =>
    CX + 40 * Math.sin(((y - 92) / 280) * Math.PI * 3 + phase);

  const strandA = ys
    .map(
      (y, i) =>
        `${i === 0 ? "M" : "L"}${wave(y, 0).toFixed(1)} ${y}`
    )
    .join(" ");

  const strandB = ys
    .map(
      (y, i) =>
        `${i === 0 ? "M" : "L"}${wave(y, Math.PI).toFixed(1)} ${y}`
    )
    .join(" ");

  const rungs = ys.filter((_, i) => i % 4 === 0);

  const nodes = [
    { x: 112, y: 112, d: "0s" },
    { x: 408, y: 98, d: "-1.5s" },
    { x: 84, y: 262, d: "-3s" },
    { x: 438, y: 252, d: "-4.5s" },
  ];

  return (
    <div
      className="relative overflow-hidden rounded-[28px] border border-cyan-300/25 shadow-[0_30px_80px_-30px_rgb(0_0_0/70%)]"
      style={{
        background:
          "radial-gradient(circle at 52% 46%, rgb(34 211 238 / 38%), transparent 58%), linear-gradient(150deg, #0B2A5A 0%, #0E7490 62%, #0B1F4D 100%)",
      }}
    >
      <svg
        viewBox="0 0 520 460"
        className="block h-auto w-full"
        role="img"
        aria-label="Illustration of DNA, biological data and laboratory science"
      >
        <defs>
          <pattern
            id="hv-hex"
            width="34"
            height="30"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M17 0 L34 8.5 V21.5 L17 30 L0 21.5 V8.5 Z"
              fill="none"
              stroke="#67E8F9"
              strokeOpacity="0.09"
            />
          </pattern>

          <radialGradient id="hv-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="hv-strand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#A5F3FC" />
          </linearGradient>
        </defs>

        <rect width="520" height="460" fill="url(#hv-hex)" />

        <circle cx={CX} cy="230" r="170" fill="url(#hv-core)" />

        {/* Rings */}
        <circle
          cx={CX}
          cy="230"
          r="176"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.35"
          strokeWidth="1.2"
        />

        <circle
          cx={CX}
          cy="230"
          r="150"
          fill="none"
          stroke="#67E8F9"
          strokeOpacity="0.55"
          strokeWidth="2"
        />

        <circle
          className="hv-spin"
          cx={CX}
          cy="230"
          r="126"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.6"
          strokeWidth="2.4"
          strokeDasharray="70 18 6 18"
        />

        {/* DNA helix */}
        <g>
          {rungs.map((y) => {
            const a = wave(y, 0);
            const b = wave(y, Math.PI);

            return (
              <line
                key={y}
                x1={a}
                y1={y}
                x2={b}
                y2={y}
                stroke="#67E8F9"
                strokeOpacity="0.8"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            );
          })}

          <path
            d={strandA}
            fill="none"
            stroke="url(#hv-strand)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d={strandB}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity="0.85"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Connection lines to nodes */}
        {nodes.map((n) => (
          <line
            key={`l-${n.x}`}
            x1={n.x}
            y1={n.y}
            x2={CX}
            y2="230"
            stroke="#67E8F9"
            strokeOpacity="0.22"
            strokeDasharray="3 6"
          />
        ))}

        {/* Icon nodes */}
        {nodes.map((n, i) => (
          <g
            key={n.x}
            className="hv-float"
            style={{ animationDelay: n.d }}
            transform={`translate(${n.x} ${n.y})`}
          >
            <circle
              r="36"
              fill="#0B1F4D"
              fillOpacity="0.75"
              stroke="#FFFFFF"
              strokeOpacity="0.75"
              strokeWidth="1.8"
            />

            <circle
              r="30"
              fill="none"
              stroke="#22D3EE"
              strokeOpacity="0.4"
            />

            <g
              fill="none"
              stroke="#A5F3FC"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {i === 0 && (
                <path d="M0 11 C-17 -1 -12 -15 -5 -14 C-2 -13.5 0 -10 0 -8 C0 -10 2 -13.5 5 -14 C12 -15 17 -1 0 11Z" />
              )}

              {i === 1 && (
                <>
                  <polygon points="0,-15 13,-7.5 13,7.5 0,15 -13,7.5 -13,-7.5" />
                  <circle cx="0" cy="0" r="3" fill="#A5F3FC" />
                </>
              )}

              {i === 2 && (
                <>
                  <path d="M-5 -15 H5 M-3 -15 V-4 L-14 13 H14 L3 -4 V-15" />
                  <path d="M-8 6 H8" />
                </>
              )}

              {i === 3 && (
                <path d="M-13 12 V2 M-4 12 V-6 M5 12 V-1 M14 12 V-12" />
              )}
            </g>
          </g>
        ))}

        {/* ECG line */}
        <path
          className="hv-ecg"
          d="M36 410 H150 L166 410 L178 380 L192 436 L206 394 L218 410 H300 L314 410 L324 392 L336 428 L348 410 H484"
          fill="none"
          stroke="#67E8F9"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M36 410 H484"
          stroke="#67E8F9"
          strokeOpacity="0.15"
          strokeWidth="1"
        />

        {/* Data chips */}
        {[
          { x: 40, y: 40, t: "BIO" },
          { x: 392, y: 396, t: "AI" },
        ].map((c) => (
          <g key={c.t} transform={`translate(${c.x} ${c.y})`}>
            <rect
              width="62"
              height="26"
              rx="13"
              fill="#0B1F4D"
              fillOpacity="0.7"
              stroke="#67E8F9"
              strokeOpacity="0.5"
            />

            <text
              x="31"
              y="17.5"
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              letterSpacing="2"
              fill="#A5F3FC"
            >
              {c.t}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default async function Home() {
  const supabase = createServerSupabase();

  const [
    publicationsResult,
    publicationsCountResult,
    featuredCoursesResult,
    coursesCountResult,
    journalCountResult,
    openInternshipsCountResult,
    updatesResult,
    carouselResult,
    homeHeroResult,
  ] = await Promise.all([
    supabase
      .from("publications")
      .select("id, title, authors, year, journal, external_url, pdf_url, type")
      .eq("is_published", true)
      .order("year", { ascending: false, nullsFirst: false })
      .limit(4),

    supabase
      .from("publications")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true),

    supabase
      .from("courses")
      .select(
        "id, slug, title, summary, level, duration, delivery, is_free, thumbnail_url"
      )
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(3),

    supabase
      .from("courses")
      .select("id", { count: "exact", head: true })
      .eq("published", true),

    supabase
      .from("student_journals")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true),

    supabase
      .from("internships")
      .select("id", { count: "exact", head: true })
      .eq("published", true)
      .eq("is_open", true),

    supabase
      .from("updates")
      .select("id, title, content, external_url, created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(3),

    supabase
      .from("homepage_carousel")
      .select("title, description, image_url, link_url, display_order")
      .eq("is_published", true)
      .order("display_order", { ascending: true }),

    supabase
      .from("home_hero_settings")
      .select("image_url")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  if (publicationsResult.error)
    console.error(
      "Homepage publications query failed:",
      publicationsResult.error.message
    );

  if (publicationsCountResult.error)
    console.error(
      "Homepage publication count failed:",
      publicationsCountResult.error.message
    );

  if (featuredCoursesResult.error)
    console.error(
      "Homepage featured courses query failed:",
      featuredCoursesResult.error.message
    );

  if (coursesCountResult.error)
    console.error(
      "Homepage course count failed:",
      coursesCountResult.error.message
    );

  if (journalCountResult.error)
    console.error(
      "Homepage journal count failed:",
      journalCountResult.error.message
    );

  if (openInternshipsCountResult.error)
    console.error(
      "Homepage internship count failed:",
      openInternshipsCountResult.error.message
    );

  if (updatesResult.error)
    console.error(
      "Homepage updates query failed:",
      updatesResult.error.message
    );

  if (carouselResult.error)
    console.error(
      "Homepage carousel query failed:",
      carouselResult.error.message
    );

  if (homeHeroResult.error)
    console.error(
      "Homepage hero image query failed:",
      homeHeroResult.error.message
    );

  const homeHeroImage = homeHeroResult.error
    ? null
    : homeHeroResult.data?.image_url ?? null;

  const publications: Publication[] = publicationsResult.error
    ? []
    : publicationsResult.data ?? [];

  const featuredCourses: Course[] = featuredCoursesResult.error
    ? []
    : (featuredCoursesResult.data as Course[] | null) ?? [];

  const updates: Update[] = updatesResult.error
    ? []
    : updatesResult.data ?? [];

  const counts = [
    {
      n: publicationsCountResult.error
        ? "—"
        : publicationsCountResult.count ?? 0,
      label: "Research papers",
      href: "/research",
    },
    {
      n: journalCountResult.error
        ? "—"
        : journalCountResult.count ?? 0,
      label: "Journal entries",
      href: "/student-journal",
    },
    {
      n: openInternshipsCountResult.error
        ? "—"
        : openInternshipsCountResult.count ?? 0,
      label: "Open internships",
      href: "/internships",
    },
    {
      n: coursesCountResult.error
        ? "—"
        : coursesCountResult.count ?? 0,
      label: "Courses",
      href: "/courses",
    },
  ];

  const slides: Slide[] = carouselResult.error
    ? []
    : ((carouselResult.data ?? []) as CarouselItem[]).map((item) => {
        const href = item.link_url?.trim() || "/research";

        return {
          image: item.image_url || "/images/card-1.jpg",
          label: "BioCode Innovators",
          title: item.title,
          text: item.description ?? undefined,
          href,
          external: /^https?:\/\//i.test(href),
          cta: "Explore",
        };
      });

  return (
  <>
      {/* HERO */}
      <section className="biocode-hero relative overflow-hidden bg-secondary text-white">
        <div className="hero-glow hero-glow-one" aria-hidden="true" />
        <div className="hero-glow hero-glow-two" aria-hidden="true" />
        <div className="hero-grid-pattern" aria-hidden="true" />

        {/* Equal two-column grid, same proportions as the About page */}
        <div className="container-page relative z-10 grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-20">
          {/* Left: copy */}
          <div>
            <p className="font-heading text-[12px] font-semibold uppercase tracking-[0.22em] text-[#22D3EE] sm:text-[13px]">
              Bioinformatics <span className="mx-1.5 text-white/60">•</span> AI{" "}
              <span className="mx-1.5 text-white/60">•</span> Data Analytics
            </p>

            <h1 className="mt-6 font-heading text-[clamp(2rem,9.6vw,2.6rem)] font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
              <span className="block">Code Your Future.</span>
              <span className="block text-[#22D3EE]">Decode Biology.</span>
            </h1>

            <p className="mt-6 font-heading text-lg font-medium text-white sm:text-xl">
              Learn. Research. Innovate.
            </p>

            <p className="mt-4 max-w-xl text-base leading-8 text-white/70 sm:text-[17px]">
              BioCode Innovators is an online learning and research initiative
              empowering students, researchers, and aspiring professionals to
              explore the intersection of biology, computational science,
              artificial intelligence, and data-driven discovery.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/courses"
                className="inline-flex h-[50px] items-center justify-center rounded-lg bg-[#22D3EE] px-7 font-heading text-[15px] font-semibold text-[#0B1F4D] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]"
              >
                Explore Opportunities
              </Link>

              <Link
                href="/research"
                className="inline-flex h-[50px] w-full sm:w-auto items-center justify-center rounded-lg border border-[#E8EEF6]/45 px-7 font-heading text-[15px] font-semibold text-white transition hover:-translate-y-0.5 hover:border-[#22D3EE] hover:text-[#22D3EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]"
              >
                Discover Our Research
              </Link>
            </div>

            <ul className="mt-8 flex flex-col items-start gap-3 pr-16 text-[15px] text-white/85 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-7 sm:pr-0">
              <li className="flex items-center gap-2.5">
                <svg
                  viewBox="0 0 24 24"
                  className="h-[22px] w-[22px] text-[#22D3EE]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
                </svg>
                100% online
              </li>

              <li className="flex items-center gap-2.5">
                <svg
                  viewBox="0 0 24 24"
                  className="h-[22px] w-[22px] text-[#22D3EE]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="9" cy="8" r="3.2" />
                  <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
                  <circle cx="17" cy="9" r="2.4" />
                  <path d="M16.5 14c2.7 0 4.5 1.7 4.5 4.2" />
                </svg>
                Collaborative learning
              </li>

              <li className="flex items-center gap-2.5">
                <svg
                  viewBox="0 0 24 24"
                  className="h-[22px] w-[22px] text-[#22D3EE]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 4v16h16" />
                  <path d="M7 15l4-4 3 3 5-6" />
                </svg>
                Research-oriented development
              </li>
            </ul>
          </div>

          {/* Right: admin-managed image with coded visual fallback.
              On large screens it fills its whole column (like the About image). */}
          <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none">
            {homeHeroImage ? (
              <img
                src={homeHeroImage}
                alt="BioCode Innovators"
                className="aspect-square w-full rounded-[28px] border border-cyan-300/25 object-cover shadow-[0_30px_80px_-30px_rgb(0_0_0/70%)]"
              />
            ) : (
              <HeroVisual />
            )}
          </div>
        </div>

        <div className="hero-bottom-line" />
      </section>


      {/* LIVE CONTENT COUNTS */}
      <section
        aria-label="BioCode at a glance"
        className="border-b border-line bg-bg"
      >
        <dl className="container-page grid grid-cols-2 gap-7 py-10 md:grid-cols-4">
          {counts.map((count, index) => (
            <Link
              key={count.label}
              href={count.href}
              className="count-item group"
            >
              <dd className="font-heading text-4xl font-semibold text-primary transition-transform duration-300 group-hover:-translate-y-1">
                {count.n}
                <span className="ml-1 text-lg text-accent">+</span>
              </dd>

              <dt className="mt-2 text-sm text-muted transition-colors group-hover:text-primary">
                {count.label}
              </dt>

              <span className="count-index">0{index + 1}</span>
            </Link>
          ))}
        </dl>
      </section>

      {/* PATHWAY */}
      <section className="pathway-section bg-surface py-24">
        <div className="container-page">
          <div className="section-heading">
            <p className="section-kicker">YOUR JOURNEY STARTS HERE</p>

            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              From curiosity to discovery.
            </h2>

            <p className="mt-4 max-w-2xl text-muted">
              Build your scientific foundation, explore meaningful research
              and share what you discover.
            </p>
          </div>

          <ol className="mt-14 grid gap-6 md:grid-cols-3">
            {pathway.map((item) => (
              <li key={item.n} className="pathway-card glow-card">
                <span className="pathway-number">{item.n}</span>

                <h3 className="mt-8 text-2xl font-semibold">{item.title}</h3>

                <p className="mt-4 min-h-[76px] text-sm leading-7 text-muted">
                  {item.text}
                </p>

                <Link href={item.href} className="pathway-link">
                  {item.cta} <span aria-hidden="true">↗</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ADMIN-MANAGED CAROUSEL */}
      <section className="container-page py-24">
        <div className="section-heading mb-10">
          <p className="section-kicker">EXPLORE BIOCODE</p>

          <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
            From data to discovery.
          </h2>

          <p className="mt-4 max-w-2xl text-muted">
            Discover the latest opportunities, research and featured work
            from our community.
          </p>
        </div>

        {slides.length > 0 ? (
          <Coverflow slides={slides} ariaLabel="From Data to Discovery" />
        ) : (
          <p className="text-muted">
            Discover our research, courses and student work while new featured
            content is being prepared.
          </p>
        )}
      </section>

      {/* COURSES (3 on the front page) */}
      <section className="bg-surface py-20">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-kicker">LEARN WITH US</p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
                Courses
              </h2>
            </div>

            <Link href="/courses" className="arrow-link text-sm">
              All courses →
            </Link>
          </div>

          {featuredCourses.length > 0 ? (
            <>
              <div className="course-grid mt-8">
                {featuredCourses.map((course) => (
                  <Link
                    key={course.id}
                    href={`/courses/${course.slug}`}
                    className="course-card group"
                  >
                    <div className="course-card-visual">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <DnaHeader />
                      )}

                      <span className="course-card-badge">
                        {course.is_free ? "Free course" : "Paid course"}
                      </span>
                    </div>

                    <div className="course-card-body">
                      <h3 className="course-card-title">{course.title}</h3>

                      <p className="course-card-text">
                        {course.summary || "Course details coming soon."}
                      </p>

                      <p className="course-card-meta">
                        {[course.level, course.delivery]
                          .filter(Boolean)
                          .join("  ·  ")}
                      </p>

                      <div className="course-card-footer">
                        <span className="course-card-duration">
                          {course.duration || ""}
                        </span>

                        <span className="course-card-btn">
                          View course <span aria-hidden="true">↗</span>
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-12 flex justify-center">
                <Link href="/courses" className="explore-more-btn">
                  Explore more courses <span aria-hidden="true">→</span>
                </Link>
              </div>
            </>
          ) : (
            <p className="mt-8 text-muted">
              No courses have been published yet. Please check back soon.
            </p>
          )}
        </div>
      </section>

      {/* PUBLICATIONS */}
      <section className="container-page py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-kicker">SCIENTIFIC WORK</p>
            <h2 className="mt-3 text-3xl font-semibold">
              Latest publications
            </h2>
          </div>

          <Link href="/research" className="arrow-link text-sm">
            All publications →
          </Link>
        </div>

        {publications.length > 0 ? (
          <ol className="pub-list mt-8">
            {publications.map((publication) => {
              const href =
                publication.pdf_url ||
                publication.external_url ||
                "/research";

              const external = href.startsWith("http");

              const inner = (
                <>
                  <span className="pub-year">
                    {publication.year ?? "—"}
                  </span>

                  <span className="pub-main">
                    <span className="pub-type">
                      {publication.type || "Research"}
                    </span>

                    <span className="pub-title">
                      {publication.title}
                    </span>

                    <span className="pub-meta">
                      {(publication.authors ?? []).join(", ")}
                      {publication.journal
                        ? ` · ${publication.journal}`
                        : ""}
                    </span>
                  </span>

                  <span className="pub-arrow" aria-hidden="true">
                    ↗
                  </span>
                </>
              );

              return (
                <li key={publication.id}>
                  {external ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pub-row"
                      aria-label={`Read paper: ${publication.title}`}
                    >
                      {inner}
                    </a>
                  ) : (
                    <Link
                      href={href}
                      className="pub-row"
                      aria-label={`Read paper: ${publication.title}`}
                    >
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-8 text-muted">
            No publications have been published yet.
          </p>
        )}
      </section>

      {/* UPDATES */}
      <section className="bg-surface py-20">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-kicker">WHAT&apos;S HAPPENING</p>
              <h2 className="mt-3 text-3xl font-semibold">
                Latest updates
              </h2>
            </div>

            <Link href="/updates" className="arrow-link text-sm">
              All updates →
            </Link>
          </div>

          {updates.length > 0 ? (
            <div className="updates-grid mt-8">
              {updates.map((update, i) => {
                const href = update.external_url || "/updates";
                const external = href.startsWith("http");

                const body = (
                  <>
                    <span className="update-date">
                      {new Date(update.created_at).toLocaleDateString(
                        "en-GB",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </span>

                    <h3 className="mt-3 text-xl font-semibold">
                      {update.title}
                    </h3>

                    <p className="update-text mt-3 whitespace-pre-line text-sm leading-7">
                      {update.content}
                    </p>

                    <span className="arrow-link mt-5 text-sm">
                      {update.external_url ? "Read more" : "View updates"} →
                    </span>
                  </>
                );

                const cls = `update-card ${
                  i === 0 ? "update-card-lead" : ""
                }`;

                return external ? (
                  <a
                    key={update.id}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cls}
                  >
                    {body}
                  </a>
                ) : (
                  <Link key={update.id} href={href} className={cls}>
                    {body}
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="mt-8 text-muted">
              No updates have been published yet.
            </p>
          )}
        </div>
      </section>

      {/* STUDENT TESTIMONIALS (admin-published, homepage placement) */}
      <HomeTestimonials />

      {/* The "Be part of the journey" CTA now lives in the home-page footer (Footer.tsx) */}
    </>
  );
}
