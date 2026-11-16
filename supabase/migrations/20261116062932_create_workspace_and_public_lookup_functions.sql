/*
# Workspace creation and public form lookup functions

Plain-English summary: adds two safe functions the app calls. One creates a new workspace and makes the signed-in user its owner in a single step. The other lets anyone visiting a public feedback link see the company name, without exposing anything else about the workspace.

## 1. New functions
- `create_workspace(name, slug)`: creates a workspace owned by the caller and adds the caller as its owner member.
- `get_public_workspace(slug)`: returns only the id, name and slug of a workspace for the public feedback form and roadmap.

## 2. Security
- `create_workspace` requires a signed-in user.
- `get_public_workspace` is callable by anonymous visitors but returns only three non-sensitive columns.
- Both functions have their default public access removed and are granted only to the roles that need them.

## Important notes
1. Functions run with elevated rights but use a fixed search path to prevent hijacking.
*/

CREATE OR REPLACE FUNCTION public.create_workspace(_name text, _slug text)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  ws public.workspaces;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to create a workspace';
  END IF;

  INSERT INTO public.workspaces (name, slug, owner_id)
  VALUES (_name, _slug, auth.uid())
  RETURNING * INTO ws;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (ws.id, auth.uid(), 'owner');

  RETURN ws;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_workspace(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_workspace(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_workspace(_slug text)
RETURNS TABLE (id uuid, name text, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT w.id, w.name, w.slug FROM public.workspaces w WHERE w.slug = _slug;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_workspace(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_workspace(text) TO anon, authenticated;
