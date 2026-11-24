import type { SupabaseClient } from "@supabase/supabase-js";

/** Share of the video (unique seconds) a student must watch. */
export const WATCH_THRESHOLD = 0.9;

export function watchRequirementMet(watchedSeconds: number, durationSeconds: number) {
  return (
    durationSeconds > 0 &&
    watchedSeconds >= Math.ceil(durationSeconds * WATCH_THRESHOLD)
  );
}

export type WatchStatus = {
  required: boolean;
  met: boolean;
  watchedSeconds: number;
  durationSeconds: number;
};

/**
 * Server-side truth about whether a student has watched enough of a module's video.
 * Modules without a video never require watching. If the admin replaced the video
 * after the student watched the old one, the old coverage does not count.
 */
export async function getWatchStatus(
  db: SupabaseClient,
  userId: string,
  moduleId: string,
  youtubeId: string | null
): Promise<WatchStatus> {
  if (!youtubeId) {
    return { required: false, met: true, watchedSeconds: 0, durationSeconds: 0 };
  }

  const none: WatchStatus = {
    required: true,
    met: false,
    watchedSeconds: 0,
    durationSeconds: 0,
  };

  const { data: progress, error } = await db
    .from("module_watch_progress")
    .select("duration_seconds, youtube_id")
    .eq("user_id", userId)
    .eq("module_id", moduleId)
    .maybeSingle();

  if (error || !progress) return none;
  if (progress.youtube_id && progress.youtube_id !== youtubeId) return none;

  const { count, error: countError } = await db
    .from("module_watch_intervals")
    .select("start_second", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("module_id", moduleId);

  if (countError || count === null) return none;

  const durationSeconds = progress.duration_seconds ?? 0;
  const watchedSeconds = Math.min(count, durationSeconds);

  return {
    required: true,
    met: watchRequirementMet(watchedSeconds, durationSeconds),
    watchedSeconds,
    durationSeconds,
  };
}
