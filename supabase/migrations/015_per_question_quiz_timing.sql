
-- 015: Per-question quiz timing and explicit answer submission.
-- Run after migration 014.
--
-- Preserves existing quiz attempts, sessions, and retake approvals.
-- Existing active sessions are backfilled using their previous global timer.

-- =========================================================
-- 1. ADD PER-QUESTION SESSION STATE
-- =========================================================

ALTER TABLE public.quiz_sessions
    ADD COLUMN IF NOT EXISTS current_question_index integer;

ALTER TABLE public.quiz_sessions
    ADD COLUMN IF NOT EXISTS question_started_at timestamptz;

-- Backfill only sessions that have not yet been initialized.
-- This preserves the old global timer position for active sessions.
UPDATE public.quiz_sessions
SET
    current_question_index = LEAST(
        jsonb_array_length(question_snapshot),
        GREATEST(
            0,
            FLOOR(
                GREATEST(
                    0,
                    EXTRACT(EPOCH FROM (clock_timestamp() - started_at))
                ) / 60
            )::integer
        )
    ),
    question_started_at = started_at +
        (
            LEAST(
                jsonb_array_length(question_snapshot),
                GREATEST(
                    0,
                    FLOOR(
                        GREATEST(
                            0,
                            EXTRACT(EPOCH FROM (clock_timestamp() - started_at))
                        ) / 60
                    )::integer
                )
            ) * interval '1 minute'
        )
WHERE current_question_index IS NULL
   OR question_started_at IS NULL;

ALTER TABLE public.quiz_sessions
    ALTER COLUMN current_question_index SET DEFAULT 0,
    ALTER COLUMN current_question_index SET NOT NULL,
    ALTER COLUMN question_started_at SET DEFAULT now(),
    ALTER COLUMN question_started_at SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'quiz_sessions_question_index_nonnegative'
          AND conrelid = 'public.quiz_sessions'::regclass
    ) THEN
        ALTER TABLE public.quiz_sessions
            ADD CONSTRAINT quiz_sessions_question_index_nonnegative
            CHECK (current_question_index >= 0);
    END IF;
END;
$$;


-- =========================================================
-- 2. GET THE CURRENT QUESTION STATE
-- Each question has its own 60-second server-side deadline.
-- Expired questions are skipped automatically.
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_quiz_session_state_v2(
    p_user_id uuid,
    p_course_id uuid,
    p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session public.quiz_sessions%ROWTYPE;
    v_attempt public.quiz_attempts%ROWTYPE;
    v_total integer;
    v_now timestamptz;
    v_elapsed integer;
    v_expired_count integer;
    v_current_index integer;
    v_remaining integer;
    v_question jsonb;
BEGIN
    SELECT *
    INTO v_session
    FROM public.quiz_sessions
    WHERE id = p_session_id
      AND user_id = p_user_id
      AND course_id = p_course_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    v_total := jsonb_array_length(v_session.question_snapshot);

    IF v_session.completed_at IS NOT NULL THEN
        SELECT *
        INTO v_attempt
        FROM public.quiz_attempts
        WHERE user_id = p_user_id
          AND course_id = p_course_id
          AND attempt_number = v_session.attempt_number;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('status', 'attempt_missing');
        END IF;

        RETURN jsonb_build_object(
            'status', 'completed',
            'session_id', v_session.id,
            'attempt_number', v_attempt.attempt_number,
            'result', jsonb_build_object(
                'score', v_attempt.score,
                'total', v_attempt.total,
                'percent', v_attempt.percent,
                'passed', v_attempt.passed,
                'passPercent', v_session.pass_percent
            )
        );
    END IF;

    IF v_total <= 0 THEN
        RETURN jsonb_build_object('status', 'invalid_session');
    END IF;

    v_now := clock_timestamp();

    v_elapsed := GREATEST(
        0,
        FLOOR(
            EXTRACT(EPOCH FROM (v_now - v_session.question_started_at))
        )::integer
    );

    v_expired_count := FLOOR(v_elapsed / 60.0)::integer;

    IF v_expired_count > 0 THEN
        v_current_index := LEAST(
            v_total,
            v_session.current_question_index + v_expired_count
        );

        UPDATE public.quiz_sessions
        SET
            current_question_index = v_current_index,
            question_started_at = question_started_at +
                (v_expired_count * interval '1 minute'),
            updated_at = v_now
        WHERE id = p_session_id;

        v_session.current_question_index := v_current_index;
        v_session.question_started_at :=
            v_session.question_started_at +
            (v_expired_count * interval '1 minute');
    ELSE
        v_current_index := v_session.current_question_index;
    END IF;

    IF v_current_index >= v_total THEN
        RETURN jsonb_build_object(
            'status', 'expired',
            'session_id', v_session.id,
            'attempt_number', v_session.attempt_number,
            'total', v_total
        );
    END IF;

    v_elapsed := GREATEST(
        0,
        FLOOR(
            EXTRACT(EPOCH FROM (v_now - v_session.question_started_at))
        )::integer
    );

    v_remaining := GREATEST(0, 60 - v_elapsed);
    v_question := v_session.question_snapshot -> v_current_index;

    RETURN jsonb_build_object(
        'status', 'active',
        'session_id', v_session.id,
        'attempt_number', v_session.attempt_number,
        'current_index', v_current_index,
        'total', v_total,
        'remaining_seconds', v_remaining,
        'question', v_question - 'correct_index'
    );
END;
$$;


-- =========================================================
-- 3. SAVE AND ADVANCE AFTER EXPLICIT SUBMISSION
-- A selection alone never saves an answer.
-- The submitted answer must belong to the active question.
-- =========================================================

CREATE OR REPLACE FUNCTION public.record_quiz_session_answer_v2(
    p_user_id uuid,
    p_course_id uuid,
    p_session_id uuid,
    p_question_index integer,
    p_answer_index integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session public.quiz_sessions%ROWTYPE;
    v_total integer;
    v_now timestamptz;
    v_elapsed integer;
    v_expired_count integer;
    v_current_index integer;
    v_question jsonb;
    v_question_id text;
    v_options jsonb;
    v_result jsonb;
BEGIN
    SELECT *
    INTO v_session
    FROM public.quiz_sessions
    WHERE id = p_session_id
      AND user_id = p_user_id
      AND course_id = p_course_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    IF v_session.completed_at IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'completed');
    END IF;

    v_total := jsonb_array_length(v_session.question_snapshot);

    IF v_total <= 0 THEN
        RETURN jsonb_build_object('status', 'invalid_session');
    END IF;

    IF p_question_index IS NULL
       OR p_answer_index IS NULL
       OR p_question_index < 0
       OR p_question_index >= v_total THEN
        RETURN jsonb_build_object('status', 'invalid_answer');
    END IF;

    v_now := clock_timestamp();

    v_elapsed := GREATEST(
        0,
        FLOOR(
            EXTRACT(EPOCH FROM (v_now - v_session.question_started_at))
        )::integer
    );

    v_expired_count := FLOOR(v_elapsed / 60.0)::integer;

    v_current_index := v_session.current_question_index;

    -- Catch up with any questions whose deadlines have passed.
    IF v_expired_count > 0 THEN
        v_current_index := LEAST(
            v_total,
            v_current_index + v_expired_count
        );

        UPDATE public.quiz_sessions
        SET
            current_question_index = v_current_index,
            question_started_at = question_started_at +
                (v_expired_count * interval '1 minute'),
            updated_at = v_now
        WHERE id = p_session_id;

        v_session.current_question_index := v_current_index;
        v_session.question_started_at :=
            v_session.question_started_at +
            (v_expired_count * interval '1 minute');
    END IF;

    -- All questions have been answered or have expired.
    IF v_current_index >= v_total THEN
        RETURN jsonb_build_object('status', 'expired');
    END IF;

    -- Reject stale or out-of-order submissions.
    IF p_question_index <> v_current_index THEN
        v_question := v_session.question_snapshot -> v_current_index;

        v_elapsed := GREATEST(
            0,
            FLOOR(
                EXTRACT(EPOCH FROM (v_now - v_session.question_started_at))
            )::integer
        );

        RETURN jsonb_build_object(
            'status', 'advanced',
            'current_index', v_current_index,
            'remaining_seconds', GREATEST(0, 60 - v_elapsed),
            'total', v_total,
            'question', v_question - 'correct_index'
        );
    END IF;

    v_question := v_session.question_snapshot -> v_current_index;
    v_options := v_question -> 'options';

    IF jsonb_typeof(v_options) <> 'array'
       OR p_answer_index < 0
       OR p_answer_index >= jsonb_array_length(v_options) THEN
        RETURN jsonb_build_object('status', 'invalid_answer');
    END IF;

    v_question_id := v_question ->> 'id';

    -- Save the answer and advance atomically.
    UPDATE public.quiz_sessions
    SET
        answers = coalesce(answers, '{}'::jsonb) ||
            jsonb_build_object(v_question_id, p_answer_index),
        current_question_index = v_current_index + 1,
        question_started_at = v_now,
        updated_at = v_now
    WHERE id = p_session_id;

    -- Last answer: finalize immediately.
    IF v_current_index + 1 >= v_total THEN
        SELECT public.finalize_quiz_session_v2(
            p_user_id,
            p_course_id,
            p_session_id
        )
        INTO v_result;

        RETURN v_result;
    END IF;

    -- Return the next question only after the answer is saved.
    v_question := v_session.question_snapshot -> (v_current_index + 1);

    RETURN jsonb_build_object(
        'status', 'advanced',
        'session_id', p_session_id,
        'current_index', v_current_index + 1,
        'total', v_total,
        'remaining_seconds', 60,
        'question', v_question - 'correct_index'
    );
END;
$$;


-- =========================================================
-- 4. FINALIZE AFTER THE LAST QUESTION
-- Unanswered and expired questions receive zero marks.
-- =========================================================

CREATE OR REPLACE FUNCTION public.finalize_quiz_session_v2(
    p_user_id uuid,
    p_course_id uuid,
    p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session public.quiz_sessions%ROWTYPE;
    v_attempt public.quiz_attempts%ROWTYPE;
    v_question jsonb;
    v_score integer := 0;
    v_total integer;
    v_percent integer;
    v_passed boolean;
    v_now timestamptz;
    v_elapsed integer;
    v_expired_count integer;
    v_current_index integer;
BEGIN
    SELECT *
    INTO v_session
    FROM public.quiz_sessions
    WHERE id = p_session_id
      AND user_id = p_user_id
      AND course_id = p_course_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    v_total := jsonb_array_length(v_session.question_snapshot);

    IF v_session.completed_at IS NOT NULL THEN
        SELECT *
        INTO v_attempt
        FROM public.quiz_attempts
        WHERE user_id = p_user_id
          AND course_id = p_course_id
          AND attempt_number = v_session.attempt_number;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('status', 'attempt_missing');
        END IF;

        RETURN jsonb_build_object(
            'status', 'completed',
            'attempt_number', v_attempt.attempt_number,
            'result', jsonb_build_object(
                'score', v_attempt.score,
                'total', v_attempt.total,
                'percent', v_attempt.percent,
                'passed', v_attempt.passed,
                'passPercent', v_session.pass_percent
            )
        );
    END IF;

    IF v_total <= 0 THEN
        RETURN jsonb_build_object('status', 'invalid_session');
    END IF;

    v_now := clock_timestamp();

    v_elapsed := GREATEST(
        0,
        FLOOR(
            EXTRACT(EPOCH FROM (v_now - v_session.question_started_at))
        )::integer
    );

    v_expired_count := FLOOR(v_elapsed / 60.0)::integer;
    v_current_index := v_session.current_question_index;

    IF v_expired_count > 0 THEN
        v_current_index := LEAST(
            v_total,
            v_current_index + v_expired_count
        );

        UPDATE public.quiz_sessions
        SET
            current_question_index = v_current_index,
            question_started_at = question_started_at +
                (v_expired_count * interval '1 minute'),
            updated_at = v_now
        WHERE id = p_session_id;

        v_session.current_question_index := v_current_index;
    END IF;

    -- Do not finalize while a question is still active.
    IF v_current_index < v_total THEN
        RETURN jsonb_build_object(
            'status', 'waiting',
            'remaining_seconds', GREATEST(
                0,
                60 - GREATEST(
                    0,
                    FLOOR(
                        EXTRACT(
                            EPOCH FROM (
                                v_now -
                                (
                                    v_session.question_started_at +
                                    (v_expired_count * interval '1 minute')
                                )
                            )
                        )
                    )::integer
                )
            )
        );
    END IF;

    -- Score only answers stored against the trusted question snapshot.
    FOR v_question IN
        SELECT value
        FROM jsonb_array_elements(v_session.question_snapshot)
    LOOP
        IF coalesce(
            v_session.answers ->> (v_question ->> 'id'),
            ''
        ) <> ''
        AND (v_session.answers ->> (v_question ->> 'id'))::integer =
            (v_question ->> 'correct_index')::integer THEN
            v_score := v_score + 1;
        END IF;
    END LOOP;

    v_percent := ROUND(
        (v_score::numeric / v_total) * 100
    )::integer;

    v_passed := v_percent >= v_session.pass_percent;

    INSERT INTO public.quiz_attempts (
        user_id,
        course_id,
        score,
        total,
        percent,
        passed,
        answers,
        attempt_number
    )
    VALUES (
        p_user_id,
        p_course_id,
        v_score,
        v_total,
        v_percent,
        v_passed,
        coalesce(v_session.answers, '{}'::jsonb),
        v_session.attempt_number
    )
    ON CONFLICT (user_id, course_id, attempt_number) DO NOTHING;

    SELECT *
    INTO v_attempt
    FROM public.quiz_attempts
    WHERE user_id = p_user_id
      AND course_id = p_course_id
      AND attempt_number = v_session.attempt_number;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'attempt_missing');
    END IF;

    UPDATE public.quiz_sessions
    SET
        completed_at = v_now,
        updated_at = v_now
    WHERE id = p_session_id
      AND completed_at IS NULL;

    RETURN jsonb_build_object(
        'status', 'completed',
        'attempt_number', v_attempt.attempt_number,
        'result', jsonb_build_object(
            'score', v_attempt.score,
            'total', v_attempt.total,
            'percent', v_attempt.percent,
            'passed', v_attempt.passed,
            'passPercent', v_session.pass_percent
        )
    );
END;
$$;


-- =========================================================
-- 5. RESTRICT FUNCTION EXECUTION
-- Preserve service_role-only access.
-- =========================================================

REVOKE ALL ON FUNCTION public.get_quiz_session_state_v2(uuid, uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_quiz_session_state_v2(uuid, uuid, uuid)
TO service_role;


REVOKE ALL ON FUNCTION public.record_quiz_session_answer_v2(uuid, uuid, uuid, integer, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_quiz_session_answer_v2(uuid, uuid, uuid, integer, integer)
TO service_role;


REVOKE ALL ON FUNCTION public.finalize_quiz_session_v2(uuid, uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_quiz_session_v2(uuid, uuid, uuid)
TO service_role;
