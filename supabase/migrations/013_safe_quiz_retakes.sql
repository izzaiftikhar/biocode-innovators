-- 013: Safe final quiz retakes
-- Preserves historical attempts and sessions.
-- Does not delete student results or reset existing timers.

BEGIN;

-- 1. Add attempt numbers. Existing records become attempt 1.
ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.quiz_sessions
ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1;

-- 2. Validate attempt numbers.
ALTER TABLE public.quiz_attempts
DROP CONSTRAINT IF EXISTS quiz_attempts_attempt_number_check;

ALTER TABLE public.quiz_attempts
ADD CONSTRAINT quiz_attempts_attempt_number_check
CHECK (attempt_number >= 1);

ALTER TABLE public.quiz_sessions
DROP CONSTRAINT IF EXISTS quiz_sessions_attempt_number_check;

ALTER TABLE public.quiz_sessions
ADD CONSTRAINT quiz_sessions_attempt_number_check
CHECK (attempt_number >= 1);

-- 3. Remove the old one-attempt and one-session restrictions.
ALTER TABLE public.quiz_attempts
DROP CONSTRAINT IF EXISTS quiz_attempts_one_per_student_course;

DROP INDEX IF EXISTS public.quiz_attempts_one_per_student_course;

ALTER TABLE public.quiz_sessions
DROP CONSTRAINT IF EXISTS quiz_sessions_one_per_student_course;

DROP INDEX IF EXISTS public.quiz_sessions_one_per_student_course;

-- 4. Allow one saved attempt per numbered attempt.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_user_course_attempt_unique
ON public.quiz_attempts (user_id, course_id, attempt_number);

-- 5. Allow session history, but only one session per attempt.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_sessions_user_course_attempt_unique
ON public.quiz_sessions (user_id, course_id, attempt_number);

-- A student may have only one unfinished session per course.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_sessions_one_active_per_student_course
ON public.quiz_sessions (user_id, course_id)
WHERE completed_at IS NULL;

-- Keep an efficient lookup index for session history.
CREATE INDEX IF NOT EXISTS quiz_sessions_user_course_attempt_idx
ON public.quiz_sessions (user_id, course_id, attempt_number DESC);

-- 6. Allow a composite reference to identify an attempt safely.
ALTER TABLE public.quiz_attempts
DROP CONSTRAINT IF EXISTS quiz_attempts_id_user_course_key;

ALTER TABLE public.quiz_attempts
ADD CONSTRAINT quiz_attempts_id_user_course_key
UNIQUE (id, user_id, course_id);

-- 7. Retake request history.
CREATE TABLE IF NOT EXISTS public.quiz_retake_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    attempt_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,

    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',

    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    admin_note TEXT,

    approved_attempt_number INTEGER,
    consumed_at TIMESTAMPTZ,

    CONSTRAINT quiz_retake_requests_attempt_owner_fk
        FOREIGN KEY (attempt_id, user_id, course_id)
        REFERENCES public.quiz_attempts (id, user_id, course_id)
        ON DELETE RESTRICT,

    CONSTRAINT quiz_retake_requests_status_check
        CHECK (status IN ('pending', 'approved', 'rejected')),

    CONSTRAINT quiz_retake_requests_reason_check
        CHECK (char_length(trim(reason)) BETWEEN 10 AND 2000),

    CONSTRAINT quiz_retake_requests_approved_number_check
        CHECK (
            approved_attempt_number IS NULL
            OR approved_attempt_number >= 2
        )
);

-- Only one pending request per student/course.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_retake_requests_one_pending_idx
ON public.quiz_retake_requests (user_id, course_id)
WHERE status = 'pending';

-- A failed attempt can receive at most one approved retake.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_retake_requests_one_approval_per_attempt_idx
ON public.quiz_retake_requests (attempt_id)
WHERE status = 'approved';

-- Admin review and student history lookups.
CREATE INDEX IF NOT EXISTS quiz_retake_requests_admin_review_idx
ON public.quiz_retake_requests (status, requested_at DESC);

CREATE INDEX IF NOT EXISTS quiz_retake_requests_student_history_idx
ON public.quiz_retake_requests (user_id, course_id, requested_at DESC);

-- 8. Keep request access server-controlled, like the existing quiz tables.
ALTER TABLE public.quiz_retake_requests ENABLE ROW LEVEL SECURITY;

COMMIT;