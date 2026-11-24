
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser, isAdmin } from "@/lib/auth/server";
import { clearKnowledgeCache } from "@/lib/chat/knowledge";

export const runtime = "nodejs";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireAdmin() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      { error: "Please sign in." },
      { status: 401 }
    );
  }

  if (!(await isAdmin(user.id))) {
    return NextResponse.json(
      { error: "Only an admin can do this." },
      { status: 403 }
    );
  }

  return null;
}

const bad = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

function clean(body: Record<string, unknown>) {
  const topic =
    typeof body.topic === "string" ? body.topic.trim() : "";
  const answer =
    typeof body.answer === "string" ? body.answer.trim() : "";
  const href =
    typeof body.linkHref === "string" ? body.linkHref.trim() : "";
  const label =
    typeof body.linkLabel === "string" ? body.linkLabel.trim() : "";

  if (topic.length < 3 || topic.length > 150) {
    return { error: "The topic must be 3 to 150 characters." };
  }

  if (answer.length < 3 || answer.length > 2000) {
    return { error: "The answer must be 3 to 2000 characters." };
  }

  if (href && !/^(\/(?!\/)|https:\/\/)/.test(href)) {
    return {
      error:
        "The link must start with / (a page on this site) or https://.",
    };
  }

  if (href && !label) {
    return { error: "Add a label for the link, or clear the link." };
  }

  if (label.length > 60) {
    return { error: "The link label is too long." };
  }

  if (typeof body.isPublished !== "boolean") {
    return { error: "Invalid request." };
  }

  return {
    value: {
      topic,
      answer,
      link_href: href || null,
      link_label: href ? label : null,
      is_published: body.isPublished,
      updated_at: new Date().toISOString(),
    },
  };
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const db = createServerSupabase();

  const [knowledgeResult, questionsResult] = await Promise.all([
    db
      .from("chatbot_knowledge")
      .select(
        "id, topic, answer, link_href, link_label, is_published, updated_at"
      )
      .order("updated_at", { ascending: false }),

    db
      .from("chatbot_unanswered_questions")
      .select("id, question, status, created_at, answer")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (knowledgeResult.error) {
    console.error(
      "Chatbot knowledge list failed:",
      knowledgeResult.error.message
    );
    return bad(
      "Could not load knowledge entries. Check migration 007.",
      500
    );
  }

  if (questionsResult.error) {
    console.error(
      "Chatbot unanswered questions list failed:",
      questionsResult.error.message
    );
    return bad(
      "Could not load review questions. Check that migration 008 was successfully run in Supabase.",
      500
    );
  }

  return NextResponse.json({
    entries: knowledgeResult.data ?? [],
    unanswered: questionsResult.data ?? [],
  });
}

/**
 * Supported actions:
 * save, delete, resolveQuestion, dismissQuestion
 */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!body || typeof body.action !== "string") {
    return bad("Invalid request.");
  }

  const db = createServerSupabase();
  const hasId =
    typeof body.id === "string" && UUID.test(body.id);

  if (body.action === "delete") {
    if (!hasId) return bad("Invalid entry.");

    const { error } = await db
      .from("chatbot_knowledge")
      .delete()
      .eq("id", body.id as string);

    if (error) {
      console.error("Chatbot knowledge delete failed:", error.message);
      return bad("Could not delete the entry.", 500);
    }

    clearKnowledgeCache();
    return NextResponse.json({ ok: true });
  }

  if (body.action === "save") {
    const parsed = clean(body);
    if ("error" in parsed) {
      return bad(parsed.error as string);
    }

    if (
      body.id !== undefined &&
      body.id !== null &&
      !hasId
    ) {
      return bad("Invalid entry.");
    }

    const result = hasId
      ? await db
          .from("chatbot_knowledge")
          .update(parsed.value)
          .eq("id", body.id as string)
          .select("id")
      : await db
          .from("chatbot_knowledge")
          .insert(parsed.value)
          .select("id");

    if (result.error) {
      console.error(
        "Chatbot knowledge save failed:",
        result.error.message
      );
      return bad("Could not save the entry.", 500);
    }

    if (hasId && !result.data?.length) {
      return bad("Entry not found.", 404);
    }

    clearKnowledgeCache();
    return NextResponse.json({ ok: true });
  }

  if (
    body.action === "resolveQuestion" ||
    body.action === "dismissQuestion"
  ) {
    if (
      typeof body.questionId !== "string" ||
      !UUID.test(body.questionId)
    ) {
      return bad("Invalid question.");
    }

    const { data: question, error: questionError } = await db
      .from("chatbot_unanswered_questions")
      .select("id, question, status")
      .eq("id", body.questionId)
      .maybeSingle();

    if (questionError) {
      console.error(
        "Chatbot question lookup failed:",
        questionError.message
      );
      return bad("Could not load the selected question.", 500);
    }

    if (!question) return bad("Question not found.", 404);

    if (
      question.status === "resolved" ||
      question.status === "dismissed"
    ) {
      return bad(
        "This question has already been resolved or dismissed.",
        409
      );
    }

    const reviewer = await getSessionUser();
    if (!reviewer) {
      return bad("Please sign in again.", 401);
    }

    if (body.action === "dismissQuestion") {
      const { data, error } = await db
        .from("chatbot_unanswered_questions")
        .update({
          status: "dismissed",
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewer.id,
        })
        .eq("id", question.id)
        .in("status", ["pending", "reviewed"])
        .select("id");

      if (error) {
        console.error(
          "Chatbot question dismissal failed:",
          error.message
        );
        return bad("Could not dismiss the question.", 500);
      }

      if (!data?.length) {
        return bad("The question was already handled.", 409);
      }

      return NextResponse.json({ ok: true });
    }

    // Use the supplied topic, or derive one from the original question.
    const suppliedTopic =
      typeof body.topic === "string" ? body.topic.trim() : "";

    const topic =
      suppliedTopic ||
      `Student question: ${question.question.trim()}`.slice(0, 150);

    const answer =
      typeof body.answer === "string" ? body.answer.trim() : "";
    const href =
      typeof body.linkHref === "string" ? body.linkHref.trim() : "";
    const label =
      typeof body.linkLabel === "string" ? body.linkLabel.trim() : "";

    if (topic.length < 3 || topic.length > 150) {
      return bad("The topic must be 3 to 150 characters.");
    }

    if (answer.length < 3 || answer.length > 2000) {
      return bad("The answer must be 3 to 2000 characters.");
    }

    if (href && !/^(\/(?!\/)|https:\/\/)/.test(href)) {
      return bad("The link must start with / or https://.");
    }

    if (href && !label) {
      return bad("Add a label for the link, or clear the link.");
    }

    if (label.length > 60) {
      return bad("The link label is too long.");
    }

    // Publish the admin-approved answer into the existing knowledge base.
    const { error: insertError } = await db
      .from("chatbot_knowledge")
      .insert({
        topic,
        answer,
        link_href: href || null,
        link_label: href ? label : null,
        is_published: true,
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error(
        "Approved chatbot answer save failed:",
        insertError.message
      );
      return bad("Could not publish the approved answer.", 500);
    }

    const { data: updated, error: updateError } = await db
      .from("chatbot_unanswered_questions")
      .update({
        status: "resolved",
        answer,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewer.id,
      })
      .eq("id", question.id)
      .in("status", ["pending", "reviewed"])
      .select("id");

    if (updateError || !updated?.length) {
      console.error(
        "Chatbot question resolution failed:",
        updateError?.message ?? "Question status changed."
      );

      return bad(
        "The answer was published, but the question status could not be updated. Please check the review queue before retrying.",
        500
      );
    }

    clearKnowledgeCache();

    return NextResponse.json({ ok: true });
  }

  return bad("Unknown action.");
}
