
-- 010: Atomic server-side timed quiz processing.
-- All functions are callable only by the service role.

CREATE OR REPLACE FUNCTION public.record_quiz_session_answer(
    p_user_id UUID,
    p_course_id UUID,
    p_question_index INTEGER,
    p_answer_index INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session public.quiz_sessions%ROWTYPE;
    v_total INTEGER;
    v_current_index INTEGER;
    v_elapsed NUMERIC;
    v_remaining INTEGER;
    v_question JSONB;
    v_question_id TEXT;
    v_options JSONB;
BEGIN
    SELECT *
    INTO v_session
    FROM public.quiz_sessions
    WHERE user_id = p_user_id
      AND course_id = p_course_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    IF v_session.completed_at IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'completed');
    END IF;

    IF jsonb_typeof(v_session.question_snapshot) <> 'array' THEN
        RETURN jsonb_build_object('status', 'invalid_session');
    END IF;

    v_total := jsonb_array_length(v_session.question_snapshot);

    IF v_total < 1 THEN
        RETURN jsonb_build_object('status', 'invalid_session');
    END IF;

    v_elapsed := GREATEST(
        0,
        EXTRACT(EPOCH FROM (clock_timestamp() - v_session.started_at))
    );

    v_current_index := FLOOR(v_elapsed / 60)::INTEGER;

    IF v_current_index >= v_total THEN
        RETURN jsonb_build_object(
            'status', 'expired',
            'total', v_total
        );
    END IF;

    IF p_question_index <> v_current_index THEN
        RETURN jsonb_build_object(
            'status', 'wrong_question',
            'current_index', v_current_index
        );
    END IF;

    IF p_answer_index < 0 THEN
        RETURN jsonb_build_object('status', 'invalid_answer');
    END IF;

    v_question := v_session.question_snapshot -> v_current_index;
    v_question_id := v_question ->> 'id';
    v_options := v_question -> 'options';

    IF v_question_id IS NULL
       OR jsonb_typeof(v_options) <> 'array'
       OR p_answer_index >= jsonb_array_length(v_options) THEN
        RETURN jsonb_build_object('status', 'invalid_answer');
    END IF;

    UPDATE public.quiz_sessions
    SET
        answers = jsonb_set(
            COALESCE(answers, '{}'::jsonb),
            ARRAY[v_question_id],
            to_jsonb(p_answer_index),
            true
        ),
        updated_at = clock_timestamp()
    WHERE id = v_session.id;

    v_remaining := GREATEST(
        0,
        CEIL(60 - MOD(v_elapsed, 60))::INTEGER
    );

    RETURN jsonb_build_object(
        'status', 'saved',
        'current_index', v_current_index,
        'remaining_seconds', v_remaining
    );
END;
$$;


CREATE OR REPLACE FUNCTION public.finalize_quiz_session(
    p_user_id UUID,
    p_course_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session public.quiz_sessions%ROWTYPE;
    v_total INTEGER;
    v_score INTEGER := 0;
    v_percent INTEGER;
    v_pass_percent INTEGER;
    v_passed BOOLEAN;
    v_elapsed NUMERIC;
    v_question JSONB;
    v_question_id TEXT;
    v_correct_index INTEGER;
    v_answer_text TEXT;
    v_attempt RECORD;
BEGIN
    SELECT *
    INTO v_session
    FROM public.quiz_sessions
    WHERE user_id = p_user_id
      AND course_id = p_course_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    -- If already finalized, return the existing result.
    IF v_session.completed_at IS NOT NULL THEN
        SELECT score, total, percent, passed
        INTO v_attempt
        FROM public.quiz_attempts
        WHERE user_id = p_user_id
          AND course_id = p_course_id;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'status', 'completed',
                'score', v_attempt.score,
                'total', v_attempt.total,
                'percent', v_attempt.percent,
                'passed', v_attempt.passed
            );
        END IF;

        RETURN jsonb_build_object('status', 'attempt_missing');
    END IF;

    IF jsonb_typeof(v_session.question_snapshot) <> 'array' THEN
        RETURN jsonb_build_object('status', 'invalid_session');
    END IF;

    v_total := jsonb_array_length(v_session.question_snapshot);

    IF v_total < 1 THEN
        RETURN jsonb_build_object('status', 'invalid_session');
    END IF;

    v_elapsed := GREATEST(
        0,
        EXTRACT(EPOCH FROM (clock_timestamp() - v_session.started_at))
    );

    -- The full session must expire before it can be finalized.
    IF v_elapsed < (v_total * 60) THEN
        RETURN jsonb_build_object(
            'status', 'waiting',
            'remaining_seconds',
            CEIL((v_total * 60) - v_elapsed)::INTEGER
        );
    END IF;

    SELECT COALESCE(pass_percent, 90)
    INTO v_pass_percent
    FROM public.course_quizzes
    WHERE course_id = p_course_id
      AND published = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'quiz_unavailable');
    END IF;

    -- Grade only answers saved through the protected answer function.
    -- Missing answers are automatically incorrect.
    FOR v_question IN
        SELECT value
        FROM jsonb_array_elements(v_session.question_snapshot)
    LOOP
        v_question_id := v_question ->> 'id';

        IF v_question_id IS NULL
           OR jsonb_typeof(v_question -> 'correct_index') <> 'number'
           OR jsonb_typeof(v_question -> 'options') <> 'array' THEN
            RETURN jsonb_build_object('status', 'invalid_snapshot');
        END IF;

        v_correct_index := (v_question ->> 'correct_index')::INTEGER;
        v_answer_text := v_session.answers ->> v_question_id;

        IF v_answer_text ~ '^[0-9]+$'
           AND v_answer_text::INTEGER = v_correct_index THEN
            v_score := v_score + 1;
        END IF;
    END LOOP;

    v_percent := FLOOR((v_score * 100.0) / v_total)::INTEGER;
    v_passed := (v_score * 100 >= v_pass_percent * v_total);

    -- The existing unique constraint still enforces one attempt.
    INSERT INTO public.quiz_attempts (
        user_id,
        course_id,
        score,
        total,
        percent,
        passed,
        answers
    )
    VALUES (
        p_user_id,
        p_course_id,
        v_score,
        v_total,
        v_percent,
        v_passed,
        COALESCE(v_session.answers, '{}'::jsonb)
    )
    ON CONFLICT (user_id, course_id) DO NOTHING;

    SELECT score, total, percent, passed
    INTO v_attempt
    FROM public.quiz_attempts
    WHERE user_id = p_user_id
      AND course_id = p_course_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'save_failed');
    END IF;

    UPDATE public.quiz_sessions
    SET
        completed_at = clock_timestamp(),
        updated_at = clock_timestamp()
    WHERE id = v_session.id;

    RETURN jsonb_build_object(
        'status', 'completed',
        'score', v_attempt.score,
        'total', v_attempt.total,
        'percent', v_attempt.percent,
        'passed', v_attempt.passed,
        'pass_percent', v_pass_percent
    );
END;
$$;


-- Do not allow browser clients to call these functions.
REVOKE ALL ON FUNCTION public.record_quiz_session_answer(
    UUID, UUID, INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.finalize_quiz_session(
    UUID, UUID
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_quiz_session_answer(
    UUID, UUID, INTEGER, INTEGER
) TO service_role;

GRANT EXECUTE ON FUNCTION public.finalize_quiz_session(
    UUID, UUID
) TO service_role;
