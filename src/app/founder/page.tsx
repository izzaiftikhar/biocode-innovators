import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { founder } from "@/data/content";

export const metadata: Metadata = {
  title: "Founder's Note",
  description:
    "Read the founder's message about BioCode Innovators, its research mission, and its commitment to scientific learning and student opportunities.",
};

export default function Founder() {
  const initials = founder.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2);

  return (
    <>
      <PageHeader title="Founder's Note" intro={founder.headline} />

      <section className="container-page grid items-center gap-12 py-16 lg:grid-cols-[20rem_1fr] lg:gap-16">
        <div className="text-center">
          {founder.image ? (
            <img
              src={founder.image}
              alt={`Portrait of ${founder.name}`}
              className="mx-auto aspect-square w-64 rounded-full object-cover ring-4 ring-accent/40 ring-offset-4 ring-offset-bg sm:w-72"
            />
          ) : (
            <div
              aria-hidden="true"
              className="mx-auto flex aspect-square w-64 items-center justify-center rounded-full bg-secondary font-heading text-6xl font-semibold text-accent sm:w-72"
            >
              {initials}
            </div>
          )}
        </div>

        <div>
          <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-accent">
            A message from {founder.name}
          </p>

          <blockquote className="border-l-4 border-primary pl-6 sm:pl-10">
            {founder.note.map((paragraph, index) => (
              <p
                key={index}
                className={`text-lg font-bold italic leading-snug text-secondary sm:text-xl lg:text-2xl ${
                  index > 0 ? "mt-6" : ""
                }`}
              >
                {index === 0 ? "“" : ""}
                {paragraph}
                {index === founder.note.length - 1 ? "”" : ""}
              </p>
            ))}
          </blockquote>
        </div>
      </section>
    </>
  );
}
