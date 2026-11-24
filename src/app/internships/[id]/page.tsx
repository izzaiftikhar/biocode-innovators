import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import StudentPanel from "./StudentPanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Internship details",
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InternshipDetail({
  params,
}: {
  params: { id: string };
}) {
  if (!UUID.test(params.id)) notFound();

  const db = createServerSupabase();

  const { data: internship } = await db
    .from("internships")
    .select(
      "id, title, department, duration, mode, is_paid, stipend_details, is_open, published, description"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!internship) notFound();

  const user = await getSessionUser();

  const { data: enrollment } = user
    ? await db
        .from("internship_enrollments")
        .select("id")
        .eq("internship_id", internship.id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  // Unpublished internships stay visible to students who already enrolled.
  if (!internship.published && !enrollment) notFound();

  const { data: tasks } = await db
    .from("internship_tasks")
    .select("id, position, title")
    .eq("internship_id", internship.id)
    .order("position", { ascending: true });

  const canApply = internship.is_open;

  const info: { label: string; value: string }[] = [
    { label: "Department", value: internship.department || "Not specified" },
    { label: "Duration", value: internship.duration || "Not specified" },
    { label: "Work arrangement", value: internship.mode || "Not specified" },
    {
      label: "Type",
      value: internship.is_paid
        ? `Paid${internship.stipend_details ? ` · ${internship.stipend_details}` : ""}`
        : "Unpaid",
    },
    {
      label: "Status",
      value: enrollment ? "You are enrolled" : canApply ? "Open" : "Closed",
    },
  ];

  return (
    <>
      <PageHeader
        title={internship.title}
        intro={
          enrollment
            ? "Your internship panel: instructions, tasks, submission, payment and certificate."
            : "Internship details, requirements and the modules you will complete."
        }
      />

      <section className="container-page grid gap-8 py-14 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-10">

          <div>
            <h2 className="text-xl font-semibold">About this internship</h2>
            {internship.description ? (
              <p className="mt-4 whitespace-pre-line break-words leading-7">
                {internship.description}
              </p>
            ) : (
              <p className="mt-4 text-muted">
                A full description has not been added yet.
              </p>
            )}
          </div>

          {user && enrollment ? (
            <StudentPanel userId={user.id} enrollmentId={enrollment.id} />
          ) : (
            <div>
              <h2 className="text-xl font-semibold">Internship modules</h2>
              <p className="mt-1 text-sm text-muted">
                You will complete these tasks. Full instructions are unlocked
                on your internship panel after you apply.
              </p>

              {!tasks?.length ? (
                <p className="mt-4 rounded-lg border border-dashed border-line p-4 text-sm text-muted">
                  Modules will be announced soon.
                </p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {tasks.map((task) => (
                    <li key={task.id} className="rounded-lg border border-line p-4">
                      <p className="break-words font-medium">
                        Module {task.position}: {task.title}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        <aside className="h-fit min-w-0 rounded-lg border border-line p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">Internship information</h2>

          <dl className="mt-4 space-y-3 text-sm">
            {info.map((item) => (
              <div key={item.label}>
                <dt className="text-muted">{item.label}</dt>
                <dd className="break-words font-medium">{item.value}</dd>
              </div>
            ))}
          </dl>

          {enrollment ? (
            <p className="mt-6 rounded-lg bg-surface p-3 text-sm">
              You are enrolled. Continue in your internship panel.
            </p>
          ) : canApply ? (
            <Link
              href={`/internships/apply?internship=${encodeURIComponent(internship.id)}`}
              className="btn mt-6 w-full justify-center"
            >
              Apply now
            </Link>
          ) : (
            <p className="mt-6 rounded-lg bg-surface p-3 text-sm">
              Applications are closed for this internship.
            </p>
          )}

          <Link
            href="/internships"
            className="arrow-link mt-4 inline-block text-sm"
          >
            ← All internships
          </Link>
        </aside>
      </section>
    </>
  );
}
