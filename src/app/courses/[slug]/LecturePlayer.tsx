
"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          videoId: string;
          playerVars?: Record<string, number>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: {
              data: number;
              target: YTPlayer;
            }) => void;
            onError?: () => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YTPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
};

type Props = {
  moduleId: string;
  youtubeId: string;
  onEnded?: () => void;
};

type SavedProgressResponse = {
  success?: boolean;
  error?: string;
  watchedSeconds?: number;
  durationSeconds?: number;
  lastPositionSeconds?: number;
  watchRequirementReached?: boolean;
};

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("YouTube player requires a browser."),
    );
  }

  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise<void>((resolve, reject) => {
      const previousCallback = window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady = () => {
        previousCallback?.();
        resolve();
      };

      const existingScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]',
      );

      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;

        script.onerror = () => {
          youtubeApiPromise = null;
          reject(new Error("Could not load the YouTube player."));
        };

        document.head.appendChild(script);
      }
    });
  }

  return youtubeApiPromise;
}

function formatTime(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      seconds,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function LecturePlayer({
  moduleId,
  youtubeId,
  onEnded,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const playingRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  const endedRef = useRef(false);

  const [error, setError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedWatchSeconds, setElapsedWatchSeconds] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [savedWatchSeconds, setSavedWatchSeconds] = useState(0);

  onEndedRef.current = onEnded;

  useEffect(() => {
    let cancelled = false;
    let reportTimer: ReturnType<typeof setInterval> | undefined;
    let timerInterval: ReturnType<typeof setInterval> | undefined;

    // Every report is placed behind the previous one.
    // This prevents overlapping requests and out-of-order baselines.
    let reportQueue: Promise<void> = Promise.resolve();

    let lastPlayingReportAt = 0;
    let finalReportStarted = false;

    function queueReport(
      positionSeconds: number,
      durationSeconds: number,
      playing: boolean,
    ): Promise<void> {
      const safePosition = Math.max(
        0,
        Math.floor(positionSeconds),
      );
      const safeDuration = Math.floor(durationSeconds);

      if (
        !Number.isFinite(safePosition) ||
        !Number.isFinite(safeDuration) ||
        safeDuration <= 0
      ) {
        return reportQueue;
      }

      reportQueue = reportQueue
        .then(async () => {
          if (cancelled) return;

          const response = await fetch(
            "/api/course-progress/watch",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                moduleId,
                positionSeconds: Math.min(
                  safePosition,
                  safeDuration,
                ),
                durationSeconds: safeDuration,
                playing,
              }),
            },
          );

          const result = (await response
            .json()
            .catch(() => null)) as SavedProgressResponse | null;

          if (cancelled) return;

          if (!response.ok) {
            setError(
              result?.error ||
                "Could not save your lecture progress. We will try again.",
            );
            return;
          }

          if (typeof result?.watchedSeconds === "number") {
            setSavedWatchSeconds(result.watchedSeconds);
          }

          setError("");
        })
        .catch((requestError) => {
          console.error("Lecture progress report failed:", requestError);

          if (!cancelled) {
            setError(
              "Could not connect to save your lecture progress. Playback can continue; tracking will retry.",
            );
          }
        });

      return reportQueue;
    }

    function reportCurrentPosition(
      player: YTPlayer,
      playing: boolean,
    ): Promise<void> {
      const position = player.getCurrentTime();
      const duration = player.getDuration();

      if (
        !Number.isFinite(position) ||
        !Number.isFinite(duration) ||
        duration <= 0
      ) {
        return Promise.resolve();
      }

      return queueReport(position, duration, playing);
    }

    async function initialize() {
      let resumePositionSeconds = 0;

      try {
        const response = await fetch(
          `/api/course-progress/watch?moduleId=${encodeURIComponent(
            moduleId,
          )}`,
        );

        const result = (await response
          .json()
          .catch(() => null)) as SavedProgressResponse | null;

        if (cancelled) return;

        if (!response.ok) {
          setError(
            result?.error ||
              "Could not load your saved lecture progress.",
          );
        } else if (
          result &&
          typeof result.watchedSeconds === "number"
        ) {
          setSavedWatchSeconds(Math.max(0, result.watchedSeconds));

          resumePositionSeconds =
            typeof result.lastPositionSeconds === "number" &&
            Number.isFinite(result.lastPositionSeconds)
              ? Math.max(0, result.lastPositionSeconds)
              : 0;

          if (
            typeof result.durationSeconds === "number" &&
            Number.isFinite(result.durationSeconds)
          ) {
            setVideoDuration(
              Math.max(0, result.durationSeconds),
            );
          }
        }

        await loadYouTubeApi();

        if (
          cancelled ||
          !containerRef.current ||
          !window.YT
        ) {
          return;
        }

        const player = new window.YT.Player(
          containerRef.current,
          {
            videoId: youtubeId,
            playerVars: {
              playsinline: 1,
              rel: 0,
            },
            events: {
              onReady: (event) => {
                if (cancelled) return;

                const duration = event.target.getDuration();

                if (Number.isFinite(duration) && duration > 0) {
                  setVideoDuration(Math.floor(duration));

                  if (
                    resumePositionSeconds > 0 &&
                    resumePositionSeconds < duration - 1
                  ) {
                    event.target.seekTo(
                      resumePositionSeconds,
                      true,
                    );
                  }
                }

                // Establish a server baseline after the initial
                // position has been restored. This earns no credit.
                void reportCurrentPosition(event.target, false);

                reportTimer = setInterval(() => {
                  const activePlayer = playerRef.current;

                  if (!activePlayer || cancelled) return;

                  const position = activePlayer.getCurrentTime();
                  const duration = activePlayer.getDuration();

                  if (
                    !Number.isFinite(position) ||
                    !Number.isFinite(duration) ||
                    duration <= 0
                  ) {
                    return;
                  }

                  setVideoDuration(Math.floor(duration));

                  if (
                    playingRef.current &&
                    !endedRef.current &&
                    Date.now() - lastPlayingReportAt >= 5000
                  ) {
                    lastPlayingReportAt = Date.now();

                    // Do not change a local position baseline here.
                    // The server decides whether the report is valid.
                    void reportCurrentPosition(
                      activePlayer,
                      true,
                    );
                  }
                }, 1000);

                timerInterval = setInterval(() => {
                  if (playingRef.current && !cancelled) {
                    setElapsedWatchSeconds((seconds) => seconds + 1);
                  }
                }, 1000);
              },

              onStateChange: (event) => {
                const states = window.YT?.PlayerState;

                if (!states || cancelled) return;

                if (event.data === states.ENDED) {
                  if (endedRef.current) return;

                  endedRef.current = true;
                  playingRef.current = false;
                  setIsPlaying(false);

                  if (reportTimer) {
                    clearInterval(reportTimer);
                    reportTimer = undefined;
                  }

                  if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = undefined;
                  }

                  if (!finalReportStarted) {
                    finalReportStarted = true;

                    const finalPosition = event.target.getCurrentTime();
                    const finalDuration = event.target.getDuration();

                    if (
                      Number.isFinite(finalPosition) &&
                      Number.isFinite(finalDuration) &&
                      finalDuration > 0
                    ) {
                      setVideoDuration(Math.floor(finalDuration));

                      // This final report waits behind all earlier
                      // reports before the completion callback runs.
                      void reportCurrentPosition(
                        event.target,
                        true,
                      ).then(() => {
                        if (!cancelled) {
                          onEndedRef.current?.();
                        }
                      });
                    } else {
                      onEndedRef.current?.();
                    }
                  }

                  return;
                }

                if (event.data === states.PLAYING) {
                  playingRef.current = true;
                  setIsPlaying(true);
                  endedRef.current = false;

                  // Reset the server's timing baseline at resume.
                  // The next playing report will earn actual coverage.
                  lastPlayingReportAt = Date.now();

                  void reportCurrentPosition(
                    event.target,
                    false,
                  );

                  return;
                }

                if (event.data === states.PAUSED) {
                  playingRef.current = false;
                  setIsPlaying(false);
                  lastPlayingReportAt = 0;

                  // Pause reports reset the server baseline without
                  // counting the time spent paused.
                  void reportCurrentPosition(
                    event.target,
                    false,
                  );
                }
              },

              onError: () => {
                if (!cancelled) {
                  setError(
                    "This video could not be loaded. Please try again later.",
                  );
                }
              },
            },
          },
        );

        playerRef.current = player;
      } catch (initializationError) {
        console.error(
          "Lecture player initialization failed:",
          initializationError,
        );

        if (!cancelled) {
          setError(
            "The video player or saved progress could not be loaded. Please refresh and try again.",
          );
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;

      if (reportTimer) {
        clearInterval(reportTimer);
      }

      if (timerInterval) {
        clearInterval(timerInterval);
      }

      playerRef.current?.destroy();
      playerRef.current = null;
      playingRef.current = false;
    };
  }, [moduleId, youtubeId]);

  const sessionPercentage =
    videoDuration > 0
      ? Math.min(
          100,
          Math.round(
            (elapsedWatchSeconds / videoDuration) * 100,
          ),
        )
      : 0;

  const savedPercentage =
    videoDuration > 0
      ? Math.min(
          100,
          Math.round(
            (savedWatchSeconds / videoDuration) * 100,
          ),
        )
      : 0;

  return (
    <section className="space-y-4">
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-slate-950">
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Watch timer
            </p>
            <p className="text-xs text-slate-500">
              {isPlaying ? "Video playing" : "Video paused"}
            </p>
          </div>

          <p className="font-mono text-xl tabular-nums text-slate-900">
            {formatTime(elapsedWatchSeconds)}
          </p>
        </div>

        <div
          className="h-2 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label="Session watch progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={sessionPercentage}
        >
          <div
            className="h-full rounded-full bg-teal-600 transition-[width] duration-300"
            style={{ width: `${sessionPercentage}%` }}
          />
        </div>

        <div className="flex justify-between gap-3 text-xs text-slate-500">
          <span>Session watch time</span>
          <span>{formatTime(videoDuration)} total</span>
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">
              Saved lecture coverage
            </p>
            <p className="text-sm font-semibold tabular-nums text-teal-700">
              {savedPercentage}%
            </p>
          </div>

          <div
            className="h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="Saved lecture coverage"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={savedPercentage}
          >
            <div
              className="h-full rounded-full bg-teal-600 transition-[width] duration-300"
              style={{ width: `${savedPercentage}%` }}
            />
          </div>

          <p className="text-xs leading-5 text-slate-500">
            Saved coverage updates when the server confirms your
            watch progress. Keep this page open during playback.
            Your saved position is restored when you return.
            Tracking is a learning aid, not tamper-proof.
          </p>
        </div>
      </div>
    </section>
  );
}
