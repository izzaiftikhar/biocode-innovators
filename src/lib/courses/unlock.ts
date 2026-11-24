import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Call after every assignment of a module is approved.
 * Marks the module completed and unlocks the next one.
 * Returns "course_complete" when the last module is finished.
 */
export async function completeModule(userId: string, courseId: string, moduleId: string) {
  const db = createServerSupabase();

  const { data: modules, error } = await db
    .from("modules").select("id, position").eq("course_id", courseId).order("position");
  if (error || !modules) throw new Error("Could not load modules");

  const { error: completeError } = await db.from("module_progress")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("user_id", userId).eq("module_id", moduleId);
  if (completeError) throw new Error("Could not mark the module completed");

  const index = modules.findIndex((m) => m.id === moduleId);
  const next = modules[index + 1];
  if (!next) return "course_complete" as const;

  const { error: unlockError } = await db.from("module_progress")
    .update({ status: "unlocked" })
    .eq("user_id", userId).eq("module_id", next.id).eq("status", "locked");
  if (unlockError) throw new Error("Could not unlock the next module");

  return "next_unlocked" as const;
}

/** Server-side guard: use before returning any module content or accepting module work. */
export async function canOpenModule(userId: string, moduleId: string) {
  const db = createServerSupabase();
  const { data } = await db.from("module_progress").select("status")
    .eq("user_id", userId).eq("module_id", moduleId).maybeSingle();
  return !!data && data.status !== "locked";
}
