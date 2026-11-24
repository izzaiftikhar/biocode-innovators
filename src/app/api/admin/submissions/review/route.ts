
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser, isAdmin } from "@/lib/auth/server";
import { completeModule } from "@/lib/courses/unlock";

export const runtime = "nodejs";

const MAX_MARKS = 20;

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    if (!(await isAdmin(user.id))) {
      return NextResponse.json(
        { error: "Only an admin can review submissions." },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      submissionId?: unknown;
      decision?: unknown;
      score?: unknown;
      feedback?: unknown;
    } | null;

    if (
      !body ||
      typeof body.submissionId !== "string" ||
      !body.submissionId.trim() ||
      (body.decision !== "approved" &&
        body.decision !== "changes_requested") ||
      typeof body.score !== "number" ||
      !Number.isInteger(body.score) ||
      body.score < 0 ||
      body.score > MAX_MARKS ||
      typeof body.feedback !== "string" ||
      !body.feedback.trim()
    ) {
      return NextResponse.json(
        {
          error: `Provide a whole-number score from 0 to ${MAX_MARKS} and written feedback.`,
        },
        { status: 400 }
      );
    }

    const db = createServerSupabase();

    const { data: submission, error: submissionError } = await db
      .from("submissions")
      .select("id, user_id, assignment_id")
      .eq("id", body.submissionId)
      .maybeSingle();

    if (submissionError) {
      console.error("Submission lookup failed:", submissionError);
      return NextResponse.json(
        { error: "Could not load the submission." },
        { status: 500 }
      );
    }

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found." },
        { status: 404 }
      );
    }

    // Only the student's newest submission can be reviewed.
    const { data: latest, error: latestError } = await db
      .from("submissions")
      .select("id")
      .eq("user_id", submission.user_id)
      .eq("assignment_id", submission.assignment_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.error("Latest submission lookup failed:", latestError);
      return NextResponse.json(
        { error: "Could not verify the latest submission." },
        { status: 500 }
      );
    }

    if (!latest || latest.id !== submission.id) {
      return NextResponse.json(
        {
          error:
            "The student has uploaded a newer version. Review the newest submission instead.",
        },
        { status: 409 }
      );
    }

    // Verify the assignment and its module before saving the review.
    const { data: assignment, error: assignmentError } = await db
      .from("assignments")
      .select("module_id")
      .eq("id", submission.assignment_id)
      .maybeSingle();

    if (assignmentError) {
      console.error("Assignment lookup failed:", assignmentError);
      return NextResponse.json(
        { error: "Could not verify the assignment." },
        { status: 500 }
      );
    }

    if (!assignment) {
      return NextResponse.json(
        { error: "The assignment linked to this submission was not found." },
        { status: 404 }
      );
    }

    const { data: module, error: moduleError } = await db
      .from("modules")
      .select("id, course_id")
      .eq("id", assignment.module_id)
      .maybeSingle();

    if (moduleError) {
      console.error("Module lookup failed:", moduleError);
      return NextResponse.json(
        { error: "Could not verify the course module." },
        { status: 500 }
      );
    }

    if (!module) {
      return NextResponse.json(
        { error: "The module linked to this assignment was not found." },
        { status: 404 }
      );
    }

    const { data: moduleAssignments, error: moduleAssignmentsError } =
      await db
        .from("assignments")
        .select("id")
        .eq("module_id", module.id);

    if (moduleAssignmentsError) {
      console.error(
        "Module assignments lookup failed:",
        moduleAssignmentsError
      );
      return NextResponse.json(
        { error: "Could not verify all module assignments." },
        { status: 500 }
      );
    }

    if (!moduleAssignments?.length) {
      return NextResponse.json(
        { error: "No assignments were found for this module." },
        { status: 500 }
      );
    }

    const { data: updated, error: updateError } = await db
      .from("submissions")
      .update({
        score: body.score,
        mentor_comment: body.feedback.trim(),
        review_status: body.decision,
      })
      .eq("id", submission.id)
      .select(
        "id, user_id, assignment_id, file_path, score, review_status, mentor_comment, created_at"
      )
      .single();

    if (updateError || !updated) {
      console.error("Review save failed:", updateError);
      return NextResponse.json(
        { error: "Could not save the review." },
        { status: 500 }
      );
    }

    let moduleCompleted = false;
    let courseComplete = false;

    if (body.decision === "approved") {
      let allApproved = true;

      for (const item of moduleAssignments) {
        // Use the decision just saved for the current submission.
        if (item.id === submission.assignment_id) {
          continue;
        }

        const { data: itemLatest, error: itemLatestError } = await db
          .from("submissions")
          .select("review_status")
          .eq("user_id", submission.user_id)
          .eq("assignment_id", item.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (itemLatestError) {
          console.error(
            "Assignment review status lookup failed:",
            itemLatestError
          );
          return NextResponse.json(
            {
              error:
                "The review was saved, but module completion could not be verified.",
            },
            { status: 500 }
          );
        }

        if (itemLatest?.review_status !== "approved") {
          allApproved = false;
          break;
        }
      }

      if (allApproved) {
        const result = await completeModule(
          submission.user_id,
          module.course_id,
          module.id
        );

        moduleCompleted = true;
        courseComplete = result === "course_complete";
      } else {
        const { error: progressError } = await db
          .from("module_progress")
          .update({ status: "under_review" })
          .eq("user_id", submission.user_id)
          .eq("module_id", module.id)
          .eq("status", "submitted");

        if (progressError) {
          console.error("Module progress update failed:", progressError);
          return NextResponse.json(
            {
              error:
                "The review was saved, but module progress could not be updated.",
            },
            { status: 500 }
          );
        }
      }
    } else {
      const { error: progressError } = await db
        .from("module_progress")
        .update({ status: "unlocked" })
        .eq("user_id", submission.user_id)
        .eq("module_id", module.id)
        .in("status", ["submitted", "under_review"]);

      if (progressError) {
        console.error("Module progress update failed:", progressError);
        return NextResponse.json(
          {
            error:
              "The review was saved, but the module could not be reopened.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      submission: updated,
      moduleCompleted,
      courseComplete,
    });
  } catch (error) {
    console.error("Submission review failed:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred while saving the review." },
      { status: 500 }
    );
  }
}
