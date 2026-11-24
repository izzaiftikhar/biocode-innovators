import type { Metadata } from "next";
import { about, founder } from "@/data/content";
import { createPublicSupabase } from "@/lib/supabase/public";

export const metadata: Metadata = {
  title: "About BioCode Innovators",
  description: about.body,
};

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const supabase = createPublicSupabase();

  let heroImage = about.image;
  let heroBadge = about.badge;

  let teamMembers: {
    id: string;
    name: string;
    role: string;
    bio: string | null;
  }[] = [];

  if (supabase) {
    const { data: settings, error: settingsError } = await supabase
      .from("about_page_settings")
      .select("image_url, badge")
      .eq("id", 1)
      .maybeSingle();

    if (settingsError) {
      console.error("Unable to load About settings:", settingsError.message);
    } else if (settings) {
      heroImage = settings.image_url || about.image;
      heroBadge = settings.badge || about.badge;
    }

    const { data: members, error: teamError } = await supabase
      .from("about_team_members")
      .select("*")
      .eq("is_published", true)
      .order("display_order", { ascending: true });

    if (teamError) {
      console.error("Unable to load About team:", teamError.message);
    } else if (members) {
      teamMembers = members as typeof teamMembers;
    }
  }

  return (
    <main>
      <section className="container-page grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            {about.tag}
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-secondary sm:text-5xl">
            {about.title}
          </h1>

          <p className="mt-6 leading-8 text-muted">{about.body}</p>

          <div className="mt-8 rounded-xl border-l-4 border-primary bg-surface p-5">
            <h2 className="font-semibold text-secondary">Our mission</h2>
            <p className="mt-2 leading-7 text-muted">{about.mission}</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl shadow-2xl">
          <img
            src={heroImage}
            alt="BioCode Innovators"
            className="aspect-[4/3] w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-secondary/80 via-transparent to-transparent"
          />
          <p className="absolute bottom-6 left-6 rounded-lg border border-accent/40 bg-secondary/80 px-5 py-2.5 text-sm font-semibold text-accent backdrop-blur">
            {heroBadge}
          </p>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="grid items-center gap-10 rounded-3xl border border-line bg-surface p-8 sm:p-10 lg:grid-cols-[16rem_1fr] lg:p-12">
          <div className="text-center">
            <img
              src={founder.image}
              alt={`Portrait of ${founder.name}`}
              className="mx-auto aspect-square w-48 rounded-full object-cover ring-4 ring-accent/40 ring-offset-4 ring-offset-bg sm:w-56"
            />
            <p className="mt-5 font-semibold text-secondary">
              {founder.name}
            </p>
            <p className="mt-1 text-sm text-primary">{founder.role}</p>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              A message from our founder
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-secondary">
              {founder.headline}
            </h2>

            <blockquote className="mt-6 border-l-4 border-primary pl-5 sm:pl-7">
              {founder.note.map((paragraph, index) => (
                <p
                  key={index}
                  className={`text-lg italic leading-8 text-muted ${
                    index > 0 ? "mt-5" : ""
                  }`}
                >
                  {paragraph}
                </p>
              ))}
            </blockquote>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-surface py-16">
        <div className="container-page">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Our people
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-secondary">
            Core Team &amp; Guidance
          </h2>
          <p className="mt-3 max-w-2xl text-muted">
            Meet the people contributing to our scientific learning and
            research community.
          </p>

          {teamMembers.length > 0 ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {teamMembers.map((member) => (
                <article
                  key={member.id}
                  className="rounded-2xl border border-line bg-bg p-6"
                >
                  <h3 className="text-lg font-semibold text-secondary">
                    {member.name}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-primary">
                    {member.role}
                  </p>
                  {member.bio && (
                    <p className="mt-4 leading-7 text-muted">{member.bio}</p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-muted">
              Team profiles will appear here as they are published.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
