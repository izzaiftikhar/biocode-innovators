
-- 016: Allow unlimited student-initiated quiz retakes.
-- Preserves all previous attempts, sessions, scores and certificates.
-- Keeps the per-question timing functions from migration 015 unchanged.

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
    v_quiz public.course_quizzes%ROWTYPE;
    v_snapshot jsonb;
    v_total integer;
    v_attempt_number integer;
    v_session_id uuid;
    v_started_at timestamptz;
    v_item jsonb;
    v_options jsonb;
    v_correct_index integer;
BEGIN
    IF p_user_id IS NULL OR p_course_id IS NULL THEN
        RETURN jsonb_build_object('status', 'invalid_request');
    END IF;

    -- Serialize attempts for this student and course.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(p_user_id::text || ':' || p_course_id::text, 0)
    );

    -- Never replace or reset an active session.
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

    -- Only published quizzes can be started.
    SELECT *
    INTO v_quiz
    FROM public.course_quizzes
    WHERE course_id = p_course_id
      AND published = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'no_quiz');
    END IF;

    -- Build a trusted question snapshot.
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

    IF v_total IS NULL OR v_total = 0 OR v_snapshot IS NULL THEN
        RETURN jsonb_build_object('status', 'no_questions');
    END IF;

    -- Validate every question before creating a session.
    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(v_snapshot)
    LOOP
        v_options := v_item -> 'options';

        IF jsonb_typeof(v_options) IS DISTINCT FROM 'array'
           OR jsonb_array_length(v_options) < 2 THEN
            RETURN jsonb_build_object('status', 'invalid_questions');
        END IF;

        IF coalesce(v_item ->> 'correct_index', '') !~ '^[0-9]+$' THEN
            RETURN jsonb_build_object('status', 'invalid_questions');
        END IF;

        v_correct_index := (v_item ->> 'correct_index')::integer;

        IF v_correct_index < 0
           OR v_correct_index >= jsonb_array_length(v_options) THEN
            RETURN jsonb_build_object('status', 'invalid_questions');
        END IF;
    END LOOP;

    -- Find the highest number across both historical attempts and sessions.
    -- This prevents an old attempt number from being reused.
    SELECT
        GREATEST(
            coalesce((
                SELECT max(attempt_number)
                FROM public.quiz_attempts
                WHERE user_id = p_user_id
                  AND course_id = p_course_id
            ), 0),
            coalesce((
                SELECT max(attempt_number)
                FROM public.quiz_sessions
                WHERE user_id = p_user_id
                  AND course_id = p_course_id
            ), 0)
        ) + 1
    INTO v_attempt_number;

    v_started_at := clock_timestamp();

    -- Every new attempt gets a separate session and question snapshot.
    INSERT INTO public.quiz_sessions (
        user_id,
        course_id,
        started_at,
        question_snapshot,
        answers,
        pass_percent,
        attempt_number,
        current_question_index,
        question_started_at
    )
    VALUES (
        p_user_id,
        p_course_id,
        v_started_at,
        v_snapshot,
        '{}'::jsonb,
        v_quiz.pass_percent,
        v_attempt_number,
        0,
        v_started_at
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

-- Keep this function restricted to trusted server-side calls.
REVOKE ALL ON FUNCTION public.start_quiz_session_v2(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.start_quiz_session_v2(uuid, uuid)
TO service_role;
