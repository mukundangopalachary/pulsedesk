import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, Slack, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Role, Workspace } from '@/lib/types';
import { Button, ErrorMessage, Field, Input, Spinner } from '@/components/ui';

const WEBHOOK_PATTERN = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/;

interface SlackSettingsProps {
  workspace: Workspace;
  role: Role;
  onClose: () => void;
}

export default function SlackSettings({ workspace, role, onClose }: SlackSettingsProps) {
  const canManage = role === 'owner' || role === 'admin';
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: fetchError } = await supabase
        .from('workspace_settings')
        .select('slack_webhook_url')
        .eq('workspace_id', workspace.id)
        .maybeSingle();
      if (cancelled) return;
      if (fetchError) {
        console.error(fetchError);
        setLoadError('Slack settings could not be loaded.');
      } else {
        setWebhookUrl((data?.slack_webhook_url as string | null) ?? '');
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace.id]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = webhookUrl.trim();
    if (value && !WEBHOOK_PATTERN.test(value)) {
      setError('That does not look like a Slack webhook URL. Copy it from your Slack incoming-webhook app settings.');
      return;
    }
    setError(null);
    setSaving(true);
    setSaved(false);
    const { error: upsertError } = await supabase
      .from('workspace_settings')
      .upsert({ workspace_id: workspace.id, slack_webhook_url: value || null, updated_at: new Date().toISOString() });
    setSaving(false);
    if (upsertError) {
      console.error(upsertError);
      setError('Slack settings could not be saved. Please try again.');
      return;
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Slack className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
          Slack notifications
        </h1>
        <button type="button" onClick={onClose} aria-label="Close Slack settings" className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {!loaded ? (
          <Spinner />
        ) : (
          <div className="max-w-md space-y-5">
            {!canManage ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Only workspace owners and admins can change Slack settings.
              </p>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  When a customer sends new feedback, PulseDesk posts a short summary to your Slack channel so your
                  team sees it immediately.
                </p>

                <ol className="space-y-2 rounded-xl bg-zinc-100/70 px-4 py-3 text-sm leading-relaxed text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
                  <li>1. In Slack, create an incoming webhook (Apps &amp; integrations).</li>
                  <li>2. Choose the channel that should receive feedback alerts.</li>
                  <li>3. Copy the webhook URL — it starts with <code className="text-xs">https://hooks.slack.com/services/</code> — and paste it below.</li>
                </ol>

                <form onSubmit={handleSave} className="space-y-4">
                  <Field label="Slack webhook URL">
                    <Input
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://hooks.slack.com/services/T000/B000/XXXX"
                    />
                  </Field>
                  <ErrorMessage message={error} />
                  {loadError && <ErrorMessage message={loadError} />}
                  {saved && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                      Saved. New feedback will now be posted to your Slack channel.
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" loading={saving}>Save</Button>
                    {webhookUrl.trim() !== '' && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setWebhookUrl(''); setError(null); }}>
                        Clear
                      </Button>
                    )}
                  </div>
                </form>

                <a
                  href="https://slack.com/help/articles/115005265063-Incoming-webhooks-for-Slack"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden />
                  Slack's guide to incoming webhooks
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
