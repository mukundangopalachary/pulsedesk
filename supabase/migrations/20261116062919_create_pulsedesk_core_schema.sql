/*
# Create PulseDesk core schema

Plain-English summary: sets up the tables for workspaces (one per company), their team members, customer feedback items, and internal comments on feedback. Each workspace's data is only visible to its own members.

## 1. New tables
- `workspaces`: a company workspace with a name, a URL slug (used for the public feedback form), and an owner.
- `workspace_members`: which users belong to which workspace and their role (owner, admin, member, viewer).
- `feedback`: a feedback item submitted by a customer through the public form, with status, optional assignee and tags.
- `feedback_comments`: internal team comments on a feedback item.

## 2. Helper function
- `workspace_role(ws)`: returns the calling user's role in a workspace (or null). Runs with elevated rights so policies can check membership without recursion.

## 3. Security
- Row level security is enabled on every new table.
- Workspaces are visible only to members; only owners and admins can edit them, only owners can delete them.
- Members see the team list of their own workspace only.
- Anonymous visitors can insert feedback only as a fresh "new" item with no assignee, tags, category or sentiment. They cannot read anything.
- Viewers can read but not change feedback.
- Only owners and admins can delete feedback.

## Important notes
1. New workspaces are created through a separate function that also makes the creator the owner.
2. Team members are not yet editable from the client; invitations come later.
*/

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$'),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspaces_owner_id_idx ON public.workspaces (owner_id);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS workspace_members_user_id_idx ON public.workspace_members (user_id);

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved')),
  category text CHECK (category IN ('bug', 'feature_request', 'pricing', 'support', 'other')),
  sentiment text CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  tags text[] NOT NULL DEFAULT '{}',
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_workspace_created_idx ON public.feedback (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_assignee_idx ON public.feedback (assignee_id);

CREATE TABLE IF NOT EXISTS public.feedback_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_comments_feedback_idx ON public.feedback_comments (feedback_id, created_at);

CREATE OR REPLACE FUNCTION public.workspace_role(_ws uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.role FROM public.workspace_members m
  WHERE m.workspace_id = _ws AND m.user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.workspace_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_role(uuid) TO authenticated;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT SELECT ON public.workspace_members TO authenticated;
GRANT SELECT, INSERT ON public.feedback TO anon;
GRANT SELECT, UPDATE, DELETE ON public.feedback TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.feedback_comments TO authenticated;

DROP POLICY IF EXISTS "Members can view their workspace" ON public.workspaces;
CREATE POLICY "Members can view their workspace"
ON public.workspaces FOR SELECT
TO authenticated
USING (public.workspace_role(id) IS NOT NULL);

DROP POLICY IF EXISTS "Admins can update workspace" ON public.workspaces;
CREATE POLICY "Admins can update workspace"
ON public.workspaces FOR UPDATE
TO authenticated
USING (public.workspace_role(id) IN ('owner', 'admin'))
WITH CHECK (public.workspace_role(id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Owners can delete workspace" ON public.workspaces;
CREATE POLICY "Owners can delete workspace"
ON public.workspaces FOR DELETE
TO authenticated
USING (public.workspace_role(id) = 'owner');

DROP POLICY IF EXISTS "Members can view team" ON public.workspace_members;
CREATE POLICY "Members can view team"
ON public.workspace_members FOR SELECT
TO authenticated
USING (public.workspace_role(workspace_id) IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
CREATE POLICY "Anyone can submit feedback"
ON public.feedback FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'new'
  AND assignee_id IS NULL
  AND category IS NULL
  AND sentiment IS NULL
  AND tags = '{}'
);

DROP POLICY IF EXISTS "Members can view feedback" ON public.feedback;
CREATE POLICY "Members can view feedback"
ON public.feedback FOR SELECT
TO authenticated
USING (public.workspace_role(workspace_id) IS NOT NULL);

DROP POLICY IF EXISTS "Non-viewers can update feedback" ON public.feedback;
CREATE POLICY "Non-viewers can update feedback"
ON public.feedback FOR UPDATE
TO authenticated
USING (public.workspace_role(workspace_id) IN ('owner', 'admin', 'member'))
WITH CHECK (
  public.workspace_role(workspace_id) IN ('owner', 'admin', 'member')
  AND (
    assignee_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = feedback.workspace_id AND m.user_id = feedback.assignee_id
    )
  )
);

DROP POLICY IF EXISTS "Admins can delete feedback" ON public.feedback;
CREATE POLICY "Admins can delete feedback"
ON public.feedback FOR DELETE
TO authenticated
USING (public.workspace_role(workspace_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Members can view comments" ON public.feedback_comments;
CREATE POLICY "Members can view comments"
ON public.feedback_comments FOR SELECT
TO authenticated
USING (public.workspace_role(workspace_id) IS NOT NULL);

DROP POLICY IF EXISTS "Non-viewers can comment on feedback" ON public.feedback_comments;
CREATE POLICY "Non-viewers can comment on feedback"
ON public.feedback_comments FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND public.workspace_role(workspace_id) IN ('owner', 'admin', 'member')
  AND EXISTS (
    SELECT 1 FROM public.feedback f
    WHERE f.id = feedback_comments.feedback_id AND f.workspace_id = feedback_comments.workspace_id
  )
);

DROP POLICY IF EXISTS "Authors or admins can delete comments" ON public.feedback_comments;
CREATE POLICY "Authors or admins can delete comments"
ON public.feedback_comments FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.workspace_role(workspace_id) IN ('owner', 'admin')
);
