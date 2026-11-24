
import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Research Community",
  description:
    "Join the BioCode Innovators community to explore courses, research opportunities, updates, and verifiable certificates.",
};

export default function Community() {
  return (
    <>
      <PageHeader
        title="Community"
        intro="Connect with BioCode Innovators and explore opportunities to learn, research and grow."
      />

      <section className="container-page py-14">
        <div className="flex flex-col items-start justify-between gap-8 rounded-2xl border border-line bg-surface/50 p-7 sm:p-9 lg:flex-row lg:items-center">
          <div className="min-w-0 max-w-2xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
              Join our community
            </p>

            <h2 className="font-heading text-2xl font-semibold text-ink sm:text-3xl">
              Learn. Research. Grow.
            </h2>

            <p className="mt-4 leading-7 text-muted">
              Create your BioCode Innovators account to explore courses,
              track your learning progress, apply for research and internship
              opportunities, follow community updates, and earn certificates
              with public verification.
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto">
            <Link
              href="/login"
              className="btn inline-flex w-full items-center justify-center whitespace-nowrap sm:w-auto"
            >
              Create your account
            </Link>

            <p className="text-center text-xs text-muted">
              Already a member?{" "}
              <Link
                href="/login"
                className="font-semibold text-primary hover:underline"
              >
                Log in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
