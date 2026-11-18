/*
# Public roadmap, upvotes, feedback screenshots, Slack notifications

Plain-English summary: adds three features. (1) A public roadmap: teams can mark feedback as Planned, In progress, or Shipped, and anyone with the workspace's roadmap link can see those items and upvote them (one vote per visitor, tracked anonymously). (2) Screenshots: customers can attach an image when submitting the public feedback form; team members can view it. (3) Slack: owners and admins can save a Slack incoming webhook, and new feedback is posted to that Slack channel.

## 1. Modified tables
- `feedback`: two new columns — `roadmap_status` (null, or 'planned' / 'in_progress' / 'shipped') and `screenshot_path` (storage path of an uploaded image), plus `slack_notified_at` used to make sure each item is posted to Slack only once.

## 2. New tables
- `workspace_settings`: one row per workspace holding the Slack webhook URL. Only owners and admins can read or change it because a webhook URL can post to the team's Slack.
- `roadmap_upvotes`: one row per upvote, keyed by feedback and an anonymous voter key. No direct access — votes go through a function.

## 3. New functions
- `get_public_roadmap(slug)`: returns the id, author name, message, category, roadmap status, upvote count and date of feedback items that are on the roadmap, for the public roadmap page. Exposes nothing else.
- `toggle_upvote(feedback_id, voter_key)`: anyone (including anonymous visitors) can add or remove their single vote on a roadmap item. Returns whether the item is now upvoted and the new total. Rejects items that are not on the roadmap and malformed voter keys.

## 4. Storage
- A private `feedback-screenshots` bucket for customer uploads: images only (jpeg, png, webp), 5 MB maximum, enforced by the bucket settings.
- Anyone can upload into the bucket (the public form has no account); only signed-in team members can view, and only for workspaces they belong to.

## 5. Security
- Row level security on both new tables. `workspace_settings` is restricted to owners and admins of the workspace. `roadmap_upvotes` has no client access at all — only the vote function.
- `get_public_roadmap` is callable by anonymous visitors but returns only roadmap-listed items and only non-sensitive columns.
- The vote function is callable anonymously; it caps and validates every input.

## Important notes
1. Upvotes are counted live from the votes table, so counts stay accurate after edits.
2. Removing a member or feedback cleans up related rows automatically through foreign keys.
*/

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS roadmap_status text CHECK (roadmap_status IN ('planned', 'in_progress', 'shipped')),
  ADD COLUMN IF NOT EXISTS screenshot_path text,
  ADD COLUMN IF NOT EXISTS slack_notified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.workspace_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  slack_webhook_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.workspace_settings TO authenticated;

DROP POLICY IF EXISTS "Admins can manage workspace settings" ON public.workspace_settings;
CREATE POLICY "Admins can manage workspace settings"
ON public.workspace_settings FOR SELECT
TO authenticated
USING (public.workspace_role(workspace_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Admins can insert workspace settings" ON public.workspace_settings;
CREATE POLICY "Admins can insert workspace settings"
ON public.workspace_settings FOR INSERT
TO authenticated
WITH CHECK (public.workspace_role(workspace_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Admins can update workspace settings" ON public.workspace_settings;
CREATE POLICY "Admins can update workspace settings"
ON public.workspace_settings FOR UPDATE
TO authenticated
USING (public.workspace_role(workspace_id) IN ('owner', 'admin'))
WITH CHECK (public.workspace_role(workspace_id) IN ('owner', 'admin'));

CREATE TABLE IF NOT EXISTS public.roadmap_upvotes (
  feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  voter_key text NOT NULL CHECK (char_length(voter_key) BETWEEN 8 AND 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (feedback_id, voter_key)
);

CREATE INDEX IF NOT EXISTS roadmap_upvotes_feedback_idx ON public.roadmap_upvotes (feedback_id);

ALTER TABLE public.roadmap_upvotes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_public_roadmap(_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  message text,
  category text,
  roadmap_status text,
  upvotes bigint,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT f.id, f.name, f.message, f.category, f.roadmap_status,
         (SELECT count(*) FROM public.roadmap_upvotes u WHERE u.feedback_id = f.id)::bigint AS upvotes,
         f.created_at
  FROM public.feedback f
  JOIN public.workspaces w ON w.id = f.workspace_id
  WHERE w.slug = _slug AND f.roadmap_status IS NOT NULL
  ORDER BY upvotes DESC, f.created_at DESC;
$$;

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
    INSERT INTO public.roadmap_upvotes (feedback_id, voter_key)
    VALUES (_feedback_id, _voter_key)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT count(*) INTO total FROM public.roadmap_upvotes WHERE feedback_id = _feedback_id;

  RETURN QUERY SELECT NOT already, total;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_roadmap(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_roadmap(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.toggle_upvote(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_upvote(uuid, text) TO anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-screenshots',
  'feedback-screenshots',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Anyone can upload feedback screenshots" ON storage.objects;
CREATE POLICY "Anyone can upload feedback screenshots"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'feedback-screenshots'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

DROP POLICY IF EXISTS "Members can view feedback screenshots" ON storage.objects;
CREATE POLICY "Members can view feedback screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'feedback-screenshots'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.workspace_role(((storage.foldername(name))[1])::uuid) IS NOT NULL
);
