
-- 014: Safe, audited quiz retakes with attempt-specific sessions.
-- Preserves all existing quiz attempts and sessions.
-- Run after migration 013.

-- =========================================================
-- 1. STUDENT: REQUEST A RETAKE
-- =========================================================

CREATE OR REPLACE FUNCTION public.request_quiz_retake(
    p_user_id uuid,
    p_course_id uuid,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_attempt public.quiz_attempts%ROWTYPE;
    v_request_id uuid;
BEGIN
    IF p_user_id IS NULL OR p_course_id IS NULL THEN
        RETURN jsonb_build_object('status', 'invalid_request');
    END IF;

    IF length(trim(coalesce(p_reason, ''))) < 10
       OR length(trim(p_reason)) > 2000 THEN
        RETURN jsonb_build_object('status', 'invalid_reason');
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(p_user_id::text || ':' || p_course_id::text, 0)
    );

    IF EXISTS (
        SELECT 1
        FROM public.quiz_sessions
        WHERE user_id = p_user_id
          AND course_id = p_course_id
          AND completed_at IS NULL
    ) THEN
        RETURN jsonb_build_object('status', 'active_session');
    END IF;

    SELECT *
    INTO v_attempt
    FROM public.quiz_attempts
    WHERE user_id = p_user_id
      AND course_id = p_course_id
    ORDER BY attempt_number DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'no_attempt');
    END IF;

    IF v_attempt.passed THEN
        RETURN jsonb_build_object('status', 'already_passed');
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.quiz_retake_requests
        WHERE user_id = p_user_id
          AND course_id = p_course_id
          AND status = 'pending'
    ) THEN
        RETURN jsonb_build_object('status', 'request_pending');
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.quiz_retake_requests
        WHERE attempt_id = v_attempt.id
          AND status = 'approved'
    ) THEN
        RETURN jsonb_build_object('status', 'already_approved');
    END IF;

    INSERT INTO public.quiz_retake_requests (
        attempt_id,
        user_id,
        course_id,
        reason
    )
    VALUES (
        v_attempt.id,
        p_user_id,
        p_course_id,
        trim(p_reason)
    )
    RETURNING id INTO v_request_id;

    RETURN jsonb_build_object(
        'status', 'submitted',
        'request_id', v_request_id
    );

EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object('status', 'request_pending');
END;
$$;


-- =========================================================
-- 2. ADMIN: APPROVE OR REJECT A REQUEST
-- The API must verify isAdmin() before calling this function.
-- =========================================================

CREATE OR REPLACE FUNCTION public.review_quiz_retake_request(
    p_request_id uuid,
    p_admin_id uuid,
    p_decision text,
    p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_request public.quiz_retake_requests%ROWTYPE;
    v_attempt public.quiz_attempts%ROWTYPE;
    v_next_attempt integer;
BEGIN
    IF p_decision NOT IN ('approved', 'rejected') THEN
        RETURN jsonb_build_object('status', 'invalid_decision');
    END IF;

    IF p_admin_id IS NULL OR p_request_id IS NULL THEN
        RETURN jsonb_build_object('status', 'invalid_request');
    END IF;

    IF length(coalesce(p_admin_note, '')) > 2000 THEN
        RETURN jsonb_build_object('status', 'note_too_long');
    END IF;

    SELECT *
    INTO v_request
    FROM public.quiz_retake_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    IF v_request.status <> 'pending' THEN
        RETURN jsonb_build_object(
            'status', 'already_reviewed',
            'decision', v_request.status
        );
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            v_request.user_id::text || ':' || v_request.course_id::text,
            0
        )
    );

    SELECT *
    INTO v_attempt
    FROM public.quiz_attempts
    WHERE user_id = v_request.user_id
      AND course_id = v_request.course_id
    ORDER BY attempt_number DESC
    LIMIT 1
    FOR UPDATE;

    IF p_decision = 'approved' THEN
        IF NOT FOUND
           OR v_attempt.id <> v_request.attempt_id
           OR v_attempt.passed THEN
            RETURN jsonb_build_object('status', 'stale_request');
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.quiz_sessions
            WHERE user_id = v_request.user_id
              AND course_id = v_request.course_id
              AND completed_at IS NULL
        ) THEN
            RETURN jsonb_build_object('status', 'active_session');
        END IF;

        v_next_attempt := v_attempt.attempt_number + 1;
    ELSE
        v_next_attempt := NULL;
    END IF;

    UPDATE public.quiz_retake_requests
    SET
        status = p_decision,
        reviewed_at = now(),
        reviewed_by = p_admin_id,
        admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
        approved_attempt_number = v_next_attempt
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'status', p_decision,
        'approved_attempt_number', v_next_attempt
    );
END;
$$;


-- =========================================================
-- 3. START OR RESUME A SESSION
-- First attempt = 1.
-- Retakes require an approved, unconsumed request.
-- =========================================================

CREATE OR REPLACE FUNCTION public.start_quiz_session_v2(
    p_user_id uuid,
    p_course_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_active public.quiz_sessions%ROWTYPE;
    v_attempt public.quiz_attempts%ROWTYPE;
    v_request public.quiz_retake_requests%ROWTYPE;
    v_quiz public.course_quizzes%ROWTYPE;
    v_snapshot jsonb;
    v_total integer;
    v_attempt_number integer;
    v_session_id uuid;
BEGIN
    IF p_user_id IS NULL OR p_course_id IS NULL THEN
        RETURN jsonb_build_object('status', 'invalid_request');
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(p_user_id::text || ':' || p_course_id::text, 0)
    );

    -- An active session always wins: never reset its timer.
    SELECT *
    INTO v_active
    FROM public.quiz_sessions
    WHERE user_id = p_user_id
      AND course_id = p_course_id
      AND completed_at IS NULL
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'status', 'resumed',
            'session_id', v_active.id,
            'attempt_number', v_active.attempt_number
        );
    END IF;

    SELECT *
    INTO v_quiz
    FROM public.course_quizzes
    WHERE course_id = p_course_id
      AND published = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'no_quiz');
    END IF;

    -- Build a trusted question snapshot on the database side.
    SELECT
        jsonb_agg(
            jsonb_build_object(
                'id', q.id,
                'prompt', q.prompt,
                'options', q.options,
                'correct_index', q.correct_index
            )
            ORDER BY q.position, q.created_at, q.id
        ),
        count(*)::integer
    INTO v_snapshot, v_total
    FROM public.quiz_questions q
    WHERE q.course_id = p_course_id;

    IF v_total = 0 OR v_snapshot IS NULL THEN
        RETURN jsonb_build_object('status', 'no_questions');
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_snapshot) AS item
        WHERE jsonb_typeof(item -> 'options') <> 'array'
           OR jsonb_array_length(item -> 'options') < 2
           OR (item ->> 'correct_index')::integer < 0
           OR (item ->> 'correct_index')::integer >=
              jsonb_array_length(item -> 'options')
    ) THEN
        RETURN jsonb_build_object('status', 'invalid_questions');
    END IF;

    SELECT *
    INTO v_attempt
    FROM public.quiz_attempts
    WHERE user_id = p_user_id
      AND course_id = p_course_id
    ORDER BY attempt_number DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        v_attempt_number := 1;
    ELSE
        IF v_attempt.passed THEN
            RETURN jsonb_build_object('status', 'already_passed');
        END IF;

        -- A failed attempt requires an approved retake.
        SELECT *
        INTO v_request
        FROM public.quiz_retake_requests
        WHERE attempt_id = v_attempt.id
          AND user_id = p_user_id
          AND course_id = p_course_id
          AND status = 'approved'
          AND consumed_at IS NULL
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('status', 'retake_not_approved');
        END IF;

        v_attempt_number := v_request.approved_attempt_number;

        IF v_attempt_number IS NULL
           OR v_attempt_number <> v_attempt.attempt_number + 1 THEN
            RETURN jsonb_build_object('status', 'invalid_approval');
        END IF;

        UPDATE public.quiz_retake_requests
        SET consumed_at = now()
        WHERE id = v_request.id
          AND consumed_at IS NULL;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('status', 'approval_already_used');
        END IF;
    END IF;

    INSERT INTO public.quiz_sessions (
        user_id,
        course_id,
        started_at,
        question_snapshot,
        answers,
        pass_percent,
        attempt_number
    )
    VALUES (
        p_user_id,
        p_course_id,
        now(),
        v_snapshot,
        '{}'::jsonb,
        v_quiz.pass_percent,
        v_attempt_number
    )
    RETURNING id INTO v_session_id;

    RETURN jsonb_build_object(
        'status', 'started',
        'session_id', v_session_id,
        'attempt_number', v_attempt_number,
        'total', v_total
    );

EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object('status', 'session_conflict');
END;
$$;


-- =========================================================
-- 4. GET THE STATE OF ONE EXACT SESSION
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
    v_elapsed integer;
    v_current_index integer;
    v_remaining integer;
    v_question jsonb;
BEGIN
    SELECT *
    INTO v_session
    FROM public.quiz_sessions
    WHERE id = p_session_id
      AND user_id = p_user_id
      AND course_id = p_course_id;

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

    v_elapsed := greatest(
        0,
        floor(extract(epoch FROM (clock_timestamp() - v_session.started_at)))::integer
    );

    v_current_index := floor(v_elapsed / 60.0)::integer;

    IF v_current_index >= v_total THEN
        RETURN jsonb_build_object(
            'status', 'expired',
            'session_id', v_session.id,
            'attempt_number', v_session.attempt_number,
            'total', v_total
        );
    END IF;

    v_remaining := 60 - (v_elapsed % 60);
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
-- 5. SAVE AN ANSWER TO ONE EXACT SESSION
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
    v_elapsed integer;
    v_current_index integer;
    v_question jsonb;
    v_question_id text;
    v_options jsonb;
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

    v_elapsed := greatest(
        0,
        floor(extract(epoch FROM (clock_timestamp() - v_session.started_at)))::integer
    );

    v_current_index := floor(v_elapsed / 60.0)::integer;

    IF v_current_index >= v_total THEN
        RETURN jsonb_build_object('status', 'expired');
    END IF;

    IF p_question_index IS NULL
       OR p_answer_index IS NULL
       OR p_question_index < 0
       OR p_question_index >= v_total THEN
        RETURN jsonb_build_object('status', 'invalid_answer');
    END IF;

    IF p_question_index < v_current_index THEN
        RETURN jsonb_build_object('status', 'locked');
    END IF;

    v_question := v_session.question_snapshot -> p_question_index;
    v_options := v_question -> 'options';

    IF jsonb_typeof(v_options) <> 'array'
       OR p_answer_index < 0
       OR p_answer_index >= jsonb_array_length(v_options) THEN
        RETURN jsonb_build_object('status', 'invalid_answer');
    END IF;

    IF p_question_index > v_current_index THEN
        RETURN jsonb_build_object(
            'status', 'advanced',
            'current_index', v_current_index,
            'remaining_seconds', 60 - (v_elapsed % 60),
            'total', v_total,
            'question', v_question - 'correct_index'
        );
    END IF;

    v_question_id := v_question ->> 'id';

    UPDATE public.quiz_sessions
    SET
        answers = coalesce(answers, '{}'::jsonb) ||
            jsonb_build_object(v_question_id, p_answer_index),
        updated_at = now()
    WHERE id = p_session_id;

    RETURN jsonb_build_object(
        'status', 'saved',
        'session_id', p_session_id,
        'current_index', v_current_index,
        'remaining_seconds', 60 - (v_elapsed % 60)
    );
END;
$$;


-- =========================================================
-- 6. FINALIZE ONE EXACT SESSION
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
    v_elapsed integer;
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

    v_elapsed := greatest(
        0,
        floor(extract(epoch FROM (clock_timestamp() - v_session.started_at)))::integer
    );

    -- The complete quiz duration must have elapsed.
    IF v_elapsed < v_total * 60 THEN
        RETURN jsonb_build_object(
            'status', 'waiting',
            'remaining_seconds', (v_total * 60) - v_elapsed
        );
    END IF;

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

    v_percent := round((v_score::numeric / v_total) * 100)::integer;
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
        completed_at = now(),
        updated_at = now()
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
-- 7. RESTRICT FUNCTION EXECUTION
-- Only trusted server-side service_role may call these RPCs.
-- =========================================================

REVOKE ALL ON FUNCTION public.request_quiz_retake(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_quiz_retake(uuid, uuid, text)
TO service_role;

REVOKE ALL ON FUNCTION public.review_quiz_retake_request(uuid, uuid, text, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_quiz_retake_request(uuid, uuid, text, text)
TO service_role;

REVOKE ALL ON FUNCTION public.start_quiz_session_v2(uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_quiz_session_v2(uuid, uuid)
TO service_role;

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
