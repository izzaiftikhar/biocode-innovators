
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import { getQuizState } from "@/lib/courses/quiz";
import QuizRunner from "./QuizRunner";
import RetakeQuizButton from "./RetakeQuizButton";

export const dynamic = "force-dynamic";

function Notice({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <section className="container-page py-14">
      <div className="rounded-lg border border-line p-6">
        <h2 className="text-xl font-semibold">{title}</h2>

        <p className="mt-2 text-muted">{text}</p>

        <Link href="/dashboard" className="btn mt-5">
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}

export default async function QuizPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(
        `/courses/${params.slug}/quiz`,
      )}`,
    );
  }

  const db = createServerSupabase();

  const { data: course, error: courseError } = await db
    .from("courses")
    .select("id, title, published")
    .eq("slug", params.slug)
    .maybeSingle();

  if (courseError) {
    throw new Error("Could not load this course.");
  }

  if (!course || !course.published) {
    notFound();
  }

  const quiz = await getQuizState(db, user.id, course.id);

  let body;

  if (quiz.state === "not_enrolled") {
    body = (
      <Notice
        title="Enrol first"
        text="You need to enrol in this course before taking its final quiz."
      />
    );
  } else if (quiz.state === "modules_incomplete") {
    body = (
      <Notice
        title="Not available yet"
        text="The final quiz unlocks after every module is approved."
      />
    );
  } else if (quiz.state === "no_quiz") {
    body = (
      <Notice
        title="No quiz for this course"
        text="This course does not have a published final quiz right now."
      />
    );
  } else if (quiz.state === "attempted") {
    body = (
      <section className="container-page py-14">
        <div className="rounded-lg border border-line p-6">
          <h2 className="text-xl font-semibold">
            {quiz.passed
              ? "You passed the final quiz!"
              : "Quiz attempt completed"}
          </h2>

          <p className="mt-3 text-lg">
            Score: <strong>{quiz.percent}%</strong> (
            {quiz.score} of {quiz.total} correct)
          </p>

          <p className="mt-1 text-sm text-muted">
            Required pass mark: {quiz.passPercent}%
          </p>

          <p className="mt-4 text-sm text-muted">
            Attempt {quiz.attemptNumber} is saved in your quiz history.
            Previous attempts and certificates are preserved when you retake.
          </p>

          {quiz.passed && (
            <p className="mt-2 text-sm text-muted">
              Your certificate is available on your dashboard.
            </p>
          )}

          <RetakeQuizButton courseId={course.id} />
        </div>
      </section>
    );
  } else {
    body = (
      <section className="container-page py-14">
        <QuizRunner
          courseId={course.id}
          passPercent={quiz.passPercent}
          questionCount={quiz.questions.length}
        />
      </section>
    );
  }

  return (
    <>
      <PageHeader
        title={`Final quiz: ${course.title}`}
        intro="Pass this quiz to unlock your certificate."
      />

      {body}
    </>
  );
}
