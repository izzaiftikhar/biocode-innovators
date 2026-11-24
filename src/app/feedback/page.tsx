import type { Metadata } from "next";
import FeedbackWall, { type PublicFeedback } from "@/components/FeedbackWall";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Student Feedback | Biocode Innovators",
  description: "Read what students and researchers say about learning with Biocode Innovators.",
};

type Row = {
  id: string;
  feedback_type: "platform" | "course";
  course_id: string | null;
  rating: number | null;
  content: string;
  admin_edited_content: string | null;
  public_display_name: string | null;
};

export default async function FeedbackPage() {
  const db = createServerSupabase();

  const { data, error } = await db
    .from("student_feedback")
    .select(
      "id, feedback_type, course_id, rating, content, admin_edited_content, public_display_name"
    )
    .eq("is_published", true)
    .eq("status", "approved")
    .eq("public_consent", true)
    .contains("display_placement", ["feedback_page"])
    .order("published_at", { ascending: false });

  if (error) console.error("Public feedback lookup failed:", error);

  const rows = (data ?? []) as Row[];

  const courseIds = [
    ...new Set(rows.map((r) => r.course_id).filter((id): id is string => !!id)),
  ];
  const titles = new Map<string, string>();

  if (courseIds.length > 0) {
    const { data: courses } = await db
      .from("courses")
      .select("id, title")
      .in("id", courseIds);
    for (const c of courses ?? []) titles.set(c.id, c.title);
  }

  const items: PublicFeedback[] = rows
    .map((r) => ({
      id: r.id,
      display_name: r.public_display_name?.trim() || "BioCode student",
      message: (r.admin_edited_content?.trim() || r.content).trim(),
      rating: r.rating,
      type: r.feedback_type,
      course_title: r.course_id ? titles.get(r.course_id) ?? null : null,
    }))
    .filter((i) => i.message.length > 0);

  return <FeedbackWall items={items} />;
}
