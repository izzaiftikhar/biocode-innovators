import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import InternshipFinalForm from "@/app/dashboard/InternshipFinalForm";
import InternshipPaymentForm from "@/app/dashboard/InternshipPaymentForm";

const UTC_OFFSET = process.env.DEADLINE_UTC_OFFSET ?? "+05:00";
const DAY_MS = 86_400_000;

const STATUS_TEXT: Record<string, string> = {
  none: "Not submitted",
  submitted: "Submitted, awaiting review",
  approved: "Approved",
  needs_revision: "Revision requested",
};

type StepState = "complete" | "current" | "review" | "upcoming";

const STEP_STYLE: Record<StepState, { label: string; box: string; tag: string }> = {
  complete: { label: "Complete", box: "border border-green-600/40", tag: "text-green-700" },
  current: { label: "Current action", box: "border-2 border-teal-600", tag: "text-teal-700" },
  review: { label: "Under review", box: "border border-amber-500/60", tag: "text-amber-700" },
  upcoming: { label: "Up next", box: "border border-line", tag: "text-muted" },
};

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDay(day: string) {
  return new Date(`${day}T12:00:00${UTC_OFFSET}`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Karachi",
  });
}

/** Turns text like "8 weeks" or "3 months" into a number of days. */
function parseDurationDays(text: string | null | undefined) {
  if (!text) return null;

  const match = text.match(/(\d+(?:\.\d+)?)\s*(day|week|wk|month)/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const days = unit.startsWith("day")
    ? amount
    : unit.startsWith("month")
      ? amount * 30
      : amount * 7;

  return days > 0 ? Math.round(days) : null;
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-2 break-words text-base font-semibold leading-snug">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function StepCard({
  n,
  state,
  title,
  text,
}: {
  n: number;
  state: StepState;
  title: string;
  text: string;
}) {
  const style = STEP_STYLE[state];

  return (
    <div className={`rounded-xl bg-white p-4 ${style.box}`}>
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
        <span className={style.tag}>
          Step {String(n).padStart(2, "0")} · {style.label}
        </span>
        {state === "complete" && (
          <span aria-hidden className="text-green-700">
            ✓
          </span>
        )}
      </div>
      <p className="mt-2 font-semibold">{title}</p>
      <p className="mt-1 break-words text-sm text-muted">{text}</p>
    </div>
  );
}

function Stage({
  n,
  title,
  status,
  done,
  open,
  children,
}: {
  n: number;
  title: string;
  status?: string;
  done?: boolean;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="group rounded-xl border border-line bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-4 p-4 [&::-webkit-details-marker]:hidden">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface font-semibold">
          {n}
        </span>
        <span className="min-w-0 flex-1 font-semibold">
          {title}
          {status && (
            <span
              className={`ml-3 text-sm font-medium ${
                done ? "text-green-700" : "text-muted"
              }`}
            >
              {status}
            </span>
          )}
        </span>
        <span aria-hidden className="text-muted transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

export default async function StudentPanel({
  userId,
  enrollmentId,
}: {
  userId: string;
  enrollmentId: string;
}) {
  const db = createServerSupabase();

  // Only the student who owns this enrollment ever sees the panel.
  const { data: enrollment } = await db
    .from("internship_enrollments")
    .select("id, internship_id, full_name, email, reference_id, starts_at")
    .eq("id", enrollmentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!enrollment) return null;

  const [
    { data: internship },
    { data: tasks },
    { data: finalSub },
    { data: payment },
    { data: certificate },
    { data: settings },
  ] = await Promise.all([
    db
      .from("internships")
      .select("title, duration, tasks_pdf_path, instructions, end_date")
      .eq("id", enrollment.internship_id)
      .maybeSingle(),
    db
      .from("internship_tasks")
      .select("id, position, title, summary")
      .eq("internship_id", enrollment.internship_id)
      .order("position", { ascending: true }),
    db
      .from("internship_final_submissions")
      .select("status, score, feedback")
      .eq("enrollment_id", enrollment.id)
      .maybeSingle(),
    db
      .from("internship_payments")
      .select("status, reject_reason")
      .eq("enrollment_id", enrollment.id)
      .maybeSingle(),
    db
      .from("internship_certificates")
      .select("verification_code, appreciation_path")
      .eq("enrollment_id", enrollment.id)
      .maybeSingle(),
    db
      .from("internship_settings")
      .select("payment_method, account_title, account_number, certificate_fee, instructions")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  const myTasks = tasks ?? [];
  const endDate = internship?.end_date ?? null;
  const nowMs = Date.now();
  const startMs = new Date(enrollment.starts_at).getTime();

  const dueMs = endDate
    ? new Date(`${endDate}T23:59:59${UTC_OFFSET}`).getTime()
    : null;
  const closed = dueMs !== null && nowMs > dueMs;

  const subStatus = finalSub?.status ?? "none";
  const approved = subStatus === "approved";
  const paid = payment?.status === "approved";
  const current = !approved ? 3 : paid ? 5 : 4;

  const paymentLabel =
    payment?.status === "approved"
      ? "Verified"
      : payment?.status === "pending"
        ? "Under review"
        : payment?.status === "rejected"
          ? "Rejected"
          : "Payment due";

  // ----- Progress overview -----
  const durationDays = parseDurationDays(internship?.duration);
  const endMs = dueMs ?? (durationDays ? startMs + durationDays * DAY_MS : null);
  const span = endMs ? Math.max(1, endMs - startMs) : null;
  const elapsedDays = Math.max(0, (nowMs - startMs) / DAY_MS);

  const pct = span
    ? Math.min(100, Math.max(0, Math.round(((nowMs - startMs) / span) * 100)))
    : null;
  const totalDays = span ? Math.max(1, Math.ceil(span / DAY_MS)) : null;
  const dayNumber = totalDays
    ? Math.min(totalDays, Math.floor(elapsedDays) + 1)
    : null;
  const totalWeeks = totalDays ? Math.ceil(totalDays / 7) : null;
  const currentWeek = totalWeeks
    ? Math.min(totalWeeks, Math.floor(elapsedDays / 7) + 1)
    : null;
  const daysLeft =
    dueMs !== null ? Math.max(0, Math.ceil((dueMs - nowMs) / DAY_MS)) : null;
  const weekDots =
    totalWeeks && totalWeeks <= 12
      ? Array.from({ length: totalWeeks }, (_, i) => i + 1)
      : [];

  const statusBadge = certificate
    ? "Completed"
    : closed && !approved
      ? "Deadline passed"
      : "Active & In Progress";

  const submitState: StepState = approved
    ? "complete"
    : subStatus === "submitted"
      ? "review"
      : "current";
  const payState: StepState = paid
    ? "complete"
    : payment?.status === "pending"
      ? "review"
      : approved
        ? "current"
        : "upcoming";
  const certState: StepState = certificate ? "complete" : "upcoming";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {internship?.duration && (
          <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold">
            {internship.duration}
          </span>
        )}
        <span className="rounded-full border border-teal-600/40 px-3 py-1 text-xs font-semibold text-teal-700">
          {statusBadge}
        </span>
      </div>

      <h2 className="mt-3 text-xl font-semibold">
        Internship Progress &amp; Milestone Schedule
      </h2>
      <p className="mt-1 text-sm text-muted">
        Reference {enrollment.reference_id}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Date of start"
          value={formatDate(startMs)}
          hint="Recorded enrollment"
        />
        <Tile
          label="Track duration"
          value={internship?.duration || "Not set"}
          hint={totalDays ? `${totalDays} total calendar days` : undefined}
        />
        <Tile
          label="Official deadline"
          value={dueMs ? formatDate(dueMs) : "Not set"}
          hint="Final submission cutoff"
        />
        <Tile
          label="Schedule pace"
          value={
            daysLeft === null
              ? "No deadline"
              : closed
                ? "Deadline passed"
                : `${daysLeft} Days Left`
          }
          hint={
            currentWeek && totalWeeks
              ? `Week ${currentWeek} of ${totalWeeks}`
              : "Submit when you are ready"
          }
        />
      </div>

      {pct !== null && (
        <div className="mt-4 rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">
              Internship timeline elapsed:{" "}
              <span className="text-teal-700">{pct}%</span>
            </span>
            {dayNumber && totalDays && (
              <span className="text-muted">
                Day {dayNumber} of {totalDays}
                {currentWeek && totalWeeks
                  ? ` · Week ${currentWeek} of ${totalWeeks}`
                  : ""}
              </span>
            )}
          </div>

          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-teal-600"
              style={{ width: `${pct}%` }}
            />
          </div>

          {weekDots.length > 0 && (
            <ol className="mt-4 flex flex-wrap gap-x-3 gap-y-3">
              {weekDots.map((week) => (
                <li
                  key={week}
                  className="flex w-12 flex-col items-center gap-1 text-xs text-muted"
                >
                  <span
                    className={`flex size-7 items-center justify-center rounded-full border font-semibold ${
                      week === currentWeek
                        ? "border-teal-600 bg-teal-600 text-white"
                        : week < (currentWeek ?? 0)
                          ? "border-teal-600 text-teal-700"
                          : "border-line"
                    }`}
                  >
                    {week}
                  </span>
                  Week {week}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <StepCard
          n={1}
          state="complete"
          title="Enrollment confirmed"
          text={`Confirmation emailed to ${enrollment.email}.`}
        />
        <StepCard
          n={2}
          state={submitState}
          title="Build & submit your work"
          text={
            approved
              ? "Your submission is approved."
              : subStatus === "submitted"
                ? "Your submission is waiting for review."
                : subStatus === "needs_revision"
                  ? "Changes were requested. Update and resubmit."
                  : "Upload one combined ZIP or paste a link."
          }
        />
        <StepCard
          n={3}
          state={payState}
          title="Payment"
          text={
            paid
              ? "Payment verified."
              : payment?.status === "pending"
                ? "Your payment is being verified."
                : "Pay and upload your screenshot."
          }
        />
        <StepCard
          n={4}
          state={certState}
          title="Certificate & appreciation letter"
          text={
            certificate
              ? "Ready to download below."
              : "Issued after your work is approved and payment verified."
          }
        />
      </div>

      <h3 className="mt-8 text-lg font-semibold">Internship details</h3>

      <div className="mt-3 space-y-3">
        {/* 1. Instructions */}
        <Stage n={1} title="Internship Instructions" open>
          {internship?.instructions ? (
            <p className="whitespace-pre-line text-sm leading-6">
              {internship.instructions}
            </p>
          ) : (
            <p className="text-sm text-muted">
              Instructions will be added soon.
            </p>
          )}
        </Stage>

        {/* 2. Task downloads */}
        <Stage
          n={2}
          title="Task Downloads"
          status={myTasks.length ? `${myTasks.length} tasks` : undefined}
        >
          {myTasks.length === 0 && !internship?.tasks_pdf_path ? (
            <p className="text-sm text-muted">
              Tasks have not been published for this internship yet.
            </p>
          ) : (
            <>
              {myTasks.length > 0 && (
                <ol className="space-y-2 text-sm">
                  {myTasks.map((task) => (
                    <li key={task.id} className="rounded-lg border border-line p-3">
                      <p className="font-medium">
                        Task {task.position}: {task.title}
                      </p>
                      {task.summary && (
                        <p className="mt-1 whitespace-pre-line text-muted">
                          {task.summary}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {internship?.tasks_pdf_path && (
                <a
                  href={`/api/internships/apply/file?enrollment=${enrollment.id}&kind=tasks`}
                  className="btn-outline mt-3 inline-block"
                >
                  Download tasks PDF
                </a>
              )}
            </>
          )}
        </Stage>

        {/* 3. Task submission */}
        <Stage
          n={3}
          title="Task Submission"
          status={STATUS_TEXT[subStatus] ?? subStatus}
          done={approved}
          open={current === 3}
        >
          <p className="text-sm">
            Complete all tasks and submit them together in one ZIP file.{" "}
            {endDate ? (
              <strong>Deadline: {formatDay(endDate)}.</strong>
            ) : (
              <span className="text-muted">
                No deadline has been set. Submit whenever you are ready.
              </span>
            )}
          </p>

          {finalSub?.score !== null && finalSub?.score !== undefined && (
            <p className="mt-3 text-sm">Score: {finalSub.score}/100</p>
          )}

          {finalSub?.feedback && (
            <p className="mt-3 whitespace-pre-line rounded-lg bg-surface p-3 text-sm">
              <strong>Feedback:</strong> {finalSub.feedback}
            </p>
          )}

          {!approved &&
            (closed ? (
              <p className="mt-3 text-sm text-red-700">
                The submission deadline has passed.
              </p>
            ) : (
              <InternshipFinalForm
                enrollmentId={enrollment.id}
                resubmit={Boolean(finalSub)}
              />
            ))}
        </Stage>

        {/* 4. Payment */}
        <Stage
          n={4}
          title="Payment"
          status={paymentLabel}
          done={paid}
          open={current === 4}
        >
          {paid ? (
            <p className="text-sm">Payment verified.</p>
          ) : payment?.status === "pending" ? (
            <p className="text-sm">
              Your payment is being verified. You will be notified once it is
              approved.
            </p>
          ) : (
            <div>
              {payment?.status === "rejected" && (
                <p role="alert" className="mb-3 text-sm text-red-700">
                  Your payment was not accepted
                  {payment.reject_reason ? `: ${payment.reject_reason}` : "."}{" "}
                  Please submit it again.
                </p>
              )}

              <div className="rounded-lg bg-surface p-4 text-sm">
                <p className="font-semibold">How to pay</p>
                {settings?.payment_method && (
                  <p className="mt-2">Method: {settings.payment_method}</p>
                )}
                {settings?.account_title && (
                  <p>Account title: {settings.account_title}</p>
                )}
                {settings?.account_number && (
                  <p>Account / contact number: {settings.account_number}</p>
                )}
                {settings?.certificate_fee !== null &&
                  settings?.certificate_fee !== undefined && (
                    <p>Fee: {settings.certificate_fee}</p>
                  )}
                {settings?.instructions && (
                  <p className="mt-2 whitespace-pre-line text-muted">
                    {settings.instructions}
                  </p>
                )}
              </div>

              <InternshipPaymentForm
                enrollmentId={enrollment.id}
                defaultName={enrollment.full_name}
              />
            </div>
          )}
        </Stage>

        {/* 5. Certificate and appreciation letter */}
        <Stage
          n={5}
          title="Certificate of Internship Completion & Appreciation Letter"
          status={certificate ? "Ready" : "Locked"}
          done={Boolean(certificate)}
          open={current === 5}
        >
          {certificate ? (
            <div>
              <p className="text-sm text-muted">
                Certificate ID: {certificate.verification_code}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <a
                  href={`/api/internships/certificate?enrollment=${enrollment.id}`}
                  className="btn"
                >
                  Download certificate
                </a>
                {certificate.appreciation_path && (
                  <a
                    href={`/api/internships/certificate?enrollment=${enrollment.id}&kind=appreciation`}
                    className="btn-outline"
                  >
                    Download appreciation letter
                  </a>
                )}
                <Link
                  href={`/verify/${certificate.verification_code}`}
                  className="btn-outline"
                >
                  Verification page
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">
              Your certificate and appreciation letter appear here once your
              submission is approved and your payment is verified.
            </p>
          )}
        </Stage>
      </div>
    </div>
  );
}
