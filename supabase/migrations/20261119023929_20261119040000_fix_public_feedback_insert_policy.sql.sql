/*
# Fix public feedback submissions being rejected

Plain-English summary: customers could not send feedback from the public form. Two fixes: (1) the safety rule for public submissions now accepts the automatically detected category and mood (plus the optional screenshot reference), while still blocking anything dangerous like pre-set statuses or assignments; (2) it also blocks pre-ticked roadmap and Slack markers.

## 1. Changed rules
- "Anyone can submit feedback": public submissions may now include category, sentiment and screenshot_path (set by the app itself), but must still start as new, unassigned, untagged, not on the roadmap, not yet sent to Slack.

## 2. Security
- Still write-safe: a public visitor cannot set status, assignee, tags, roadmap status or the Slack marker. Only the app's own classification fields and image reference are accepted.
- Team members' abilities are unchanged.
*/

DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
CREATE POLICY "Anyone can submit feedback"
ON public.feedback FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'new'
  AND assignee_id IS NULL
  AND tags = '{}'
  AND roadmap_status IS NULL
  AND slack_notified_at IS NULL
);
