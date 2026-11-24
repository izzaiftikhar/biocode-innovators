
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import { createServerSupabase } from "@/lib/supabase/server";
import { completeModule } from "@/lib/courses/unlock";
import { watchRequirementMet } from "@/lib/courses/watch";

export const runtime = "nodejs";

const MAX_VIDEO_SECONDS = 6 * 60 * 60;
const MAX_ACCEPTED_GAP_SECONDS = 60;
const MAX_CREDIT_PER_REPORT_SECONDS = 60;
const SEEK_TOLERANCE_SECONDS = 5;
const MIN_REPORT_INTERVAL_SECONDS = 1;

async function getAuthenticatedUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Authentication is not configured." },
        { status: 500 },
      ),
    };
  }

  const cookieStore = cookies();

  const authSupabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Cookie updates may not be allowed in every context.
          }
        },
      },
    },
  );

  const {
    data: { user },
    error,
  } = await authSupabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Please sign in to save lecture progress." },
        { status: 401 },
      ),
    };
  }

  return { user, errorResponse: null };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      moduleId?: unknown;
      positionSeconds?: unknown;
      durationSeconds?: unknown;
      playing?: unknown;
    } | null;

    if (
      !body ||
      typeof body.moduleId !== "string" ||
      !body.moduleId.trim() ||
      typeof body.positionSeconds !== "number" ||
      !Number.isFinite(body.positionSeconds) ||
      typeof body.durationSeconds !== "number" ||
      !Number.isFinite(body.durationSeconds) ||
      typeof body.playing !== "boolean" ||
      body.positionSeconds < 0 ||
      body.durationSeconds <= 0 ||
      body.durationSeconds > MAX_VIDEO_SECONDS ||
      body.positionSeconds > body.durationSeconds
    ) {
      return NextResponse.json(
        { error: "Invalid playback report." },
        { status: 400 },
      );
    }

    const { user, errorResponse } = await getAuthenticatedUser();

    if (errorResponse || !user) {
      return (
        errorResponse ??
        NextResponse.json(
          { error: "Please sign in to save lecture progress." },
          { status: 401 },
        )
      );
    }

    const db = createServerSupabase();

    const { data: module, error: moduleError } = await db
      .from("modules")
      .select("id, youtube_id, course_id")
      .eq("id", body.moduleId.trim())
      .maybeSingle();

    if (moduleError) {
      console.error("Watch-progress module lookup failed:", moduleError);
      return NextResponse.json(
        { error: "Could not verify this module." },
        { status: 500 },
      );
    }

    if (!module || !module.youtube_id) {
      return NextResponse.json(
        { error: "This module has no configured video lecture." },
        { status: 404 },
      );
    }

    const { data: access, error: accessError } = await db
      .from("module_progress")
      .select("status")
      .eq("user_id", user.id)
      .eq("module_id", module.id)
      .maybeSingle();

    if (accessError) {
      console.error("Watch-progress access check failed:", accessError);
      return NextResponse.json(
        { error: "Could not verify your access to this module." },
        { status: 500 },
      );
    }

    if (!access || access.status === "locked") {
      return NextResponse.json(
        { error: "This module is locked." },
        { status: 403 },
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const { data: existingRow, error: existingError } = await db
      .from("module_watch_progress")
      .select(
        "duration_seconds, completed_at, last_position_seconds, last_reported_at, youtube_id",
      )
      .eq("user_id", user.id)
      .eq("module_id", module.id)
      .maybeSingle();

    if (existingError) {
      console.error("Watch-progress lookup failed:", existingError);
      return NextResponse.json(
        { error: "Could not load lecture progress." },
        { status: 500 },
      );
    }

    let existing = existingRow;

    // Coverage belongs to one specific YouTube video.
    if (!existingRow || existingRow.youtube_id !== module.youtube_id) {
      const { error: resetError } = await db
        .from("module_watch_intervals")
        .delete()
        .eq("user_id", user.id)
        .eq("module_id", module.id);

      if (resetError) {
        console.error("Watch reset failed:", resetError);
        return NextResponse.json(
          { error: "Could not reset progress for the updated video." },
          { status: 500 },
        );
      }

      existing = null;
    }

    const duration = Math.floor(body.durationSeconds);
    const position = Math.floor(body.positionSeconds);

    let increment = 0;

    // Only forward playback reports can add coverage.
    // Paused reports update the baseline but never earn watch credit.
    if (
      body.playing &&
      existing?.last_reported_at &&
      Number.isInteger(existing.last_position_seconds)
    ) {
      const previousPosition = existing.last_position_seconds;
      const previousTime = new Date(
        existing.last_reported_at,
      ).getTime();

      const elapsed = (now.getTime() - previousTime) / 1000;
      const positionDelta = position - previousPosition;

      const validTiming =
        Number.isFinite(previousTime) &&
        elapsed >= MIN_REPORT_INTERVAL_SECONDS &&
        elapsed <= MAX_ACCEPTED_GAP_SECONDS;

      const plausiblePlayback =
        positionDelta > 0 &&
        positionDelta <= elapsed + SEEK_TOLERANCE_SECONDS;

      if (validTiming && plausiblePlayback) {
        // Credit actual forward video movement, never more than
        // elapsed wall-clock time or the accepted reporting gap.
        increment = Math.min(
          positionDelta,
          Math.floor(elapsed),
          MAX_CREDIT_PER_REPORT_SECONDS,
          duration,
        );
      }
    }

    if (increment > 0) {
      const intervalStart = position - increment;

      const intervals = Array.from(
        { length: increment },
        (_, offset) => intervalStart + offset,
      )
        .filter((second) => second >= 0 && second < duration)
        .map((second) => ({
          user_id: user.id,
          module_id: module.id,
          start_second: second,
          end_second: second + 1,
        }));

      if (intervals.length > 0) {
        const { error: intervalError } = await db
          .from("module_watch_intervals")
          .upsert(intervals, {
            onConflict: "user_id,module_id,start_second",
            ignoreDuplicates: true,
          });

        if (intervalError) {
          console.error("Watch interval save failed:", intervalError);
          return NextResponse.json(
            { error: "Could not save unique lecture coverage." },
            { status: 500 },
          );
        }
      }
    }

    const {
      count: uniqueWatchedSeconds,
      error: coverageError,
    } = await db
      .from("module_watch_intervals")
      .select("start_second", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("module_id", module.id)
      .gte("start_second", 0)
      .lt("start_second", duration);

    if (coverageError || uniqueWatchedSeconds === null) {
      console.error("Watch coverage lookup failed:", coverageError);
      return NextResponse.json(
        { error: "Could not calculate lecture coverage." },
        { status: 500 },
      );
    }

    const watchedSeconds = uniqueWatchedSeconds;
    const reachedWatchThreshold = watchRequirementMet(
      watchedSeconds,
      duration,
    );

    const completedAt = reachedWatchThreshold
      ? existing?.completed_at ?? nowIso
      : existing?.completed_at ?? null;

    // Update the reporting baseline only after coverage writes succeed.
    // This also establishes a fresh baseline after a pause or rejected seek.
    const { error: saveError } = await db
      .from("module_watch_progress")
      .upsert(
        {
          user_id: user.id,
          module_id: module.id,
          youtube_id: module.youtube_id,
          watched_seconds: watchedSeconds,
          duration_seconds: duration,
          last_position_seconds: Math.min(position, duration),
          last_reported_at: nowIso,
          completed_at: completedAt,
          updated_at: nowIso,
        },
        { onConflict: "user_id,module_id" },
      );

    if (saveError) {
      console.error("Watch-progress save failed:", saveError);
      return NextResponse.json(
        { error: "Could not save lecture progress." },
        { status: 500 },
      );
    }

    if (reachedWatchThreshold && access.status !== "completed") {
      const {
        count: assignmentCount,
        error: assignmentError,
      } = await db
        .from("assignments")
        .select("id", { count: "exact", head: true })
        .eq("module_id", module.id);

      if (assignmentError || assignmentCount === null) {
        console.error(
          "Module assignment lookup failed:",
          assignmentError,
        );
        return NextResponse.json(
          {
            error:
              "Watch progress was saved, but module completion could not be verified.",
          },
          { status: 500 },
        );
      }

      if (assignmentCount === 0) {
        try {
          await completeModule(user.id, module.course_id, module.id);
        } catch (completeError) {
          console.error("Auto-complete failed:", completeError);
          return NextResponse.json(
            {
              error:
                "Watch progress was saved, but module completion failed. Please retry.",
            },
            { status: 500 },
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      watchedSeconds,
      durationSeconds: duration,
      lastPositionSeconds: Math.min(position, duration),
      watchRequirementReached: reachedWatchThreshold,
    });
  } catch (error) {
    console.error("Watch-progress request failed:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const moduleId = searchParams.get("moduleId");

    if (!moduleId?.trim()) {
      return NextResponse.json(
        { error: "Module ID is required." },
        { status: 400 },
      );
    }

    const { user, errorResponse } = await getAuthenticatedUser();

    if (errorResponse || !user) {
      return (
        errorResponse ??
        NextResponse.json(
          { error: "Please sign in to load lecture progress." },
          { status: 401 },
        )
      );
    }

    const db = createServerSupabase();

    const { data: module, error: moduleError } = await db
      .from("modules")
      .select("id, youtube_id")
      .eq("id", moduleId.trim())
      .maybeSingle();

    if (moduleError) {
      console.error("Watch-progress module lookup failed:", moduleError);
      return NextResponse.json(
        { error: "Could not verify this module." },
        { status: 500 },
      );
    }

    if (!module) {
      return NextResponse.json(
        { error: "Module not found." },
        { status: 404 },
      );
    }

    const { data: access, error: accessError } = await db
      .from("module_progress")
      .select("status")
      .eq("user_id", user.id)
      .eq("module_id", module.id)
      .maybeSingle();

    if (accessError) {
      console.error("Watch-progress access check failed:", accessError);
      return NextResponse.json(
        { error: "Could not verify your access to this module." },
        { status: 500 },
      );
    }

    if (!access || access.status === "locked") {
      return NextResponse.json(
        { error: "This module is locked." },
        { status: 403 },
      );
    }

    if (!module.youtube_id) {
      return NextResponse.json(
        {
          success: true,
          watchedSeconds: 0,
          durationSeconds: 0,
          lastPositionSeconds: 0,
          watchRequirementReached: true,
        },
      );
    }

    const { data: progress, error: progressError } = await db
      .from("module_watch_progress")
      .select(
        "duration_seconds, last_position_seconds, youtube_id",
      )
      .eq("user_id", user.id)
      .eq("module_id", module.id)
      .maybeSingle();

    if (progressError) {
      console.error("Watch-progress lookup failed:", progressError);
      return NextResponse.json(
        { error: "Could not load lecture progress." },
        { status: 500 },
      );
    }

    const matchesCurrentVideo =
      !!progress && progress.youtube_id === module.youtube_id;

    const durationSeconds = matchesCurrentVideo
      ? progress.duration_seconds ?? 0
      : 0;

    let watchedSeconds = 0;

    if (matchesCurrentVideo && durationSeconds > 0) {
      const {
        count: uniqueWatchedSeconds,
        error: coverageError,
      } = await db
        .from("module_watch_intervals")
        .select("start_second", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("module_id", module.id)
        .gte("start_second", 0)
        .lt("start_second", durationSeconds);

      if (coverageError || uniqueWatchedSeconds === null) {
        console.error("Watch coverage lookup failed:", coverageError);
        return NextResponse.json(
          { error: "Could not calculate lecture coverage." },
          { status: 500 },
        );
      }

      watchedSeconds = uniqueWatchedSeconds;
    }

    return NextResponse.json({
      success: true,
      watchedSeconds,
      durationSeconds,
      lastPositionSeconds: matchesCurrentVideo
        ? Math.min(
            progress.last_position_seconds ?? 0,
            durationSeconds,
          )
        : 0,
      watchRequirementReached:
        !module.youtube_id ||
        watchRequirementMet(watchedSeconds, durationSeconds),
    });
  } catch (error) {
    console.error("Watch-progress load failed:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
