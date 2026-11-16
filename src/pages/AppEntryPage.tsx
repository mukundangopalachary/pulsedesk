import { useEffect, useState } from 'react';
import { getFirstWorkspaceSlug } from '@/lib/workspace';
import { navigate } from '@/lib/router';
import { Button, ErrorMessage, Spinner } from '@/components/ui';

export default function AppEntryPage() {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const slug = await getFirstWorkspaceSlug();
        if (cancelled) return;
        navigate(slug ? `/app/${slug}` : '/onboarding');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <ErrorMessage message={error} />
          <Button className="w-full" onClick={() => { setError(null); setAttempt((n) => n + 1); }}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return <Spinner />;
}
