import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

const STATUS_TEXT: Record<string, string> = {
  none: "Not submitted",
  submitted: "Awaiting review",
  approved: "Approved",
  needs_revision: "Revision requested",
};

export default async function InternshipsSection({
  userId,
}: {
  userId: string;
}) {
  const db = createServerSupabase();

  const { data: enrollments } = await db
    .from("internship_enrollments")
    .select("id, internship_id, reference_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!enrollments?.length) return null;

  const internshipIds = enrollments.map((e) => e.internship_id);
  const enrollmentIds = enrollments.map((e) => e.id);

  const [
    { data: internships },
    { data: finals },
    { data: payments },
    { data: certificates },
  ] = await Promise.all([
    db.from("internships").select("id, title, end_date").in("id", internshipIds),
    db
      .from("internship_final_submissions")
      .select("enrollment_id, status")
      .in("enrollment_id", enrollmentIds),
    db
      .from("internship_payments")
      .select("enrollment_id, status")
      .in("enrollment_id", enrollmentIds),
    db
      .from("internship_certificates")
      .select("enrollment_id")
      .in("enrollment_id", enrollmentIds),
  ]);

  return (
    <div className="mt-8 rounded-lg border border-line p-6">
      <h2 className="text-xl font-semibold">My internships</h2>

      <ul className="mt-5 space-y-4">
        {enrollments.map((enrollment) => {
          const internship = (internships ?? []).find(
            (i) => i.id === enrollment.internship_id
          );
          const sub = (finals ?? []).find((f) => f.enrollment_id === enrollment.id);
          const pay = (payments ?? []).find((p) => p.enrollment_id === enrollment.id);
          const hasCert = (certificates ?? []).some(
            (c) => c.enrollment_id === enrollment.id
          );

          return (
            <li
              key={enrollment.id}
              className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-white p-5 sm:flex-row sm:items-center"
            >
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">
                  {internship?.title ?? "Internship"}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Reference {enrollment.reference_id}
                </p>
                <p className="mt-2 text-sm">
                  Submission: {STATUS_TEXT[sub?.status ?? "none"]} · Payment:{" "}
                  {pay?.status ?? "not started"} · Certificate:{" "}
                  {hasCert ? "ready" : "not yet"}
                </p>
              </div>

              <Link
                href={`/internships/${enrollment.internship_id}`}
                className="btn shrink-0"
              >
                Open internship panel
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
