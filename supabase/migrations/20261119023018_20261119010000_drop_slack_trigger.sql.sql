/*
# Remove database-side Slack trigger (moved to app flow)

Plain-English summary: the previous attempt fired Slack notifications from inside the database, which needs network settings the database does not have. Notifications now start from the app right after a submission succeeds. This migration removes the trigger and its function; nothing else changes.

## 1. Removed
- The `on_feedback_insert_notify_slack` trigger and the `notify_slack_for_feedback` function.

## 2. Security
- No access changes. The notify-slack server function remains the only thing that talks to Slack, and it marks each feedback item as notified at most once.

## Important notes
1. Slack remains best-effort: a failure never blocks or loses feedback.
*/

DROP TRIGGER IF EXISTS on_feedback_insert_notify_slack ON public.feedback;
DROP FUNCTION IF EXISTS public.notify_slack_for_feedback();
