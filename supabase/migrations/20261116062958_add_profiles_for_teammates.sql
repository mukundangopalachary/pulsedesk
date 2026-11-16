/*
# Add profiles for teammate names

Plain-English summary: stores a display name and email for every user, so the team can see who they are when assigning feedback. Profiles are created automatically when someone signs up.

## 1. New table
- `profiles`: one row per user with their id, email, full name and creation time.

## 2. Automation
- A trigger creates a profile whenever a new account is created, using the name entered at sign-up.
- Existing accounts receive a profile during this migration.

## 3. Security
- Row level security is enabled on `profiles`.
- A user can read their own profile and the profiles of people in a workspace they belong to.
- Users cannot write to profiles directly; the trigger does this.

## Important notes
1. Email is copied from the account and kept as a fallback display name.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, email, full_name)
SELECT u.id, COALESCE(u.email, ''), COALESCE(u.raw_user_meta_data ->> 'full_name', '')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can view own and teammate profiles" ON public.profiles;
CREATE POLICY "Users can view own and teammate profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.workspace_members me
    JOIN public.workspace_members them ON them.workspace_id = me.workspace_id
    WHERE me.user_id = auth.uid() AND them.user_id = profiles.id
  )
);
