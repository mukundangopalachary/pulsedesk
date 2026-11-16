import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, SearchX, Star } from 'lucide-react';
import { submitFeedback } from '@/lib/feedback';
import { getPublicWorkspace } from '@/lib/workspace';
import type { PublicWorkspace } from '@/lib/types';
import { Button, ErrorMessage, Field, Input, Logo, Spinner, Textarea, ThemeToggle } from '@/components/ui';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATING_LABELS = ['Very poor', 'Poor', 'Okay', 'Good', 'Excellent'];

interface PublicFeedbackPageProps {
  slug: string;
}

export default function PublicFeedbackPage({ slug }: PublicFeedbackPageProps) {
  const [workspace, setWorkspace] = useState<PublicWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const found = await getPublicWorkspace(slug);
        if (!cancelled) setWorkspace(found);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'This feedback form could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspace) return;
    if (rating === 0) {
      setSubmitError('Please choose a rating before sending.');
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setSubmitError('Please enter a valid email address so the team can reply.');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      await submitFeedback({
        workspaceId: workspace.id,
        name: name.trim(),
        email: email.trim(),
        rating,
        message: message.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Your feedback could not be sent.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setRating(0);
    setMessage('');
    setSubmitted(false);
  };

  const shownRating = hoverRating || rating;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 justify-center px-6 pb-16 pt-4">
        {loading && <Spinner />}

        {!loading && loadError && (
          <div className="w-full max-w-md pt-12">
            <ErrorMessage message={loadError} />
          </div>
        )}

        {!loading && !loadError && !workspace && (
          <div className="flex w-full max-w-md flex-col items-center pt-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-200/70 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <SearchX className="h-6 w-6" aria-hidden />
            </div>
            <h1 className="mt-6 text-xl font-semibold">This feedback form doesn't exist</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Check the link you were given and try again.</p>
          </div>
        )}

        {!loading && !loadError && workspace && submitted && (
          <div className="flex w-full max-w-md flex-col items-center pt-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="h-7 w-7" aria-hidden />
            </div>
            <h1 className="mt-6 text-xl font-semibold">Thanks, your feedback is in</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              The {workspace.name} team reads every message and will reply to {email.trim()} if needed.
            </p>
            <Button variant="secondary" className="mt-8" onClick={resetForm}>
              Send another response
            </Button>
          </div>
        )}

        {!loading && !loadError && workspace && !submitted && (
          <div className="w-full max-w-lg pt-6">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Feedback for {workspace.name}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">How are we doing?</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Tell us what is working, what is not, and what you wish we did. It takes less than a minute.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-8 space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Overall rating</span>
                <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={`${value} star${value > 1 ? 's' : ''}: ${RATING_LABELS[value - 1]}`}
                      onMouseEnter={() => setHoverRating(value)}
                      onFocus={() => setHoverRating(value)}
                      onBlur={() => setHoverRating(0)}
                      onClick={() => setRating(value)}
                      className="rounded-md p-1 transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <Star
                        className={`h-8 w-8 transition-colors ${
                          value <= shownRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-zinc-300 dark:text-zinc-700'
                        }`}
                        aria-hidden
                      />
                    </button>
                  ))}
                  <span className="ml-3 text-sm text-zinc-500 dark:text-zinc-400">
                    {shownRating ? RATING_LABELS[shownRating - 1] : 'Select a rating'}
                  </span>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Your name">
                  <Input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Lee" autoComplete="name" />
                </Field>
                <Field label="Email">
                  <Input required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jordan@example.com" autoComplete="email" />
                </Field>
              </div>

              <Field label="Your feedback">
                <Textarea
                  required
                  rows={5}
                  maxLength={5000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What should we know?"
                  className="resize-y"
                />
              </Field>

              <ErrorMessage message={submitError} />

              <Button type="submit" className="w-full" loading={submitting} disabled={!name.trim() || !message.trim()}>
                Send feedback
              </Button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
