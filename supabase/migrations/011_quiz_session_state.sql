CREATE OR REPLACE FUNCTION public.get_quiz_session_state(
    p_user_id uuid,
    p_course_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session public.quiz_sessions%ROWTYPE;
    v_elapsed numeric;
    v_total integer;
    v_current_index integer;
    v_remaining integer;
    v_question jsonb;
BEGIN
    SELECT *
    INTO v_session
    FROM public.quiz_sessions
    WHERE user_id = p_user_id
      AND course_id = p_course_id;

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

    IF v_total <= 0 THEN
        RETURN jsonb_build_object('status', 'invalid_session');
    END IF;

    v_elapsed := GREATEST(
        0,
        EXTRACT(EPOCH FROM (clock_timestamp() - v_session.started_at))
    );

    v_current_index := FLOOR(v_elapsed / 60)::integer;

    IF v_current_index >= v_total THEN
        RETURN jsonb_build_object(
            'status', 'expired',
            'total', v_total,
            'total_seconds', v_total * 60
        );
    END IF;

    v_remaining := GREATEST(
        0,
        CEIL(60 - MOD(v_elapsed, 60))::integer
    );

    v_question := v_session.question_snapshot -> v_current_index;

    RETURN jsonb_build_object(
        'status', 'active',
        'current_index', v_current_index,
        'total', v_total,
        'remaining_seconds', v_remaining,
        'total_seconds', v_total * 60,
        'question', jsonb_build_object(
            'id', v_question -> 'id',
            'prompt', v_question -> 'prompt',
            'options', v_question -> 'options'
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_quiz_session_state(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_quiz_session_state(uuid, uuid)
TO service_role;