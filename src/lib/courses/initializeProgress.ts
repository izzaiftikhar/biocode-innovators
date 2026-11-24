import { createServerSupabase } from "@/lib/supabase/server";

export async function initializeCourseProgress(
  userId: string,
  courseId: string,
) {
  const db = createServerSupabase();

  const { data: modules, error: modulesError } = await db
    .from("modules")
    .select("id, position")
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  if (modulesError) {
    throw new Error("Could not load course modules.");
  }

  if (!modules?.length) return;

  const moduleIds = modules.map((module) => module.id);

  const { data: existing, error: progressError } = await db
    .from("module_progress")
    .select("module_id, status")
    .eq("user_id", userId)
    .in("module_id", moduleIds);

  if (progressError) {
    throw new Error("Could not load student progress.");
  }

  const existingByModule = new Map(
    (existing ?? []).map((item) => [item.module_id, item.status]),
  );

  // Preserve completed modules and find the first module not completed.
  const firstIncompleteIndex = modules.findIndex(
    (module) => existingByModule.get(module.id) !== "completed",
  );

  // Create any missing progress records.
  const rowsToInsert = modules
    .filter((module) => !existingByModule.has(module.id))
    .map((module, index) => {
      const moduleIndex = modules.findIndex(
        (item) => item.id === module.id,
      );

      return {
        user_id: userId,
        module_id: module.id,
        status:
          firstIncompleteIndex !== -1 &&
          moduleIndex === firstIncompleteIndex
            ? "unlocked"
            : "locked",
      };
    });

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await db
      .from("module_progress")
      .insert(rowsToInsert);

    if (insertError) {
      // Another request may have initialized progress simultaneously.
      if (insertError.code !== "23505") {
        throw new Error("Could not initialize student progress.");
      }
    }
  }

  // Re-read after insertion so we repair the sequence using actual DB state.
  const { data: progress, error: refreshedError } = await db
    .from("module_progress")
    .select("module_id, status")
    .eq("user_id", userId)
    .in("module_id", moduleIds);

  if (refreshedError || !progress) {
    throw new Error("Could not verify student progress.");
  }

  const statusByModule = new Map(
    progress.map((item) => [item.module_id, item.status]),
  );

  const nextIncompleteIndex = modules.findIndex(
    (module) => statusByModule.get(module.id) !== "completed",
  );

  // Never overwrite completed or submitted work.
  for (let index = 0; index < modules.length; index++) {
    const module = modules[index];
    const currentStatus = statusByModule.get(module.id);

    if (
      currentStatus === "completed" ||
      currentStatus === "submitted" ||
      currentStatus === "under_review"
    ) {
      continue;
    }

    const desiredStatus =
      index === nextIncompleteIndex ? "unlocked" : "locked";

    if (currentStatus === desiredStatus) continue;

    const { error: updateError } = await db
      .from("module_progress")
      .update({ status: desiredStatus })
      .eq("user_id", userId)
      .eq("module_id", module.id);

    if (updateError) {
      throw new Error("Could not repair student module access.");
    }
  }
}
