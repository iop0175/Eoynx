-- Create notifications when a comment/reply is liked
CREATE OR REPLACE FUNCTION public.notify_comment_like_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment RECORD;
  v_preview TEXT;
BEGIN
  SELECT id, item_id, user_id, parent_id
  INTO v_comment
  FROM public.comments
  WHERE id = NEW.comment_id;

  IF v_comment.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Do not create self-like notifications
  IF v_comment.user_id IS NULL OR v_comment.user_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  v_preview := CASE
    WHEN v_comment.parent_id IS NULL THEN 'comment_like'
    ELSE 'reply_like'
  END;

  INSERT INTO public.notifications (user_id, type, actor_id, item_id, comment_id, preview)
  VALUES (v_comment.user_id, 'comment', NEW.user_id, v_comment.item_id, v_comment.id, v_preview);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_like_notification ON public.comment_likes;
CREATE TRIGGER trg_comment_like_notification
AFTER INSERT ON public.comment_likes
FOR EACH ROW
EXECUTE FUNCTION public.notify_comment_like_insert();
