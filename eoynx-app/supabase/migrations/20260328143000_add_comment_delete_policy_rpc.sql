-- Comment delete policy:
-- 1) Author deletes within 5 minutes -> hard delete
-- 2) Author deletes after 5 minutes -> soft delete with placeholder
-- 3) Item owner deletes other's comment -> soft delete with owner placeholder

CREATE OR REPLACE FUNCTION public.delete_comment_with_policy(p_comment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_comment RECORD;
  v_age interval;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT
    c.id,
    c.user_id,
    c.created_at,
    c.item_id,
    i.owner_id
  INTO v_comment
  FROM public.comments c
  JOIN public.items i ON i.id = c.item_id
  WHERE c.id = p_comment_id;

  IF v_comment.id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;

  IF v_uid <> v_comment.user_id AND v_uid <> v_comment.owner_id THEN
    RAISE EXCEPTION 'No permission to delete this comment';
  END IF;

  -- Item owner deleting someone else's comment: always soft delete.
  IF v_uid = v_comment.owner_id AND v_uid <> v_comment.user_id THEN
    UPDATE public.comments
    SET content = '게시자에 의해 삭제됀 메시지 입니다',
        updated_at = now()
    WHERE id = p_comment_id;

    RETURN jsonb_build_object('mode', 'soft_owner');
  END IF;

  -- Author delete policy (includes owner deleting their own comment)
  v_age := now() - v_comment.created_at;
  IF v_age <= interval '5 minutes' THEN
    DELETE FROM public.comments WHERE id = p_comment_id;
    RETURN jsonb_build_object('mode', 'hard');
  END IF;

  UPDATE public.comments
  SET content = '삭제된 메시지 입니다',
      updated_at = now()
  WHERE id = p_comment_id;

  RETURN jsonb_build_object('mode', 'soft_author');
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_comment_with_policy(uuid) TO authenticated;
