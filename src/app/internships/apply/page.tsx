import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import ApplyForm from "./ApplyForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Apply for an internship",
};

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: { internship?: string };
}) {
  const internshipId =
    typeof searchParams.internship === "string" ? searchParams.internship : "";

  if (!internshipId) redirect("/internships");

  const user = await getSessionUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(
        `/internships/apply?internship=${internshipId}`
      )}`
    );
  }

  const db = createServerSupabase();

  const [{ data: internship }, { data: enrollment }, { data: profile }] =
    await Promise.all([
      db
        .from("internships")
        .select("id, title, department, duration, mode, is_open, published")
        .eq("id", internshipId)
        .maybeSingle(),
      db
        .from("internship_enrollments")
        .select("id")
        .eq("internship_id", internshipId)
        .eq("user_id", user.id)
        .maybeSingle(),
      db.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    ]);

  let content: React.ReactNode;

  if (!internship || !internship.published) {
    content = (
      <>
        <p>This internship could not be found.</p>
        <Link href="/internships" className="btn mt-5">
          Back to internships
        </Link>
      </>
    );
  } else if (enrollment) {
    content = (
      <>
        <p className="font-semibold">You have already applied.</p>
        <p className="mt-2 text-muted">
          Your instructions, tasks and submission are in your internship panel.
        </p>
        <Link href={`/internships/${internship.id}`} className="btn mt-5">
          Open my internship
        </Link>
      </>
    );
  } else if (!internship.is_open) {
    content = (
      <>
        <p className="font-semibold">Applications are closed.</p>
        <p className="mt-2 text-muted">
          This internship is no longer accepting applications.
        </p>
        <Link href="/internships" className="btn mt-5">
          Back to internships
        </Link>
      </>
    );
  } else {
    content = (
      <>
        <h2 className="text-xl font-semibold">{internship.title}</h2>
        <p className="mt-2 text-sm text-muted">
          {[internship.department, internship.duration, internship.mode]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <ApplyForm
          internshipId={internship.id}
          email={user.email ?? ""}
          initialName={profile?.full_name?.trim() ?? ""}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Apply for an internship"
        intro="Confirm your name to enroll. We will email you a confirmation."
      />

      <section className="container-page py-14">
        <div className="max-w-2xl rounded-lg border border-line p-6">
          {content}
        </div>
      </section>
    </>
  );
}
