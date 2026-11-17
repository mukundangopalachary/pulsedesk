import { useEffect, useState } from 'react';
import { CheckCircle2, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { acceptInvite } from '@/lib/workspace';
import { navigate } from '@/lib/router';
import { Button, Logo, Spinner, ThemeToggle } from '@/components/ui';

interface InvitePageProps {
  token: string;
}

export default function InvitePage({ token }: InvitePageProps) {
  const { user, loading } = useAuth();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (loading || !user || done) return;
    let cancelled = false;
    setWorking(true);
    setError(null);
    (async () => {
      try {
        const slug = await acceptInvite(token);
        if (cancelled) return;
        setDone(true);
        navigate(`/app/${slug}`);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'This invitation could not be accepted.');
      } finally {
        if (!cancelled) setWorking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, loading, user, done, attempt]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        {(loading || (user && working && !error)) && <Spinner />}

        {!loading && !user && (
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              <Users className="h-7 w-7" aria-hidden />
            </div>
            <h1 className="mt-6 text-xl font-semibold tracking-tight">You've been invited to a team</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Sign in with the email address the invitation was sent to, then open the invite link again.
            </p>
            <Button className="mt-6 w-full" onClick={() => navigate('/auth')}>
              Sign in
            </Button>
          </div>
        )}

        {!loading && user && error && !done && (
          <div className="w-full max-w-sm text-center">
            <h1 className="text-xl font-semibold tracking-tight">Invitation problem</h1>
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
              {error}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </Button>
              <Button variant="ghost" onClick={() => navigate('/app')}>
                Go to my inbox
              </Button>
            </div>
          </div>
        )}

        {!loading && !user && done && (
          <div className="w-full max-w-sm text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <h1 className="mt-6 text-xl font-semibold tracking-tight">Welcome to the team</h1>
          </div>
        )}
      </main>
    </div>
  );
}
