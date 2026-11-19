/*
# Move anonymous writes behind the public-actions edge function

Plain-English summary: public feedback, screenshot uploads and roadmap votes now go through a
server function that can check a captcha and a database-backed rate limit. Direct anonymous
writes from the browser are switched off, so the limits cannot be bypassed.

## 1. New
- `rate_limits` table and `check_rate_limit(key, limit, window_seconds)` (server-side only).

## 2. Removed
- Anonymous INSERT on `feedback` and its policy.
- Anonymous/authenticated EXECUTE on `toggle_upvote` (service role keeps it).
- Anonymous screenshot upload policy (uploads use signed URLs from the edge function).

## Security
- `rate_limits` has RLS enabled and no policies: only the service role can touch it.
*/

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_rate_limit(_key text, _limit integer, _window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  win timestamptz;
  used integer;
BEGIN
  win := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);

  INSERT INTO public.rate_limits (key, window_start, count)
  VALUES (_key, win, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO used;

  IF random() < 0.02 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN used <= _limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;

DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
REVOKE INSERT ON public.feedback FROM anon, authenticated;
GRANT INSERT ON public.feedback TO service_role;

REVOKE EXECUTE ON FUNCTION public.toggle_upvote(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_upvote(uuid, text) TO service_role;

DROP POLICY IF EXISTS "Anyone can upload feedback screenshots" ON storage.objects;
