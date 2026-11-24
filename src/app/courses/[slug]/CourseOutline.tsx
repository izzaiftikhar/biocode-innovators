
"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import LecturePlayer from "./LecturePlayer";

export type OutlineModule = {
  id: string;
  number: number;
  title: string;
  notes: string | null;
  youtubeId: string | null;
  assignments: ReactNode;
  locked: boolean;
  completed: boolean;
  loginRequired: boolean;
  enrolRequired?: boolean;
};

const TEAL = "#0e7490";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 text-slate-400 transition-transform duration-200 ${
        open ? "rotate-180" : ""
      }`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M21.6 7.2a2.5 2.5 0 00-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 002.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 001.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 001.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z" />
    </svg>
  );
}

export default function CourseOutline({
  modules,
}: {
  modules: OutlineModule[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [openSubId, setOpenSubId] = useState<string | null>(null);

  function openAssignment(moduleId: string) {
    setOpenId(moduleId);
    setOpenSubId(`${moduleId}-assignment`);
  }

  return (
    <ul className="space-y-4">
      {modules.map((m) => {
        const isOpen = openId === m.id;
        const panelId = `module-panel-${m.id}`;

        return (
          <li
            key={m.id}
            id={`module-${m.number}`}
            className="scroll-mt-28 overflow-hidden rounded-xl border border-line bg-white shadow-sm"
          >
            <h3>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : m.id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex w-full items-center gap-4 px-6 py-5 text-left transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0e7490]"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                  style={{
                    background: m.locked ? "#f1f5f9" : `${TEAL}1a`,
                    color: m.locked ? "#64748b" : TEAL,
                  }}
                >
                  {m.number}
                </span>

                <span className="flex-1 text-lg font-semibold leading-snug">
                  Module {m.number}: {m.title}
                  {m.completed && (
                    <span className="ml-2 text-sm font-medium text-green-700">
                      Completed
                    </span>
                  )}
                </span>

                {m.locked ? (
                  <span className="shrink-0 text-slate-400">
                    <LockIcon />
                  </span>
                ) : (
                  <Chevron open={isOpen} />
                )}
              </button>
            </h3>

            {isOpen && (
              <div
                id={panelId}
                className="space-y-5 border-t border-line px-6 py-6"
              >
                {m.locked ? (
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="font-semibold text-slate-800">
                      {m.loginRequired
                        ? "Sign in to access this course"
                        : m.enrolRequired
                          ? "Enrol to access this course"
                          : "Module locked"}
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {m.loginRequired
                        ? "Sign in to unlock Module 1 and begin your learning journey."
                        : m.enrolRequired
                          ? "Use the Enrol button to unlock Module 1 and begin your learning journey."
                          : "Complete the previous module's required work to unlock this module."}
                    </p>

                    {m.loginRequired && (
                      <Link
                        href="/login"
                        className="btn mt-4 inline-block text-center"
                      >
                        Sign in
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {m.youtubeId && (
                      <section className="overflow-hidden rounded-xl border border-line">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSubId(
                              openSubId === `${m.id}-video`
                                ? null
                                : `${m.id}-video`
                            )
                          }
                          aria-expanded={openSubId === `${m.id}-video`}
                          className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left font-semibold hover:bg-surface"
                        >
                          <span>1. Video Lecture</span>
                          <Chevron
                            open={openSubId === `${m.id}-video`}
                          />
                        </button>

                        {openSubId === `${m.id}-video` && (
                          <div className="space-y-4 border-t border-line p-4">
                            {m.notes && (
                              <p className="whitespace-pre-wrap leading-7 text-muted">
                                {m.notes}
                              </p>
                            )}

                            <LecturePlayer
                              moduleId={m.id}
                              youtubeId={m.youtubeId}
                              onEnded={() => openAssignment(m.id)}
                            />
                          </div>
                        )}
                      </section>
                    )}

                    <section className="overflow-hidden rounded-xl border border-line">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenSubId(
                            openSubId === `${m.id}-assignment`
                              ? null
                              : `${m.id}-assignment`
                          )
                        }
                        aria-expanded={openSubId === `${m.id}-assignment`}
                        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left font-semibold hover:bg-surface"
                      >
                        <span>
                          {m.youtubeId ? "2." : "1."} Assignment
                        </span>
                        <Chevron
                          open={openSubId === `${m.id}-assignment`}
                        />
                      </button>

                      {openSubId === `${m.id}-assignment` && (
                        <div className="border-t border-line p-4">
                          {m.assignments}
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
