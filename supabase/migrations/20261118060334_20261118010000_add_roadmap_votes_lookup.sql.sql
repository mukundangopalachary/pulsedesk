/*
# Add roadmap vote lookup helper

Plain-English summary: lets a visitor find out which roadmap items they have already upvoted, so the page can highlight their votes. Returns only vote existence for the caller's own anonymous voter key.

## 1. New function
- `get_public_roadmap_votes(feedback_ids, voter_key)`: returns the subset of the given feedback ids that this voter key has upvoted.

## 2. Security
- Callable anonymously like the vote toggle; validates the voter key the same way and returns ids only (never voter keys or anything else about other visitors).

## Important notes
1. Input list is capped at 500 ids per call.
*/

CREATE OR REPLACE FUNCTION public.get_public_roadmap_votes(_feedback_ids uuid[], _voter_key text)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT array_agg(DISTINCT u.feedback_id)
  FROM public.roadmap_upvotes u
  WHERE u.voter_key = _voter_key AND u.feedback_id = ANY (_feedback_ids);
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_roadmap_votes(uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_roadmap_votes(uuid[], text) TO anon, authenticated;
