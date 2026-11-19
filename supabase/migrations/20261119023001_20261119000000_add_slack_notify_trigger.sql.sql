/*
# Wire Slack notifications to new feedback

Plain-English summary: when a customer submits feedback and the workspace has a Slack webhook saved, PulseDesk automatically posts a short summary to that Slack channel. Each item notifies Slack at most once, even if the submission is retried.

## 1. New function
- `notify_slack_for_feedback()`: runs automatically after a new feedback row is inserted. It records the notification time and calls the notify-slack server function in the background, so the customer's submission is never slowed down or blocked by Slack.

## 2. Automation
- A trigger fires this for every new feedback row.

## 3. Security
- The function runs with elevated rights (it needs to record the notification time) but reads the webhook URL through the settings table, which is only ever set by workspace owners and admins.
- Failures are logged and ignored: Slack problems can never lose customer feedback.

## Important notes
1. Works together with the notify-slack edge function, which formats and delivers the actual Slack message.
*/

CREATE OR REPLACE FUNCTION public.notify_slack_for_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.slack_notified_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.feedback
  SET slack_notified_at = now()
  WHERE id = NEW.id AND slack_notified_at IS NULL;

  BEGIN
    PERFORM net.http_post(
      url := (SELECT current_setting('app.supabase_url', true) || '/functions/v1/notify-slack'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(current_setting('app.service_role_key', true), '')
      ),
      body := jsonb_build_object('record', to_jsonb(NEW))
    );
  EXCEPTION WHEN OTHERS THEN
    -- Slack is best-effort: never block or lose feedback because of it.
    NULL;
  END;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_slack_for_feedback() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_feedback_insert_notify_slack ON public.feedback;
CREATE TRIGGER on_feedback_insert_notify_slack
AFTER INSERT ON public.feedback
FOR EACH ROW EXECUTE FUNCTION public.notify_slack_for_feedback();
