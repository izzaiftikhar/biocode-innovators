"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/client";

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

const filters = ["All", "Beginner", "Intermediate", "Advanced"] as const;

type Filter = (typeof filters)[number];

/* Decorative DNA header used when a course has no thumbnail
   (same as the home page course card) */
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

export default function Courses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadCourses() {
      const supabase = createBrowserSupabase();

      const { data, error } = await supabase
        .from("courses")
        .select(
          "id, slug, title, summary, level, duration, delivery, is_free, thumbnail_url"
        )
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (error) {
        setError("Unable to load courses right now. Please try again later.");
      } else {
        setCourses((data ?? []) as Course[]);
      }

      setLoading(false);
    }

    void loadCourses();
  }, []);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesLevel =
        activeFilter === "All" ||
        (course.level ?? "").toLowerCase().includes(activeFilter.toLowerCase());

      const searchable = [
        course.title,
        course.summary ?? "",
        course.level ?? "",
        course.delivery ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return matchesLevel && searchable.includes(search.toLowerCase().trim());
    });
  }, [courses, activeFilter, search]);

  const levelCounts = useMemo(() => {
    const counts: Record<Filter, number> = {
      All: courses.length,
      Beginner: 0,
      Intermediate: 0,
      Advanced: 0,
    };
    for (const course of courses) {
      const level = (course.level ?? "").toLowerCase();
      for (const f of filters) {
        if (f !== "All" && level.includes(f.toLowerCase())) counts[f] += 1;
      }
    }
    return counts;
  }, [courses]);

  return (
    <main className="min-h-screen bg-bg">
      {/* Catalogue hero: same structure as the Research / Feedback heroes */}
      <section className="page-hero biocode-hero relative overflow-hidden bg-secondary text-white">
        <div className="hero-glow hero-glow-one" aria-hidden="true" />
        <div className="hero-glow hero-glow-two" aria-hidden="true" />
        <div className="hero-grid-pattern" aria-hidden="true" />

        <div className="container-page relative z-10 py-8 lg:py-10">
          <p className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            BIOCODE INNOVATORS &middot; LEARNING
          </p>

          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            Learn today.{" "}
            <span className="hero-gradient-text">Discover tomorrow.</span>
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
            Explore structured learning experiences in bioinformatics,
            computational biology and scientific innovation. Build knowledge
            one step at a time.
          </p>
        </div>

        <div className="hero-bottom-line" />
      </section>

      {/* Course catalogue */}
      <section className="container-page py-16 md:py-20">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              FIND YOUR STARTING POINT
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Explore our courses
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
              Find a course that matches your interests and take your next
              step in scientific learning.
            </p>
          </div>

          <div className="text-sm text-muted">
            {loading
              ? "Loading courses..."
              : `${courses.length} published ${courses.length === 1 ? "course" : "courses"}`}
          </div>
        </div>

        {/* grid-cols-1 = minmax(0,1fr): stops the sidebar's content from
            stretching the column (and the whole page) wider than the screen */}
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
          {/* Sidebar: search + levels */}
          <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <label htmlFor="course-search" className="sr-only">
              Search courses
            </label>
            <div className="relative">
              <span
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                aria-hidden="true"
              >
                &#8981;
              </span>
              <input
                id="course-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search courses&hellip;"
                className="w-full rounded-xl border border-line bg-surface py-3.5 pl-11 pr-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent"
              />
            </div>

            <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
              Levels
            </p>

            <div
              role="group"
              aria-label="Filter by level"
              className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
            >
              {filters.map((filter) => {
                const active = activeFilter === filter;

                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    aria-pressed={active}
                    className={`flex shrink-0 items-center justify-between gap-4 rounded-xl px-4 py-3 text-left text-sm transition ${
                      active
                        ? "bg-accent/10 font-semibold text-accent"
                        : "text-muted hover:bg-surface hover:text-primary"
                    }`}
                  >
                    <span>{filter}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        active
                          ? "bg-accent/20 text-accent"
                          : "bg-surface text-muted"
                      }`}
                    >
                      {levelCounts[filter]}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="min-w-0">
            {/* Results */}
            <div>
              {loading ? (
                <div className="grid gap-6 sm:grid-cols-2">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-96 animate-pulse rounded-2xl border border-line bg-surface"
                    />
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-red-500/30 bg-surface p-8">
                  <p className="text-sm text-muted">{error}</p>
                </div>
              ) : filteredCourses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
                  <p className="text-lg font-semibold">No courses found</p>
                  <p className="mt-2 text-sm text-muted">
                    Try another search or select a different level.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setActiveFilter("All");
                    }}
                    className="mt-5 text-sm font-semibold text-accent hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-5 flex items-center justify-between">
                    <p className="text-sm text-muted">
                      Showing {filteredCourses.length}{" "}
                      {filteredCourses.length === 1 ? "course" : "courses"}
                    </p>
                  </div>

                  {/* Same card as the home page Courses section */}
                  <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredCourses.map((course) => (
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
                              .join("  \u00b7  ")}
                          </p>

                          <div className="course-card-footer">
                            <span className="course-card-duration">
                              {course.duration || ""}
                            </span>

                            <span className="course-card-btn">
                              View course <span aria-hidden="true">&#8599;</span>
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Closing section */}
      <section className="border-t border-line bg-surface">
        <div className="container-page py-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            YOUR JOURNEY STARTS HERE
          </p>
          <h2 className="mt-3 text-2xl font-semibold">
            Curiosity is the beginning of discovery.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted">
            Explore, learn and build the knowledge to take your ideas further.
          </p>
        </div>
      </section>
    </main>
  );
}
