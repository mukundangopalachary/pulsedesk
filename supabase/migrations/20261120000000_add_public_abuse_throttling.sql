/*
# Throttle abuse of the public feedback form and roadmap votes

Plain-English summary: anonymous visitors could previously submit unlimited feedback and
stuff roadmap votes. This adds simple server-side limits that cannot be bypassed from the browser.

## 1. Feedback submissions
- A trigger rejects anonymous submissions when the same email has sent more than 5 items
  to a workspace in the last 10 minutes, or the workspace received more than 60 anonymous items
  in the last 10 minutes.
- Signed-in team members are not limited.

## 2. Roadmap votes
- `toggle_upvote` rejects new votes on an item when more than 100 votes arrived in the last minute.

## Security
- Trigger function runs with elevated rights only to count rows; it grants nothing to callers.
*/

CREATE OR REPLACE FUNCTION public.throttle_public_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF (SELECT count(*) FROM public.feedback
      WHERE workspace_id = NEW.workspace_id
        AND lower(email) = lower(NEW.email)
        AND created_at > now() - interval '10 minutes') >= 5 THEN
    RAISE EXCEPTION 'Too many submissions. Please try again later.' USING ERRCODE = 'P0001';
  END IF;

  IF (SELECT count(*) FROM public.feedback
      WHERE workspace_id = NEW.workspace_id
        AND created_at > now() - interval '10 minutes') >= 60 THEN
    RAISE EXCEPTION 'This workspace is receiving too many submissions. Please try again later.' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.throttle_public_feedback() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS feedback_throttle_public ON public.feedback;
CREATE TRIGGER feedback_throttle_public
BEFORE INSERT ON public.feedback
FOR EACH ROW EXECUTE FUNCTION public.throttle_public_feedback();

CREATE INDEX IF NOT EXISTS roadmap_upvotes_feedback_created_idx
ON public.roadmap_upvotes (feedback_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.toggle_upvote(_feedback_id uuid, _voter_key text)
RETURNS TABLE (upvoted boolean, upvotes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  on_roadmap boolean;
  already boolean;
  total bigint;
BEGIN
  IF _voter_key IS NULL OR char_length(_voter_key) < 8 OR char_length(_voter_key) > 64
     OR _voter_key !~ '^[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'Invalid voter';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.feedback f
    JOIN public.workspaces w ON w.id = f.workspace_id
    WHERE f.id = _feedback_id AND f.roadmap_status IS NOT NULL
  ) INTO on_roadmap;

  IF NOT on_roadmap THEN
    RAISE EXCEPTION 'This item is not on the public roadmap';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.roadmap_upvotes
    WHERE feedback_id = _feedback_id AND voter_key = _voter_key
  ) INTO already;

  IF already THEN
    DELETE FROM public.roadmap_upvotes WHERE feedback_id = _feedback_id AND voter_key = _voter_key;
  ELSE
    IF (SELECT count(*) FROM public.roadmap_upvotes
        WHERE feedback_id = _feedback_id AND created_at > now() - interval '1 minute') >= 100 THEN
      RAISE EXCEPTION 'Too many votes right now. Please try again later.';
    END IF;
    INSERT INTO public.roadmap_upvotes (feedback_id, voter_key)
    VALUES (_feedback_id, _voter_key)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT count(*) INTO total FROM public.roadmap_upvotes WHERE feedback_id = _feedback_id;

  RETURN QUERY SELECT NOT already, total;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.toggle_upvote(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_upvote(uuid, text) TO anon, authenticated;
